"""Bounded PDF/text ingestion. PDFs are parsed in a time-limited child process."""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 50
MAX_CHARS = 120_000


class DocumentError(ValueError):
    pass


@dataclass(frozen=True)
class Document:
    name: str
    digest: str
    pages: tuple[str, ...]

    @property
    def text(self) -> str:
        return "\n\n".join(f"[PAGE {n}]\n{text}" for n, text in enumerate(self.pages, 1))


def _pdf_pages(data: bytes) -> list[str]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise DocumentError("Password-protected PDFs are not supported. Export an unlocked copy.")
        if len(reader.pages) > MAX_PAGES:
            raise DocumentError(f"PDFs must have at most {MAX_PAGES} pages. Upload the assessment section.")
        pages = []
        total = 0
        for page in reader.pages:
            content = page.get_contents()
            if content is not None and len(content.get_data()) > 8 * 1024 * 1024:
                raise DocumentError("A PDF page is too complex. Export a simpler text PDF.")
            text = page.extract_text() or ""
            total += len(text)
            if total > MAX_CHARS:
                raise DocumentError("Document is too long. Upload the assessment section only.")
            pages.append(text)
        if not any(text.strip() for text in pages):
            raise DocumentError("No readable text found. OCR scanned PDFs first, or paste the assessment text.")
        # Never silently miss a scanned page among text pages.
        if any(not text.strip() for text in pages):
            raise DocumentError(
                "At least one page has no readable text. Remove blank pages or OCR the whole PDF first."
            )
        return pages
    except DocumentError:
        raise
    except Exception as exc:
        raise DocumentError("This PDF could not be read. Export a fresh, text-based PDF.") from exc


def read_document(name: str, data: bytes) -> Document:
    safe_name = name.replace("\\", "/").rsplit("/", 1)[-1][:255]
    if not data or len(data) > MAX_BYTES:
        raise DocumentError("Each file must be nonempty and no larger than 10 MB.")
    suffix = Path(safe_name).suffix.casefold()
    if suffix == ".pdf":
        if not data.lstrip().startswith(b"%PDF-"):
            raise DocumentError("This file does not have a valid PDF header.")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "crunch_week.documents"],
                input=data,
                capture_output=True,
                timeout=25,
                check=False,
                cwd=Path(__file__).resolve().parent.parent,
            )
        except subprocess.TimeoutExpired as exc:
            raise DocumentError("PDF parsing timed out. Upload a simpler PDF or a text file.") from exc
        try:
            payload = json.loads(result.stdout)
        except (ValueError, UnicodeError) as exc:
            raise DocumentError("PDF parser stopped unexpectedly. Try a simpler PDF.") from exc
        if result.returncode or "error" in payload:
            raise DocumentError(payload.get("error", "PDF could not be read."))
        pages = payload["pages"]
    elif suffix == ".txt":
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise DocumentError("Text files must use UTF-8 encoding.") from exc
        if not text.strip() or "\x00" in text or len(text) > MAX_CHARS:
            raise DocumentError("Upload readable text of 1–120,000 characters.")
        pages = [text]
    else:
        raise DocumentError("Only PDF and UTF-8 .txt files are supported.")
    return Document(safe_name, hashlib.sha256(data).hexdigest(), tuple(pages))


def chunks(document: Document, size: int = 18_000, overlap: int = 800) -> list[str]:
    """Keep page markers and overlap long pages to protect split table rows."""
    if size < 1000 or not 0 <= overlap < size:
        raise ValueError("Invalid chunk size/overlap")
    parts: list[str] = []
    current = ""
    for number, page in enumerate(document.pages, 1):
        for start in range(0, max(len(page), 1), size - overlap):
            piece = f"[PAGE {number}]\n{page[start : start + size]}\n"
            if current and len(current) + len(piece) > size:
                parts.append(current)
                current = ""
            current += piece
            if start + size >= len(page):
                break
    if current:
        parts.append(current)
    return parts


if __name__ == "__main__":
    # Linux/Docker: contain decompression bombs. Windows still has a wall-time limit.
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
    try:
        print(json.dumps({"pages": _pdf_pages(sys.stdin.buffer.read(MAX_BYTES + 1))}))
    except DocumentError as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
