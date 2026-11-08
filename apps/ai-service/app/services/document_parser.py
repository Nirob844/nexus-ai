import io
import os
from typing import List, Dict, Any
from pypdf import PdfReader
from docx import Document

class DocumentParser:
    @staticmethod
    def parse(file_bytes: bytes, file_type: str) -> List[Dict[str, Any]]:
        """
        Extract text from file bytes based on file extension.
        Returns a list of dicts: [{"text": str, "page_number": int}]
        """
        normalized_ext = file_type.lower().lstrip(".")
        
        if normalized_ext == "pdf":
            return DocumentParser._parse_pdf(file_bytes)
        elif normalized_ext in ["docx", "doc"]:
            return DocumentParser._parse_docx(file_bytes)
        elif normalized_ext in ["txt", "md", "markdown"]:
            return DocumentParser._parse_text(file_bytes)
        else:
            raise ValueError(f"Unsupported file format: {file_type}. Supported: PDF, DOCX, TXT, MD")

    @staticmethod
    def _parse_pdf(file_bytes: bytes) -> List[Dict[str, Any]]:
        pages_content = []
        reader = PdfReader(io.BytesIO(file_bytes))
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages_content.append({
                    "text": text.strip(),
                    "page_number": idx + 1
                })
        return pages_content

    @staticmethod
    def _parse_docx(file_bytes: bytes) -> List[Dict[str, Any]]:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        full_text = "\n\n".join(paragraphs)
        return [{"text": full_text, "page_number": 1}] if full_text else []

    @staticmethod
    def _parse_text(file_bytes: bytes) -> List[Dict[str, Any]]:
        text = file_bytes.decode("utf-8", errors="replace").strip()
        return [{"text": text, "page_number": 1}] if text else []
