from typing import List, Dict, Any

class TextChunker:
    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_document(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Takes list of pages [{"text": str, "page_number": int}]
        and returns a list of chunks:
        [{
            "chunk_index": int,
            "content": str,
            "page_number": int,
            "metadata": dict
        }]
        """
        all_chunks = []
        global_chunk_idx = 0

        for page in pages:
            text = page.get("text", "")
            page_num = page.get("page_number", 1)

            if not text:
                continue

            # Split text recursively by paragraphs, sentences, or characters
            chunks = self._split_text(text)

            for chunk_text in chunks:
                if not chunk_text.strip():
                    continue

                all_chunks.append({
                    "chunk_index": global_chunk_idx,
                    "content": chunk_text.strip(),
                    "page_number": page_num,
                    "metadata": {
                        "length": len(chunk_text),
                        "word_count": len(chunk_text.split()),
                    }
                })
                global_chunk_idx += 1

        return all_chunks

    def _split_text(self, text: str) -> List[str]:
        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.chunk_size

            # If not at the end of text, try to find a natural boundary (newline or period)
            if end < text_len:
                boundary = text.rfind("\n\n", start, end)
                if boundary == -1:
                    boundary = text.rfind("\n", start, end)
                if boundary == -1:
                    boundary = text.rfind(". ", start, end)
                if boundary != -1 and boundary > start + (self.chunk_size // 2):
                    end = boundary + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - self.chunk_overlap
            if start >= text_len or end >= text_len:
                break

        return chunks
