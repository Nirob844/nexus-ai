import asyncpg
from pgvector.asyncpg import register_vector
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class DatabasePool:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        """Initialize asyncpg connection pool and register pgvector."""
        try:
            async def init_connection(conn):
                await register_vector(conn)

            self.pool = await asyncpg.create_pool(
                dsn=settings.async_database_url,
                min_size=2,
                max_size=10,
                init=init_connection,
                timeout=10,
            )
            logger.info("Connected to PostgreSQL and registered pgvector codec successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL database: {e}")
            raise e

    async def disconnect(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("PostgreSQL connection pool closed.")

    async def get_connection(self) -> asyncpg.Connection:
        """Acquire connection from pool."""
        if not self.pool:
            raise RuntimeError("Database connection pool is not initialized.")
        return await self.pool.acquire()

    async def release_connection(self, conn: asyncpg.Connection):
        """Release connection back to pool."""
        if self.pool:
            await self.pool.release(conn)

db_pool = DatabasePool()
