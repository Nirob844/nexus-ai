from fastapi import APIRouter
from app.core.database import db_pool
import time

router = APIRouter(tags=["System"])

START_TIME = time.time()

@router.get("/health")
async def health_check():
    db_status = "disconnected"
    pgvector_status = "unavailable"
    
    try:
        conn = await db_pool.get_connection()
        try:
            # Check postgres
            row = await conn.fetchrow("SELECT 1 AS alive;")
            if row and row["alive"] == 1:
                db_status = "connected"

            # Check pgvector extension
            ext = await conn.fetchrow("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
            if ext:
                pgvector_status = f"available (v{ext['extversion']})"
        finally:
            await db_pool.release_connection(conn)
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "NEXUS AI Microservice (Python & FastAPI)",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "database": db_status,
        "pgvector": pgvector_status,
    }
