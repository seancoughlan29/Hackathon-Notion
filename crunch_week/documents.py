"""Bounded PDF/text ingestion. PDFs are parsed in a time-limited child process."""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
import re
import sys
import zipfile
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


_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
MAX_UNZIPPED = 60 * 1024 * 1024


def _open_office_zip(data: bytes, kind: str) -> zipfile.ZipFile:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise DocumentError(f"This {kind} file could not be opened. Re-save it and try again.") from exc
    if sum(info.file_size for info in archive.infolist()) > MAX_UNZIPPED:
        raise DocumentError(f"This {kind} file is too large once unpacked.")
    return archive


def _parse_xml(archive: zipfile.ZipFile, member: str):
    from xml.etree import ElementTree

    try:
        return ElementTree.fromstring(archive.read(member))
    except (KeyError, ElementTree.ParseError) as exc:
        raise DocumentError("This Office file is damaged or not a real Word/PowerPoint file.") from exc


def _docx_pages(data: bytes) -> list[str]:
    archive = _open_office_zip(data, "Word")
    root = _parse_xml(archive, "word/document.xml")
    body = root.find(f"{_W}body")
    if body is None:
        raise DocumentError("This Word file has no readable body.")
    lines: list[str] = []
    for block in body:
        if block.tag == f"{_W}p":
            text = "".join(t.text or "" for t in block.iter(f"{_W}t")).strip()
            if text:
                lines.append(text)
        elif block.tag == f"{_W}tbl":
            # Keep table rows on one line so assessment/weight/date stay together.
            for row in block.iter(f"{_W}tr"):
                cells = [
                    " ".join("".join(t.text or "" for t in p.iter(f"{_W}t")) for p in cell.iter(f"{_W}p")).strip()
                    for cell in row.iter(f"{_W}tc")
                ]
                if any(cells):
                    lines.append(" | ".join(cells))
    # Word has no fixed pages; group into ~3,000 character sections for source references.
    pages: list[str] = []
    current = ""
    for line in lines:
        if current and len(current) + len(line) > 3000:
            pages.append(current)
            current = ""
        current += line + "\n"
    if current:
        pages.append(current)
    return pages


def _pptx_pages(data: bytes) -> list[str]:
    archive = _open_office_zip(data, "PowerPoint")
    slides = sorted(
        (n for n in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
        key=lambda n: int(re.findall(r"\d+", n)[-1]),
    )
    if len(slides) > MAX_PAGES:
        raise DocumentError(f"Presentations must have at most {MAX_PAGES} slides.")
    pages = []
    for name in slides:
        root = _parse_xml(archive, name)
        paras = ["".join(t.text or "" for t in p.iter(f"{_A}t")).strip() for p in root.iter(f"{_A}p")]
        pages.append("\n".join(p for p in paras if p))
    return [p for p in pages if p.strip()]


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
    elif suffix in (".docx", ".pptx"):
        pages = _docx_pages(data) if suffix == ".docx" else _pptx_pages(data)
        if not pages:
            raise DocumentError("No readable text found in this file.")
        if sum(len(p) for p in pages) > MAX_CHARS:
            raise DocumentError("Document is too long. Upload the assessment section only.")
    elif suffix in (".txt", ".md"):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise DocumentError("Text files must use UTF-8 encoding.") from exc
        if not text.strip() or "\x00" in text or len(text) > MAX_CHARS:
            raise DocumentError("Upload readable text of 1–120,000 characters.")
        pages = [text]
    else:
        raise DocumentError("Supported files: PDF, Word (.docx), PowerPoint (.pptx) and text (.txt, .md).")
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
