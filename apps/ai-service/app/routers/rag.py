from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.services.rag_engine import rag_engine

router = APIRouter(prefix="/api/v1/rag", tags=["RAG & Knowledge Assistant"])

class RagQueryRequest(BaseModel):
    organization_id: str = Field(..., description="Organization UUID")
    question: str = Field(..., example="What is our company annual leave policy?")
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Optional list of previous messages [{'role': 'user'|'assistant', 'content': '...'}]"
    )
    top_k: Optional[int] = Field(default=4, ge=1, le=10)

class Citation(BaseModel):
    documentTitle: str
    pageNumber: Optional[int]
    similarity: float
    excerpt: str

class RagQueryResponse(BaseModel):
    answer: str
    citations: List[Citation]
    context_used: int

class SemanticSearchRequest(BaseModel):
    organization_id: str
    query: str
    top_k: Optional[int] = 5
    threshold: Optional[float] = 0.2

@router.post("/query", response_model=RagQueryResponse)
async def query_knowledge_base(req: RagQueryRequest):
    """
    Natural language Q&A against organization knowledge base with citations.
    """
    try:
        result = await rag_engine.answer_question(
            organization_id=req.organization_id,
            question=req.question,
            conversation_history=req.conversation_history,
            top_k=req.top_k or 4,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

@router.post("/search")
async def semantic_search(req: SemanticSearchRequest):
    """
    Raw semantic similarity vector search across organization documents.
    """
    try:
        chunks = await rag_engine.search_relevant_chunks(
            organization_id=req.organization_id,
            query=req.query,
            top_k=req.top_k or 5,
            threshold=req.threshold or 0.2,
        )
        return {
            "total_matches": len(chunks),
            "chunks": chunks,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {str(e)}")
