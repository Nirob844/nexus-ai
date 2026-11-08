import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import db_pool
from app.routers.health import router as health_router
from app.routers.ingestion import router as ingestion_router
from app.routers.rag import router as rag_router
from app.routers.classification import router as classification_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nexus-ai-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to PostgreSQL and register pgvector codec
    logger.info("Initializing NEXUS AI Microservice...")
    await db_pool.connect()
    yield
    # Shutdown: Close database pool
    logger.info("Shutting down NEXUS AI Microservice...")
    await db_pool.disconnect()

app = FastAPI(
    title="NEXUS AI - AI Processing Microservice",
    description="Dedicated AI service for Document Parsing, Text Chunking, pgvector Embeddings, RAG Q&A, and Ticket Intelligence.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health_router)
app.include_router(ingestion_router)
app.include_router(rag_router)
app.include_router(classification_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.AI_SERVICE_HOST,
        port=settings.AI_SERVICE_PORT,
        reload=False,
    )
