from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


class SkippedEngine(RuntimeError):
    pass


def now_ms() -> int:
    return int(time.perf_counter() * 1000)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def doctor() -> None:
    payload = {
        "python": sys.version,
        "engines": {
            "mineru_command": bool(os.environ.get("PDF_MINERU_COMMAND")),
            "docling": module_available("docling"),
            "pymupdf4llm": module_available("pymupdf4llm"),
            "pymupdf": module_available("fitz"),
            "pypdf": module_available("pypdf"),
        },
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def count_pages(input_path: Path) -> int:
    if module_available("fitz"):
        import fitz  # type: ignore

        with fitz.open(input_path) as doc:
            return int(doc.page_count)

    if module_available("pypdf"):
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(str(input_path))
        return len(reader.pages)

    return 0


def page_texts(input_path: Path) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    if module_available("fitz"):
        import fitz  # type: ignore

        texts: list[str] = []
        with fitz.open(input_path) as doc:
            for index, page in enumerate(doc, start=1):
                text = page.get_text("text").strip()
                if not text:
                    warnings.append(f"page {index} has no extractable text")
                texts.append(text)
        return texts, warnings

    if module_available("pypdf"):
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(str(input_path))
        texts = []
        for index, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if not text:
                warnings.append(f"page {index} has no extractable text")
            texts.append(text)
        return texts, warnings

    return [], ["no page-level text extractor is installed"]


def table_count(markdown: str) -> int:
    table_blocks = 0
    in_table = False
    for line in markdown.splitlines():
        looks_table = "|" in line and line.count("|") >= 2
        if looks_table and not in_table:
            table_blocks += 1
            in_table = True
        elif not looks_table:
            in_table = False
    return table_blocks


def formula_count(markdown: str) -> int:
    patterns = [
        r"\$\$.*?\$\$",
        r"\\\[.*?\\\]",
        r"\\\(.*?\\\)",
        r"\\begin\{equation\}",
        r"\\begin\{align\}",
    ]
    return sum(len(re.findall(pattern, markdown, flags=re.S)) for pattern in patterns)


def image_count(markdown: str) -> int:
    return len(re.findall(r"!\[[^\]]*\]\([^)]+\)", markdown))


def outline_from_markdown(markdown: str) -> list[dict[str, Any]]:
    outline: list[dict[str, Any]] = []
    for line in markdown.splitlines():
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if match:
            outline.append({
                "title": match.group(2).strip()[:200],
                "level": len(match.group(1)),
                "page": 1,
            })
    return outline[:200]


def heading_for_text(text: str, fallback: str) -> str:
    for line in text.splitlines():
        cleaned = line.strip().lstrip("#").strip()
        if 4 <= len(cleaned) <= 120:
            return cleaned
    return fallback


def split_text(text: str, max_chars: int = 3600) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    parts: list[str] = []
    current: list[str] = []
    size = 0
    for para in re.split(r"\n{2,}", text):
        para = para.strip()
        if not para:
            continue
        if current and size + len(para) > max_chars:
            parts.append("\n\n".join(current))
            current = []
            size = 0
        current.append(para)
        size += len(para)
    if current:
        parts.append("\n\n".join(current))
    return parts or [text[:max_chars]]


def chunks_from_pages(markdown: str, texts: list[str]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    if texts and any(text.strip() for text in texts):
        for page_index, text in enumerate(texts, start=1):
            text = text.strip()
            if not text:
                continue
            for part_index, part in enumerate(split_text(text), start=1):
                chunks.append({
                    "chunkId": f"p{page_index}-{part_index}",
                    "pageStart": page_index,
                    "pageEnd": page_index,
                    "kind": "text",
                    "heading": heading_for_text(part, f"Page {page_index}"),
                    "content": part,
                    "metadata": {"source": "page_text"},
                })

    if chunks:
        return chunks

    content = markdown.strip()
    if not content:
        return []
    for index, part in enumerate(split_text(content), start=1):
        chunks.append({
            "chunkId": f"md-{index}",
            "pageStart": 1,
            "pageEnd": 1,
            "kind": "text",
            "heading": heading_for_text(part, "Document"),
            "content": part,
            "metadata": {"source": "markdown"},
        })
    return chunks


def try_mineru(input_path: Path, output_dir: Path) -> dict[str, Any]:
    command_template = os.environ.get("PDF_MINERU_COMMAND", "").strip()
    if not command_template:
        raise SkippedEngine("PDF_MINERU_COMMAND is not configured")

    command = command_template.format(input=str(input_path), output=str(output_dir))
    subprocess.run(command, shell=True, check=True, cwd=str(output_dir), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    candidates = sorted(output_dir.rglob("*.md"), key=lambda item: item.stat().st_size, reverse=True)
    if not candidates:
        raise RuntimeError("MinerU command completed but no markdown output was found")
    markdown = candidates[0].read_text(encoding="utf-8", errors="replace")
    return {"engine": "MinerU", "markdown": markdown, "document": {"markdownPath": str(candidates[0])}, "warnings": []}


def try_docling(input_path: Path, _output_dir: Path) -> dict[str, Any]:
    if not module_available("docling"):
        raise SkippedEngine("docling is not installed")

    from docling.document_converter import DocumentConverter  # type: ignore

    converter = DocumentConverter()
    result = converter.convert(str(input_path))
    document = result.document
    markdown = document.export_to_markdown()
    if hasattr(document, "export_to_dict"):
      doc_json = document.export_to_dict()
    else:
      doc_json = {"repr": repr(document)}
    return {"engine": "Docling", "markdown": markdown, "document": doc_json, "warnings": []}


def try_pymupdf4llm(input_path: Path, _output_dir: Path) -> dict[str, Any]:
    if not module_available("pymupdf4llm"):
        raise SkippedEngine("pymupdf4llm is not installed")

    import pymupdf4llm  # type: ignore

    markdown = pymupdf4llm.to_markdown(str(input_path))
    return {"engine": "PyMuPDF4LLM", "markdown": markdown, "document": {"markdown": markdown}, "warnings": []}


def try_pypdf_basic(input_path: Path, _output_dir: Path) -> dict[str, Any]:
    if not module_available("pypdf"):
        raise SkippedEngine("pypdf is not installed")

    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(str(input_path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        pages.append(f"\n\n## Page {index}\n\n{page.extract_text() or ''}")
    markdown = "".join(pages).strip()
    return {"engine": "pypdf-basic", "markdown": markdown, "document": {"pages": len(reader.pages)}, "warnings": ["used basic text fallback"]}


def parse_pdf(input_path: Path, output_dir: Path, quality: str, max_pages: int) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    pages = count_pages(input_path)
    if pages > max_pages:
        raise RuntimeError(f"PDF has {pages} pages; limit is {max_pages}")

    engine_chain: list[dict[str, Any]] = []
    result: dict[str, Any] | None = None
    for name, fn in [
        ("MinerU", try_mineru),
        ("Docling", try_docling),
        ("PyMuPDF4LLM", try_pymupdf4llm),
        ("pypdf-basic", try_pypdf_basic),
    ]:
        start = now_ms()
        try:
            candidate = fn(input_path, output_dir)
            elapsed = now_ms() - start
            engine_chain.append({"engine": name, "status": "success", "elapsedMs": elapsed, "warnings": candidate.get("warnings", [])})
            result = candidate
            break
        except SkippedEngine as error:
            engine_chain.append({"engine": name, "status": "skipped", "elapsedMs": now_ms() - start, "error": str(error)})
        except Exception as error:  # noqa: BLE001
            engine_chain.append({"engine": name, "status": "failed", "elapsedMs": now_ms() - start, "error": str(error)})

    if result is None:
        raise RuntimeError("All PDF parsing engines failed or were unavailable")

    markdown = str(result.get("markdown") or "").strip()
    texts, page_warnings = page_texts(input_path)
    if pages == 0:
        pages = len(texts) or 1

    warnings = [*result.get("warnings", []), *page_warnings]
    chunks = chunks_from_pages(markdown, texts)
    markdown_path = output_dir / "document.md"
    json_path = output_dir / "document.json"
    chunks_path = output_dir / "chunks.json"
    manifest_path = output_dir / "manifest.json"

    source = {
        "filename": input_path.name,
        "size": input_path.stat().st_size,
        "sha256": sha256_file(input_path),
        "mimeType": "application/pdf",
    }
    document_json = {
        "engine": result["engine"],
        "quality": quality,
        "source": source,
        "document": result.get("document", {}),
        "markdown": markdown,
        "chunks": chunks,
    }
    markdown_path.write_text(markdown, encoding="utf-8")
    json_path.write_text(json.dumps(document_json, ensure_ascii=False, indent=2), encoding="utf-8")
    chunks_path.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "source": source,
        "engineChain": engine_chain,
        "stats": {
            "pages": pages,
            "characters": len(markdown) or sum(len(text) for text in texts),
            "tables": table_count(markdown),
            "formulas": formula_count(markdown),
            "images": image_count(markdown),
            "ocrPages": sum(1 for text in texts if not text.strip()),
        },
        "outline": outline_from_markdown(markdown),
        "chunks": chunks,
        "warnings": warnings,
        "output": {
            "markdownPath": str(markdown_path),
            "jsonPath": str(json_path),
            "manifestPath": str(manifest_path),
        },
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--doctor", action="store_true")
    parser.add_argument("--input")
    parser.add_argument("--output-dir")
    parser.add_argument("--quality", default="highest")
    parser.add_argument("--max-pages", type=int, default=300)
    args = parser.parse_args()

    if args.doctor:
        doctor()
        return

    if not args.input or not args.output_dir:
        parser.error("--input and --output-dir are required")

    manifest = parse_pdf(Path(args.input), Path(args.output_dir), args.quality, args.max_pages)
    print(json.dumps({"ok": True, "manifestPath": manifest["output"]["manifestPath"], "engine": manifest["engineChain"][-1]["engine"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
