import json
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import db_pool
from app.services.document_parser import DocumentParser
from app.services.chunker import TextChunker
from app.services.embeddings import embedding_service

router = APIRouter(prefix="/api/v1/documents", tags=["Document Ingestion"])

class ProcessTextDocumentRequest(BaseModel):
    document_id: str
    organization_id: str
    title: str
    content: str
    file_type: str = "txt"

@router.post("/process-text")
async def process_text_document(req: ProcessTextDocumentRequest):
    """
    Process raw text/markdown document content, chunk, embed and store in pgvector.
    """
    chunker = TextChunker(chunk_size=600, chunk_overlap=100)
    pages = [{"text": req.content, "page_number": 1}]
    chunks = chunker.chunk_document(pages)

    if not chunks:
        raise HTTPException(status_code=400, detail="Document content is empty or contains no parseable text.")

    conn = await db_pool.get_connection()
    try:
        # Generate embeddings in batch
        texts = [c["content"] for c in chunks]
        embeddings = await embedding_service.get_embeddings(texts)

        # Batch insert into knowledge_chunks
        async with conn.transaction():
            # Delete any previous chunks for this document
            await conn.execute("DELETE FROM knowledge_chunks WHERE document_id = $1::uuid;", req.document_id)

            for c, emb in zip(chunks, embeddings):
                chunk_id = str(uuid.uuid4())
                await conn.execute(
                    """
                    INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, page_number, embedding, metadata, created_at)
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, NOW());
                    """,
                    chunk_id,
                    req.document_id,
                    c["chunk_index"],
                    c["content"],
                    c["page_number"],
                    emb,
                    json.dumps(c["metadata"]),
                )

            # Update document status in knowledge_documents
            await conn.execute(
                """
                UPDATE knowledge_documents
                SET status = 'COMPLETED', total_chunks = $1, updated_at = NOW()
                WHERE id = $2::uuid;
                """,
                len(chunks),
                req.document_id,
            )

        return {
            "success": True,
            "document_id": req.document_id,
            "total_chunks": len(chunks),
            "status": "COMPLETED",
        }
    except Exception as e:
        # Mark document as failed
        await conn.execute(
            """
            UPDATE knowledge_documents
            SET status = 'FAILED', error_message = $1, updated_at = NOW()
            WHERE id = $2::uuid;
            """,
            str(e),
            req.document_id,
        )
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        await db_pool.release_connection(conn)

@router.post("/process-file")
async def process_file_upload(
    document_id: str = Form(...),
    organization_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Parse uploaded file (PDF, DOCX, TXT, MD), chunk, embed and persist in pgvector.
    """
    content_bytes = await file.read()
    file_type = file.filename.split(".")[-1] if "." in file.filename else "txt"

    try:
        pages = DocumentParser.parse(content_bytes, file_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")

    chunker = TextChunker(chunk_size=600, chunk_overlap=100)
    chunks = chunker.chunk_document(pages)

    if not chunks:
        raise HTTPException(status_code=400, detail="Document contains no readable text.")

    conn = await db_pool.get_connection()
    try:
        texts = [c["content"] for c in chunks]
        embeddings = await embedding_service.get_embeddings(texts)

        async with conn.transaction():
            await conn.execute("DELETE FROM knowledge_chunks WHERE document_id = $1::uuid;", document_id)

            for c, emb in zip(chunks, embeddings):
                chunk_id = str(uuid.uuid4())
                await conn.execute(
                    """
                    INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, page_number, embedding, metadata, created_at)
                    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, NOW());
                    """,
                    chunk_id,
                    document_id,
                    c["chunk_index"],
                    c["content"],
                    c["page_number"],
                    emb,
                    json.dumps(c["metadata"]),
                )

            await conn.execute(
                """
                UPDATE knowledge_documents
                SET status = 'COMPLETED', total_chunks = $1, updated_at = NOW()
                WHERE id = $2::uuid;
                """,
                len(chunks),
                document_id,
            )

        return {
            "success": True,
            "document_id": document_id,
            "total_chunks": len(chunks),
            "status": "COMPLETED",
        }
    except Exception as e:
        await conn.execute(
            """
            UPDATE knowledge_documents
            SET status = 'FAILED', error_message = $1, updated_at = NOW()
            WHERE id = $2::uuid;
            """,
            str(e),
            document_id,
        )
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        await db_pool.release_connection(conn)
