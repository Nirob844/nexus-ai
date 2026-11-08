import math
import hashlib
import httpx
from typing import List
from app.core.config import settings

class EmbeddingService:
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    async def get_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        embeddings = await self.get_embeddings([text])
        return embeddings[0]

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embedding vectors for a list of texts.
        Uses OpenAI API if configured, otherwise falls back to deterministic local unit vectorizer.
        """
        if settings.OPENAI_API_KEY:
            try:
                return await self._get_openai_embeddings(texts)
            except Exception as e:
                # Fallback to local embedding on API error
                pass

        return [self._generate_local_embedding(text) for text in texts]

    async def _get_openai_embeddings(self, texts: List[str]) -> List[List[float]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "input": texts,
                    "model": settings.EMBEDDING_MODEL,
                },
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]

    def _generate_local_embedding(self, text: str) -> List[float]:
        """
        Generates a 1536-dimensional L2-normalized pseudo-semantic vector from text.
        Words and n-grams project to specific vector coordinates, allowing cosine similarity
        to reflect semantic and term overlap without external API requirements.
        """
        vector = [0.0] * self.dimension
        words = text.lower().split()
        
        # Word-level projection
        for idx, word in enumerate(words):
            h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            pos = h % self.dimension
            val = (h % 1000) / 1000.0 - 0.5
            vector[pos] += val * 1.5

            # Bigram projection
            if idx > 0:
                bigram = f"{words[idx-1]}_{word}"
                bh = int(hashlib.md5(bigram.encode("utf-8")).hexdigest(), 16)
                bpos = bh % self.dimension
                vector[bpos] += 1.0

        # L2-normalization so that dot product equals cosine similarity
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        else:
            vector[0] = 1.0  # Fallback non-zero unit vector

        return vector

embedding_service = EmbeddingService(dimension=settings.EMBEDDING_DIMENSION)
