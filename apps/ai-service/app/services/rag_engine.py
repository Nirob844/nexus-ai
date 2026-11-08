import logging
import httpx
from typing import List, Dict, Any, Optional
from app.core.database import db_pool
from app.core.config import settings
from app.services.embeddings import embedding_service

logger = logging.getLogger(__name__)

class RagEngine:
    async def search_relevant_chunks(
        self,
        organization_id: str,
        query: str,
        top_k: int = 5,
        threshold: float = 0.05,
    ) -> List[Dict[str, Any]]:
        """
        Search knowledge base using pgvector cosine distance.
        """
        query_vector = await embedding_service.get_embedding(query)
        conn = await db_pool.get_connection()

        try:
            # Query knowledge_chunks joined with knowledge_documents filtered by organization
            sql = """
                SELECT
                    c.id,
                    c.document_id,
                    c.chunk_index,
                    c.content,
                    c.page_number,
                    c.metadata,
                    d.title AS document_title,
                    1 - (c.embedding <=> $1) AS similarity
                FROM knowledge_chunks c
                JOIN knowledge_documents d ON c.document_id = d.id
                WHERE d.organization_id = $2
                ORDER BY c.embedding <=> $1
                LIMIT $3;
            """
            rows = await conn.fetch(sql, query_vector, organization_id, top_k)

            results = []
            for row in rows:
                similarity = float(row["similarity"])
                if similarity >= threshold:
                    results.append({
                        "id": str(row["id"]),
                        "document_id": str(row["document_id"]),
                        "document_title": row["document_title"],
                        "chunk_index": row["chunk_index"],
                        "content": row["content"],
                        "page_number": row["page_number"],
                        "similarity": round(similarity, 4),
                        "metadata": row["metadata"],
                    })

            return results
        finally:
            await db_pool.release_connection(conn)

    async def answer_question(
        self,
        organization_id: str,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 4,
    ) -> Dict[str, Any]:
        """
        Retrieve context and generate grounded answer with source citations.
        """
        chunks = await self.search_relevant_chunks(organization_id, question, top_k=top_k)

        if not chunks:
            return {
                "answer": "I could not find any relevant information in your organization's knowledge base to answer this question. Please ensure the relevant policy or documentation has been uploaded.",
                "citations": [],
                "context_used": 0,
            }

        # Build context string and structured citations
        context_parts = []
        citations = []

        for c in chunks:
            doc_title = c["document_title"]
            page = c["page_number"]
            context_parts.append(
                f"[Source: {doc_title}, Page: {page}]\n{c['content']}"
            )
            citations.append({
                "documentTitle": doc_title,
                "pageNumber": page,
                "similarity": c["similarity"],
                "excerpt": c["content"][:200] + "..." if len(c["content"]) > 200 else c["content"],
            })

        full_context = "\n\n---\n\n".join(context_parts)

        # Generate answer using Gemini, OpenAI, or local grounded extractor
        if settings.GEMINI_API_KEY:
            try:
                answer = await self._generate_gemini_answer(question, full_context, conversation_history)
                return {
                    "answer": answer,
                    "citations": citations,
                    "context_used": len(chunks),
                    "model": settings.GEMINI_MODEL,
                }
            except Exception as e:
                logger.warning(f"Gemini API call failed, falling back: {e}")

        if settings.OPENAI_API_KEY:
            try:
                answer = await self._generate_openai_answer(question, full_context, conversation_history)
                return {
                    "answer": answer,
                    "citations": citations,
                    "context_used": len(chunks),
                    "model": "gpt-4o-mini",
                }
            except Exception as e:
                logger.warning(f"OpenAI API call failed, falling back to grounded extractor: {e}")

        # Local grounded response generator
        answer = self._generate_grounded_summary(question, chunks)
        return {
            "answer": answer,
            "citations": citations,
            "context_used": len(chunks),
            "model": "deterministic-grounded-v1",
        }

    async def _generate_gemini_answer(
        self,
        question: str,
        context: str,
        history: Optional[List[Dict[str, str]]],
    ) -> str:
        prompt = (
            "You are NEXUS AI, an expert internal knowledge assistant for company employees and support teams. "
            "Answer the question accurately, professionally, and strictly using ONLY the provided context excerpts below. "
            "Always mention document references and page numbers when available. "
            "If the answer cannot be determined from the context, state that clearly.\n\n"
            f"--- Context Excerpts ---\n{context}\n\n"
            f"--- User Question ---\n{question}\n\n"
            "--- Grounded Answer ---"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 800,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def _generate_openai_answer(
        self,
        question: str,
        context: str,
        history: Optional[List[Dict[str, str]]],
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are NEXUS AI, an expert internal knowledge assistant for company employees. "
                    "Answer the question accurately and strictly using ONLY the provided context excerpts. "
                    "Always mention document references and page numbers when available. "
                    "If the answer cannot be determined from the context, state that clearly."
                ),
            },
            {
                "role": "user",
                "content": f"Context Information:\n{context}\n\nQuestion: {question}",
            },
        ]

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _generate_grounded_summary(self, question: str, chunks: List[Dict[str, Any]]) -> str:
        """
        Grounded synthesis that extracts key sentences from top retrieved chunks
        and frames a clear response citing documents and page numbers.
        """
        top_chunk = chunks[0]
        doc = top_chunk["document_title"]
        page = top_chunk["page_number"]
        
        paragraphs = [c["content"] for c in chunks[:2]]
        combined_text = " ".join(paragraphs)

        return (
            f"Based on **{doc}** (Page {page}), here is the relevant information regarding your question:\n\n"
            f"> \"{top_chunk['content']}\"\n\n"
            f"*(Reference: {doc}, Page {page})*"
        )

rag_engine = RagEngine()
