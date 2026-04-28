#!/usr/bin/env python3
"""Method Set A helper: query CrossRef, OpenAlex, Semantic Scholar, arXiv for a
batch of references; cache responses; compute title/author similarity and red
flags; emit a structured per-ref dossier the Claude subagent then verdicts on.

Stdlib only (urllib) so it runs anywhere with Python 3.10+.

Usage:
    python api_lookup.py lookup <refs.json> <ref_ids_csv> <cache_dir> <output_jsonl>

The orchestrator passes the comma-separated ref_ids assigned to each Claude
agent. Output is one JSON object per ref_id (jsonl), with all four databases'
responses + computed metrics. The Claude subagent reads this jsonl, applies
judgment, and writes its final verdict jsonl alongside.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

USER_AGENT = "kris-citation-checker/0.1 (mailto:johanf@sun.ac.za)"
HTTP_TIMEOUT = 30.0
S2_BACKOFF_FIRST = 5.0
S2_BACKOFF_SECOND = 10.0

STOPWORDS = {
    "a", "an", "the", "of", "for", "and", "or", "in", "on", "to", "from",
    "by", "with", "is", "are", "was", "were", "be", "as", "at", "this",
    "that", "those", "these", "via", "using", "based", "approach",
}

GENERIC_TITLE = re.compile(
    r"^(a comprehensive (?:survey|review)|towards |on the |a (?:novel |new )?framework for )",
    re.IGNORECASE,
)
DOI_VALID = re.compile(r"^10\.\d{4,9}/[^\s]+$")
SUSPECT_VENUES = {
    "journal of ai reasoning",
    "international journal of advanced reasoning",
    "transactions on artificial intelligence",
    "global journal of computer science research",
    "journal of multimodal foundation models",
    "world journal of economics and policy",
}


# ────────────────────────────────────────────────────────────────────────
# HTTP + caching
# ────────────────────────────────────────────────────────────────────────

def cache_key(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]


def http_get(url: str, cache_dir: Path, service: str) -> tuple[int, str]:
    sub = cache_dir / service
    sub.mkdir(parents=True, exist_ok=True)
    cf = sub / f"{cache_key(url)}.json"
    if cf.exists():
        try:
            payload = json.loads(cf.read_text(encoding="utf-8"))
            return payload["status"], payload["body"]
        except Exception:
            pass
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            status = resp.getcode()
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
    except Exception as e:
        status = 0
        body = f"FETCH_ERROR: {type(e).__name__}: {e}"
    cf.write_text(json.dumps({"url": url, "status": status, "body": body}), encoding="utf-8")
    return status, body


# ────────────────────────────────────────────────────────────────────────
# Similarity & heuristics
# ────────────────────────────────────────────────────────────────────────

def normalise(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^\w\s]", " ", s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokenise(s: str) -> set[str]:
    toks = set(normalise(s).split())
    return {t for t in toks if t and t not in STOPWORDS}


def jaccard(a: str, b: str) -> float:
    A, B = tokenise(a), tokenise(b)
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


def author_overlap(claim_lastnames: list[str], retrieved_authors: list[str]) -> float:
    if not claim_lastnames:
        return 0.0
    claim = {normalise(x).split()[-1] for x in claim_lastnames if x}
    got: set[str] = set()
    for a in retrieved_authors:
        n = normalise(a)
        if not n:
            continue
        # API authors may be "First Last" or {family,given} — take last token
        got.add(n.split()[-1])
    if not got:
        return 0.0
    inter = len(claim & got)
    return inter / max(len(claim), 1)


def red_flags(ref: dict) -> list[str]:
    flags: list[str] = []
    title = (ref.get("title") or "").strip()
    year = ref.get("year")
    doi = (ref.get("doi") or "").strip()
    authors = ref.get("authors") or []
    journal = (ref.get("journal") or "").strip().lower()
    if doi and not DOI_VALID.match(doi):
        flags.append("invalid_doi_format")
    if year and isinstance(year, int) and year > time.gmtime().tm_year + 1:
        flags.append("future_year")
    if title and GENERIC_TITLE.search(title):
        flags.append("generic_title_pattern")
    if not authors:
        flags.append("missing_authors")
    if not year:
        flags.append("missing_year")
    if any(len(a.replace(",", " ").split()) < 2 for a in authors if a):
        flags.append("single_token_author_name")
    if journal and journal in SUSPECT_VENUES:
        flags.append("suspect_venue")
    if ref.get("type", "").lower() == "article" and not journal:
        flags.append("article_without_journal")
    return flags


# ────────────────────────────────────────────────────────────────────────
# API queries
# ────────────────────────────────────────────────────────────────────────

def query_crossref(ref: dict, cache_dir: Path) -> dict[str, Any]:
    out: dict[str, Any] = {"service": "crossref", "queries": []}
    doi = (ref.get("doi") or "").strip()
    if doi:
        url = f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='/')}"
        status, body = http_get(url, cache_dir, "crossref")
        out["queries"].append({"mode": "doi", "url": url, "status": status})
        if status == 200:
            try:
                msg = json.loads(body).get("message", {})
                out["match_doi"] = {
                    "title": " ".join(msg.get("title") or []) or "",
                    "authors": [
                        f"{a.get('given','')} {a.get('family','')}".strip()
                        for a in msg.get("author", [])
                    ],
                    "year": (msg.get("issued", {}).get("date-parts") or [[None]])[0][0],
                    "journal": " ".join(msg.get("container-title") or []) or "",
                    "doi": msg.get("DOI", "").lower(),
                }
            except Exception:
                pass
    title = ref.get("title") or ""
    if title and not out.get("match_doi"):
        q = urllib.parse.quote(title)
        url = f"https://api.crossref.org/works?query.title={q}&rows=5"
        status, body = http_get(url, cache_dir, "crossref")
        out["queries"].append({"mode": "title", "url": url, "status": status})
        if status == 200:
            try:
                items = json.loads(body).get("message", {}).get("items", [])
                cands = []
                for it in items[:5]:
                    cand_title = " ".join(it.get("title") or [])
                    cands.append({
                        "title": cand_title,
                        "title_jaccard": round(jaccard(title, cand_title), 3),
                        "authors": [
                            f"{a.get('given','')} {a.get('family','')}".strip()
                            for a in it.get("author", [])
                        ],
                        "year": (it.get("issued", {}).get("date-parts") or [[None]])[0][0],
                        "doi": it.get("DOI", "").lower(),
                    })
                out["title_candidates"] = cands
                if cands:
                    best = max(cands, key=lambda c: c["title_jaccard"])
                    out["best_title_match"] = best
            except Exception:
                pass
    return out


def query_openalex(ref: dict, cache_dir: Path) -> dict[str, Any]:
    out: dict[str, Any] = {"service": "openalex", "queries": []}
    doi = (ref.get("doi") or "").strip()
    title = ref.get("title") or ""
    if doi:
        url = f"https://api.openalex.org/works/doi:{urllib.parse.quote(doi, safe='/')}"
        status, body = http_get(url, cache_dir, "openalex")
        out["queries"].append({"mode": "doi", "url": url, "status": status})
        if status == 200:
            try:
                w = json.loads(body)
                out["match_doi"] = {
                    "title": w.get("title", ""),
                    "authors": [a.get("author", {}).get("display_name", "") for a in w.get("authorships", [])],
                    "year": w.get("publication_year"),
                    "journal": (w.get("primary_location") or {}).get("source", {}).get("display_name", ""),
                    "doi": (w.get("doi") or "").replace("https://doi.org/", "").lower(),
                    "cited_by_count": w.get("cited_by_count"),
                }
            except Exception:
                pass
    if title and not out.get("match_doi"):
        q = urllib.parse.quote(title)
        url = f"https://api.openalex.org/works?search={q}&per-page=5"
        status, body = http_get(url, cache_dir, "openalex")
        out["queries"].append({"mode": "title", "url": url, "status": status})
        if status == 200:
            try:
                items = json.loads(body).get("results", [])
                cands = []
                for w in items[:5]:
                    t = w.get("title", "") or ""
                    cands.append({
                        "title": t,
                        "title_jaccard": round(jaccard(title, t), 3),
                        "authors": [a.get("author", {}).get("display_name", "") for a in w.get("authorships", [])],
                        "year": w.get("publication_year"),
                        "doi": (w.get("doi") or "").replace("https://doi.org/", "").lower(),
                        "cited_by_count": w.get("cited_by_count"),
                    })
                out["title_candidates"] = cands
                if cands:
                    out["best_title_match"] = max(cands, key=lambda c: c["title_jaccard"])
            except Exception:
                pass
    return out


def query_semantic_scholar(ref: dict, cache_dir: Path) -> dict[str, Any]:
    out: dict[str, Any] = {"service": "semantic_scholar", "queries": []}
    doi = (ref.get("doi") or "").strip()
    title = ref.get("title") or ""
    fields = "title,authors,year,venue,externalIds,citationCount"

    def fetch(url: str, mode: str) -> dict | None:
        status, body = http_get(url, cache_dir, "semantic_scholar")
        out["queries"].append({"mode": mode, "url": url, "status": status})
        if status == 429:
            time.sleep(S2_BACKOFF_FIRST)
            status, body = http_get(url + "&__retry=1", cache_dir, "semantic_scholar")
            out["queries"].append({"mode": mode + "_retry1", "url": url, "status": status})
            if status == 429:
                time.sleep(S2_BACKOFF_SECOND)
                status, body = http_get(url + "&__retry=2", cache_dir, "semantic_scholar")
                out["queries"].append({"mode": mode + "_retry2", "url": url, "status": status})
        if status == 200:
            try:
                return json.loads(body)
            except Exception:
                return None
        return None

    if doi:
        url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{urllib.parse.quote(doi, safe='/')}?fields={fields}"
        data = fetch(url, "doi")
        if data:
            out["match_doi"] = {
                "title": data.get("title", ""),
                "authors": [a.get("name", "") for a in data.get("authors", [])],
                "year": data.get("year"),
                "venue": data.get("venue", ""),
                "doi": ((data.get("externalIds") or {}).get("DOI") or "").lower(),
                "citation_count": data.get("citationCount"),
            }
    if title and not out.get("match_doi"):
        q = urllib.parse.quote(title)
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={q}&limit=5&fields={fields}"
        data = fetch(url, "title")
        if data:
            cands = []
            for it in data.get("data", [])[:5]:
                t = it.get("title", "") or ""
                cands.append({
                    "title": t,
                    "title_jaccard": round(jaccard(title, t), 3),
                    "authors": [a.get("name", "") for a in it.get("authors", [])],
                    "year": it.get("year"),
                    "venue": it.get("venue", ""),
                    "doi": ((it.get("externalIds") or {}).get("DOI") or "").lower(),
                    "citation_count": it.get("citationCount"),
                })
            out["title_candidates"] = cands
            if cands:
                out["best_title_match"] = max(cands, key=lambda c: c["title_jaccard"])
    return out


def query_arxiv(ref: dict, cache_dir: Path) -> dict[str, Any]:
    out: dict[str, Any] = {"service": "arxiv", "queries": []}
    arxiv_id = (ref.get("arxiv_id") or "").strip()
    title = ref.get("title") or ""
    if arxiv_id:
        url = f"http://export.arxiv.org/api/query?id_list={urllib.parse.quote(arxiv_id)}"
        status, body = http_get(url, cache_dir, "arxiv")
        out["queries"].append({"mode": "id", "url": url, "status": status})
        if status == 200 and "<entry>" in body:
            t = re.search(r"<title>(.*?)</title>", body, re.DOTALL)
            authors = re.findall(r"<name>(.*?)</name>", body)
            out["match_id"] = {
                "title": (t.group(1).strip() if t else "")[:300],
                "authors": authors[:10],
            }
    if title and not out.get("match_id"):
        q = urllib.parse.quote(f'ti:"{title}"')
        url = f"http://export.arxiv.org/api/query?search_query={q}&max_results=3"
        status, body = http_get(url, cache_dir, "arxiv")
        out["queries"].append({"mode": "title", "url": url, "status": status})
        if status == 200:
            entries = re.findall(r"<entry>(.*?)</entry>", body, re.DOTALL)
            cands = []
            for e in entries[:3]:
                t = re.search(r"<title>(.*?)</title>", e, re.DOTALL)
                authors = re.findall(r"<name>(.*?)</name>", e)
                ct = (t.group(1).strip() if t else "")[:300]
                cands.append({
                    "title": ct,
                    "title_jaccard": round(jaccard(title, ct), 3),
                    "authors": authors[:10],
                })
            out["title_candidates"] = cands
            if cands:
                out["best_title_match"] = max(cands, key=lambda c: c["title_jaccard"])
    return out


# ────────────────────────────────────────────────────────────────────────
# Orchestration
# ────────────────────────────────────────────────────────────────────────

def assemble_dossier(ref: dict, cache_dir: Path) -> dict[str, Any]:
    title = ref.get("title") or ""
    authors_ln = ref.get("author_lastnames") or []

    cr = query_crossref(ref, cache_dir)
    oa = query_openalex(ref, cache_dir)
    s2 = query_semantic_scholar(ref, cache_dir)
    ax = query_arxiv(ref, cache_dir) if (ref.get("arxiv_id") or "arxiv" in (ref.get("url", "").lower())) else {"service": "arxiv", "skipped": True}

    # Compute per-source match summary
    def summarise(src: dict) -> dict:
        summary = {"service": src.get("service")}
        match = src.get("match_doi") or src.get("match_id") or src.get("best_title_match")
        if match:
            summary["matched"] = True
            summary["matched_title"] = match.get("title", "")
            summary["title_jaccard"] = round(jaccard(title, match.get("title", "")), 3)
            summary["author_overlap"] = round(author_overlap(authors_ln, match.get("authors", [])), 3)
            summary["matched_year"] = match.get("year")
            summary["matched_doi"] = match.get("doi")
            summary["matched_venue"] = match.get("journal") or match.get("venue") or ""
            summary["citation_count"] = match.get("cited_by_count") or match.get("citation_count")
        else:
            summary["matched"] = False
        return summary

    summaries = {
        "crossref": summarise(cr),
        "openalex": summarise(oa),
        "semantic_scholar": summarise(s2),
        "arxiv": summarise(ax) if not ax.get("skipped") else {"service": "arxiv", "skipped": True, "matched": False},
    }

    matched_sources = sum(1 for s in summaries.values() if s.get("matched"))
    best_title_jaccard = max(
        (s.get("title_jaccard") or 0.0) for s in summaries.values() if s.get("matched")
    ) if matched_sources else 0.0
    best_author_overlap = max(
        (s.get("author_overlap") or 0.0) for s in summaries.values() if s.get("matched")
    ) if matched_sources else 0.0

    # DOI-conflict detection: ref claims DOI X but the resolved DOI's title/authors don't match
    doi_conflict = None
    claimed_doi = (ref.get("doi") or "").lower().strip()
    for src_name, src in (("crossref", cr), ("openalex", oa), ("semantic_scholar", s2)):
        m = src.get("match_doi")
        if m and claimed_doi and m.get("doi") == claimed_doi:
            tj = jaccard(title, m.get("title", ""))
            ao = author_overlap(authors_ln, m.get("authors", []))
            if tj < 0.5 or ao < 0.3:
                doi_conflict = {
                    "service": src_name,
                    "claimed_doi": claimed_doi,
                    "resolved_title": m.get("title", ""),
                    "resolved_authors": m.get("authors", []),
                    "title_jaccard": round(tj, 3),
                    "author_overlap": round(ao, 3),
                }
                break

    flags = red_flags(ref)
    if doi_conflict:
        flags.append("doi_conflict")

    # Heuristic confidence (the agent will reconsider; this is just a baseline)
    base = 0.5 if matched_sources else 0.0
    base += 0.2 * min(matched_sources, 2)
    if best_title_jaccard >= 0.85:
        base += 0.10
    if best_author_overlap >= 0.30:
        base += 0.10
    base -= 0.10 * len(flags)
    if best_title_jaccard >= 0.85 and best_author_overlap < 0.10:
        base -= 0.30
    base = max(0.0, min(1.0, base))

    # Heuristic verdict
    if matched_sources >= 2 and best_title_jaccard >= 0.85 and best_author_overlap >= 0.30 and not doi_conflict:
        suggested = "REAL"
    elif doi_conflict or (best_title_jaccard >= 0.85 and best_author_overlap < 0.30):
        suggested = "CHIMERIC"
    elif matched_sources == 0 and (flags or not title):
        suggested = "FAKE"
    elif matched_sources == 0:
        suggested = "FAKE" if flags else "UNCERTAIN"
    else:
        suggested = "UNCERTAIN"

    return {
        "ref_id": ref["ref_id"],
        "bib_key": ref.get("bib_key"),
        "title": title,
        "authors_claimed": ref.get("authors", []),
        "year_claimed": ref.get("year"),
        "doi_claimed": claimed_doi,
        "type": ref.get("type"),
        "summaries": summaries,
        "raw": {
            "crossref": cr,
            "openalex": oa,
            "semantic_scholar": s2,
            "arxiv": ax,
        },
        "metrics": {
            "matched_sources": matched_sources,
            "best_title_jaccard": round(best_title_jaccard, 3),
            "best_author_overlap": round(best_author_overlap, 3),
            "doi_conflict": doi_conflict,
            "red_flags": flags,
            "heuristic_confidence": round(base, 3),
            "suggested_verdict": suggested,
        },
    }


def cmd_lookup(args: argparse.Namespace) -> int:
    refs_path = Path(args.refs_json)
    cache_dir = Path(args.cache_dir)
    out_path = Path(args.output_jsonl)
    payload = json.loads(refs_path.read_text(encoding="utf-8"))
    ref_index = {r["ref_id"]: r for r in payload.get("refs", [])}
    ref_ids = [x.strip() for x in args.ref_ids.split(",") if x.strip()]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for rid in ref_ids:
            ref = ref_index.get(rid)
            if not ref:
                f.write(json.dumps({"ref_id": rid, "error": "not_found_in_refs_json"}) + "\n")
                continue
            t0 = time.time()
            dossier = assemble_dossier(ref, cache_dir)
            dossier["elapsed_ms"] = int((time.time() - t0) * 1000)
            f.write(json.dumps(dossier, ensure_ascii=False) + "\n")
    print(f"wrote dossiers for {len(ref_ids)} refs -> {out_path}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("lookup", help="Build dossiers for a batch of ref_ids")
    p.add_argument("refs_json")
    p.add_argument("ref_ids", help="comma-separated list of ref_ids")
    p.add_argument("cache_dir")
    p.add_argument("output_jsonl")
    p.set_defaults(func=cmd_lookup)
    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
