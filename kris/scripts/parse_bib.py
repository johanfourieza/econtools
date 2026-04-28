#!/usr/bin/env python3
"""Parse a BibTeX file into kris/refs.json.

Self-contained (no external deps). Handles nested braces, quoted values, and the
LaTeX command escapes that come up in academic .bib files. Per-entry parse
failures are recorded with parse_error=True rather than aborting the run.

Usage:
    python parse_bib.py <input.bib> <output.json>
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

ENTRY_HEAD = re.compile(r"@(\w+)\s*[{(]\s*([^,\s]+)\s*,", re.IGNORECASE)
DOI_FIELD = re.compile(r"\b10\.\d{4,9}/[^\s,}'\"]+", re.IGNORECASE)
ARXIV_FIELD = re.compile(r"\b(\d{4}\.\d{4,5}|[a-z\-]+/\d{7})", re.IGNORECASE)
ISBN_FIELD = re.compile(r"\b(?:97[89][- ]?)?\d{1,5}[- ]?\d{1,7}[- ]?\d{1,7}[- ]?[\dxX]\b")

LATEX_ACCENTS = {
    "\\\"a": "ä", "\\\"o": "ö", "\\\"u": "ü", "\\\"e": "ë", "\\\"i": "ï",
    "\\'a": "á", "\\'e": "é", "\\'i": "í", "\\'o": "ó", "\\'u": "ú",
    "\\`a": "à", "\\`e": "è", "\\`i": "ì", "\\`o": "ò", "\\`u": "ù",
    "\\^a": "â", "\\^e": "ê", "\\^i": "î", "\\^o": "ô", "\\^u": "û",
    "\\~a": "ã", "\\~n": "ñ", "\\~o": "õ",
    "\\c c": "ç", "\\c{c}": "ç",
    "\\ss": "ß", "\\AE": "Æ", "\\ae": "æ", "\\OE": "Œ", "\\oe": "œ",
    "\\o": "ø", "\\O": "Ø", "\\l": "ł", "\\L": "Ł", "\\&": "&",
}

LATEX_CMD = re.compile(r"\\(?:textit|textbf|emph|mathit|mathrm|mathbf|text)\{([^}]*)\}")
SIMPLE_BRACES = re.compile(r"\{([^{}]*)\}")
WHITESPACE = re.compile(r"\s+")


def strip_latex(s: str) -> str:
    if not s:
        return s
    for k, v in LATEX_ACCENTS.items():
        s = s.replace(k, v)
    # \textit{Foo} -> Foo
    for _ in range(3):
        s = LATEX_CMD.sub(r"\1", s)
    # Drop remaining single-level braces preserved for case sensitivity {Author}
    for _ in range(3):
        s = SIMPLE_BRACES.sub(r"\1", s)
    s = s.replace("\\&", "&").replace("--", "–").replace("---", "—")
    s = unicodedata.normalize("NFC", s)
    s = WHITESPACE.sub(" ", s).strip()
    return s


def find_entries(text: str) -> list[tuple[int, int, str, str, str]]:
    """Find every @type{key, ...} block. Returns (start, end, type, key, body)."""
    entries: list[tuple[int, int, str, str, str]] = []
    i = 0
    while i < len(text):
        m = ENTRY_HEAD.search(text, i)
        if not m:
            break
        start = m.start()
        etype = m.group(1).lower()
        ekey = m.group(2)
        if etype in {"comment", "preamble", "string"}:
            i = m.end()
            continue
        # Walk braces from m.end()-1 (the opening { ) to find matching close
        body_start = text.find("{", m.start())
        if body_start < 0:
            i = m.end()
            continue
        depth = 0
        j = body_start
        while j < len(text):
            c = text[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        if depth != 0:
            # malformed — record what we have and stop
            entries.append((start, len(text), etype, ekey, text[body_start + 1:]))
            break
        body = text[body_start + 1: j]
        # Drop the leading "key,"
        comma = body.find(",")
        if comma >= 0:
            body = body[comma + 1:]
        entries.append((start, j + 1, etype, ekey, body))
        i = j + 1
    return entries


def split_fields(body: str) -> dict[str, str]:
    """Split a body into name=value pairs. Tolerant of nested braces and quotes."""
    fields: dict[str, str] = {}
    i = 0
    n = len(body)
    while i < n:
        # Find field name = ...
        m = re.match(r"\s*([A-Za-z][\w\-]*)\s*=\s*", body[i:])
        if not m:
            # no more fields
            break
        name = m.group(1).lower()
        i += m.end()
        if i >= n:
            break
        c = body[i]
        if c == "{":
            depth = 1
            i += 1
            start = i
            while i < n and depth > 0:
                if body[i] == "{":
                    depth += 1
                elif body[i] == "}":
                    depth -= 1
                i += 1
            value = body[start: i - 1] if depth == 0 else body[start: i]
        elif c == '"':
            i += 1
            start = i
            while i < n and body[i] != '"':
                i += 1
            value = body[start: i]
            if i < n:
                i += 1
        else:
            # unquoted (number or string macro)
            start = i
            while i < n and body[i] not in ",\n\r":
                i += 1
            value = body[start: i].strip()
        fields[name] = value
        # skip trailing comma / whitespace
        while i < n and body[i] in ",\n\r\t ":
            i += 1
    return fields


def parse_authors(raw: str) -> list[str]:
    if not raw:
        return []
    cleaned = strip_latex(raw)
    parts = re.split(r"\s+and\s+", cleaned, flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]


def author_lastnames(authors: list[str]) -> list[str]:
    out: list[str] = []
    for a in authors:
        if "," in a:
            ln = a.split(",", 1)[0].strip()
        else:
            ln = a.strip().split(" ")[-1]
        ln = strip_latex(ln).rstrip(".")
        if ln:
            out.append(ln)
    return out


def extract_year(raw: str) -> int | None:
    if not raw:
        return None
    m = re.search(r"\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b", raw)
    return int(m.group(1)) if m else None


def parse_bib(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    refs: list[dict[str, Any]] = []
    raw_entries = find_entries(text)
    for idx, (start, end, etype, ekey, body) in enumerate(raw_entries, start=1):
        ref_id = f"ref_{idx:04d}"
        record: dict[str, Any] = {
            "ref_id": ref_id,
            "bib_key": ekey,
            "type": etype,
            "raw": text[start: end],
            "parse_error": False,
        }
        try:
            fields = split_fields(body)
            title = strip_latex(fields.get("title", ""))
            authors_raw = fields.get("author") or fields.get("editor") or ""
            authors = parse_authors(authors_raw)
            year = extract_year(fields.get("year", "") or fields.get("date", ""))
            doi = fields.get("doi", "").strip()
            if not doi:
                m = DOI_FIELD.search(fields.get("url", ""))
                doi = m.group(0) if m else ""
            arxiv = fields.get("eprint", "").strip()
            if not arxiv:
                m = ARXIV_FIELD.search(fields.get("url", ""))
                arxiv = m.group(0) if m else ""
            isbn_match = ISBN_FIELD.search(fields.get("isbn", ""))
            isbn = isbn_match.group(0) if isbn_match else fields.get("isbn", "").strip()
            record.update({
                "title": title,
                "authors": authors,
                "author_lastnames": author_lastnames(authors),
                "year": year,
                "doi": doi.lower(),
                "arxiv_id": arxiv,
                "journal": strip_latex(fields.get("journal", "")),
                "booktitle": strip_latex(fields.get("booktitle", "")),
                "publisher": strip_latex(fields.get("publisher", "")),
                "address": strip_latex(fields.get("address", "")),
                "volume": fields.get("volume", "").strip(),
                "issue": fields.get("number", "").strip() or fields.get("issue", "").strip(),
                "pages": fields.get("pages", "").strip(),
                "url": fields.get("url", "").strip(),
                "isbn": isbn,
                "edition": fields.get("edition", "").strip(),
                "raw_fields": fields,
            })
        except Exception as exc:
            record["parse_error"] = True
            record["parse_error_message"] = str(exc)
        refs.append(record)
    return refs


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: parse_bib.py <input.bib> <output.json>", file=sys.stderr)
        return 2
    in_path = Path(argv[1])
    out_path = Path(argv[2])
    if not in_path.exists():
        print(f"error: {in_path} not found", file=sys.stderr)
        return 1
    refs = parse_bib(in_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"source": str(in_path), "n": len(refs), "refs": refs}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"parsed {len(refs)} references -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
