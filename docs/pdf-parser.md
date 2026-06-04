# PDF parser integration

SoulWing reads PDFs through the local hybrid parser pipeline:

1. MinerU adapter, when `PDF_MINERU_COMMAND` is configured.
2. Docling, when installed in the PDF Python environment.
3. PyMuPDF4LLM.
4. `pypdf-basic` text fallback for local smoke tests.

The app never sends PDF parser packages to the client bundle. Route handlers call `scripts/pdf-parser/parse_pdf.py` from Node.js and persist outputs under `storage/pdf/{userId}/{documentId}`.

## Setup

```powershell
py -3.12 -m venv .venv-pdf
.\.venv-pdf\Scripts\python.exe -m pip install --upgrade pip
.\.venv-pdf\Scripts\python.exe -m pip install -r scripts\pdf-parser\requirements.txt
.\.venv-pdf\Scripts\python.exe scripts\pdf-parser\parse_pdf.py --doctor
```

Optional MinerU adapter:

```powershell
$env:PDF_MINERU_COMMAND='mineru -p "{input}" -o "{output}"'
```

If your MinerU CLI uses a different command, keep the `{input}` and `{output}` placeholders and adjust the rest.

## Environment

```env
PDF_PARSER_PYTHON=.venv-pdf\Scripts\python.exe
PDF_PARSE_QUALITY=highest
PDF_PARSE_TIMEOUT_MS=600000
PDF_MAX_PAGES=300
PDF_CONTEXT_MAX_CHARS=14000
```

Limits in the app:

- PDF upload size: 50 MB.
- PDF parse page count: 300 pages.
- Parse timeout: 10 minutes.
- PDF outputs are private local storage; if deployed to a platform without persistent disk, move `storage/uploads` and `storage/pdf` to object storage.
