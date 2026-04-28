#!/usr/bin/env python3
"""Extract a \\begin{thebibliography} block from a .tex file into a .bib.

Heuristic — captures: bibkey, year, authors, title, venue/journal, volume,
issue, pages (article); publisher (book). LaTeX accents are normalised.
The kris parser will then process the resulting .bib normally.

Usage:
    python extract_thebibliography.py <input.tex> <output.bib>
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

LATEX_REPL = [
    (r"\\'\{e\}", "é"), (r"\\'\{a\}", "á"), (r"\\'\{o\}", "ó"),
    (r"\\'\{u\}", "ú"), (r"\\'\{i\}", "í"),
    (r"\\`\{e\}", "è"), (r"\\`\{a\}", "à"),
    (r"\\\^\{a\}", "â"), (r"\\\^\{o\}", "ô"), (r"\\\^\{e\}", "ê"),
    (r'\\"\{a\}', "ä"), (r'\\"\{o\}', "ö"), (r'\\"\{u\}', "ü"), (r'\\"\{e\}', "ë"),
    (r"\\~\{n\}", "ñ"), (r"\\c\{c\}", "ç"),
    (r"\\'e", "é"), (r"\\'a", "á"), (r"\\'o", "ó"), (r"\\'u", "ú"), (r"\\'i", "í"),
    (r"\\`e", "è"), (r"\\`a", "à"),
    (r"\\\^a", "â"), (r"\\\^o", "ô"),
    (r'\\"a', "ä"), (r'\\"o', "ö"), (r'\\"u', "ü"), (r'\\"e', "ë"),
    (r"\\&", "&"),
    (r"\\textendash\b", "-"),
    (r"---", "-"), (r"--", "-"),
    (r"``", '"'), (r"''", '"'),
]

EMPH_RE = re.compile(r"\\emph\{((?:[^{}]|\{[^}]*\})*)\}")
QUOTED_RE = re.compile(r'``(.+?)\'\'', re.DOTALL)
BIBITEM_RE = re.compile(
    r"\\bibitem\[(?P<label>[^\]]*)\]\{(?P<key>[^}]+)\}\s*(?P<body>.*?)(?=\\bibitem\[|\\end\{thebibliography\})",
    re.DOTALL,
)
WS_RE = re.compile(r"\s+")
BRACES_RE = re.compile(r"\{|\}")
LATEX_CMD_RE = re.compile(r"\\[a-zA-Z]+\{([^}]*)\}")


def detex(s: str) -> str:
    for pat, rep in LATEX_REPL:
        s = re.sub(pat, rep, s)
    return s


def clean(s: str) -> str:
    s = detex(s)
    s = LATEX_CMD_RE.sub(r"\1", s)
    s = re.sub(r"\\\s", " ", s)
    s = BRACES_RE.sub("", s)
    s = WS_RE.sub(" ", s).strip()
    return s


def extract(tex: str) -> list[dict]:
    m = re.search(r"\\begin\{thebibliography\}.*?\\end\{thebibliography\}", tex, re.DOTALL)
    if not m:
        return []
    body = m.group(0)
    out = []
    for it in BIBITEM_RE.finditer(body):
        label = it.group("label")
        key = it.group("key")
        b = WS_RE.sub(" ", it.group("body").strip())
        ems = EMPH_RE.findall(b)
        qm = QUOTED_RE.search(b)
        if qm and ems:
            etype = "article"
            title = clean(qm.group(1))
            venue = clean(ems[0])
        elif ems and not qm:
            etype = "book"
            title = clean(ems[0])
            venue = ""
        elif qm:
            etype = "misc"
            title = clean(qm.group(1))
            venue = ""
        else:
            etype = "misc"
            title = ""
            venue = ""
        ym = re.search(r"\((\d{4})", label) or re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", b)
        year = ym.group(1) if ym else ""
        # Authors: text up to the first ". 1234."
        am = re.match(r"(.*?)\.\s+\d{4}\.", clean(b))
        if am:
            authors_raw = am.group(1)
        else:
            authors_raw = re.split(r"\(", label, 1)[0]
        authors_raw = re.sub(r",\s*and\s+", " and ", authors_raw)
        # Volume / issue / pages (article)
        vol_m = re.search(r"\\emph\{[^}]+\}\s*(\d+)", b) or re.search(r"\b(\d+)\s*\(\d+\):", b)
        issue_m = re.search(r"\((\d+)\):", b)
        pages_m = re.search(r":\s*(\d+[\-–]+\d+)", b)
        # Publisher heuristic for book: take the LAST "Place: Publisher." pattern
        # AFTER the closing \emph{} of the title, since the title may itself
        # contain "Subtitle: ..." colons that would otherwise be misread as a
        # Place:Publisher pair.
        publisher = ""
        if etype == "book" and ems:
            # Search starting after the title's emph block.
            after_title_idx = b.rfind("\\emph{" + ems[0])
            search_in = clean(b[after_title_idx + len("\\emph{" + ems[0]) + 1:]) if after_title_idx >= 0 else clean(b)
            matches = list(re.finditer(r"([A-Z][\w\s\.,&\'-]+?):\s*([A-Z][\w\s\.,&\'-]+?)(?:\.\s|$)", search_in))
            if matches:
                publisher = matches[-1].group(2).strip()
        out.append({
            "key": key,
            "type": etype,
            "title": title,
            "venue": venue,
            "authors": clean(authors_raw),
            "year": year,
            "volume": vol_m.group(1) if vol_m else "",
            "issue": issue_m.group(1) if issue_m else "",
            "pages": pages_m.group(1).replace("–", "--") if pages_m else "",
            "publisher": publisher,
        })
    return out


def render(entries: list[dict]) -> str:
    out = []
    for e in entries:
        lines = [
            f"  author    = {{{e['authors']}}}",
            f"  title     = {{{e['title']}}}",
            f"  year      = {{{e['year']}}}",
        ]
        if e["type"] == "article":
            if e["venue"]:    lines.append(f"  journal   = {{{e['venue']}}}")
            if e["volume"]:   lines.append(f"  volume    = {{{e['volume']}}}")
            if e["issue"]:    lines.append(f"  number    = {{{e['issue']}}}")
            if e["pages"]:    lines.append(f"  pages     = {{{e['pages']}}}")
        elif e["type"] == "book":
            if e["publisher"]: lines.append(f"  publisher = {{{e['publisher']}}}")
        out.append(f"@{e['type']}{{{e['key']},\n" + ",\n".join(lines) + "\n}\n")
    return "\n".join(out)


def main(argv):
    if len(argv) != 3:
        print("usage: extract_thebibliography.py <input.tex> <output.bib>", file=sys.stderr)
        return 2
    tex = Path(argv[1]).read_text(encoding="utf-8", errors="replace")
    entries = extract(tex)
    Path(argv[2]).write_text(render(entries), encoding="utf-8")
    print(f"extracted {len(entries)} entries -> {argv[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
