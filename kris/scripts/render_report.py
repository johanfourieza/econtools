#!/usr/bin/env python3
"""Render the user-facing reports from reconciliation.json + scorecard.

Outputs:
  REPORT.md                    one-page summary with scorecard + counts + top fakes
  fake_references.md           every confirmed FAKE with both sides' evidence
  chimeric_references.md       every confirmed CHIMERIC with corrections suggested
  disagreements.md             every UNRESOLVED ref with all four pieces of evidence
  refs_kris_annotated.bib      copy of the input .bib with %KRIS: comments added
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def fmt_evidence(evlist: list[dict[str, Any]] | None) -> str:
    if not evlist:
        return "_(no evidence recorded)_\n"
    out = []
    for ev in evlist:
        step = ev.get("step", "?")
        url = ev.get("url", "")
        result = ev.get("result", "")
        snippet = (ev.get("snippet") or ev.get("quote") or "").strip()
        metric = ev.get("metric", "")
        line = f"- **{step}**"
        if url:
            line += f" — `{url}`"
        if result:
            line += f" → {result}"
        if metric:
            line += f"  _(metric: {metric})_"
        out.append(line)
        if snippet:
            quoted = snippet.replace("\n", " ")
            if len(quoted) > 280:
                quoted = quoted[:280] + "…"
            out.append(f"  > {quoted}")
    return "\n".join(out) + "\n"


def render_ref_block(row: dict[str, Any]) -> str:
    bk = row.get("bib_key", "?")
    title = row.get("title", "")
    rid = row.get("ref_id", "?")
    ci = row.get("claude_initial", {}) or {}
    xi = row.get("codex_initial", {}) or {}
    cc = row.get("claude_challenge")
    xc = row.get("codex_challenge")
    parts = [
        f"### `{bk}` — _{title}_",
        f"`{rid}` · final verdict: **{row.get('final_verdict','?')}**  ({row.get('final_label','')})",
        "",
        f"**Claude initial** ({ci.get('verdict','?')}, conf={ci.get('confidence','?')})",
        fmt_evidence(ci.get("evidence")),
        f"**Codex initial** ({xi.get('verdict','?')}, conf={xi.get('confidence','?')})",
        fmt_evidence(xi.get("evidence")),
    ]
    if cc:
        parts += [
            f"**Claude challenge response** ({cc.get('challenge_response','?')}; final={cc.get('final_verdict','?')})",
            fmt_evidence(cc.get("evidence")),
        ]
    if xc:
        parts += [
            f"**Codex challenge response** ({xc.get('challenge_response','?')}; final={xc.get('final_verdict','?')})",
            fmt_evidence(xc.get("evidence")),
        ]
    return "\n".join(parts) + "\n---\n"


def render_top_report(rec: dict, scorecard: dict) -> str:
    s = rec.get("summary", {})
    rows = rec.get("rows", [])
    fakes = [r for r in rows if r.get("final_verdict") == "FAKE"]
    chim = [r for r in rows if r.get("final_verdict") == "CHIMERIC"]
    unres = [r for r in rows if r.get("final_verdict") == "UNRESOLVED"]

    lines = [
        "# /kris reference audit — REPORT",
        "",
        f"**Champion: {scorecard.get('champion','?')}**  ·  refs scanned: **{s.get('n', 0)}**",
        "",
        "| Final verdict | Count |",
        "|---|---|",
        f"| REAL      | {s.get('FINAL_REAL', 0)} |",
        f"| CHIMERIC  | {s.get('FINAL_CHIMERIC', 0)} |",
        f"| FAKE      | {s.get('FINAL_FAKE', 0)} |",
        f"| UNCERTAIN | {s.get('FINAL_UNCERTAIN', 0)} |",
        f"| UNRESOLVED (human review needed) | {s.get('UNRESOLVED', 0)} |",
        "",
        "## Scorecard",
        "",
        f"|                       | Claude | Codex |",
        f"|-----------------------|--------|-------|",
        f"| Initial flags         | {scorecard.get('claude',{}).get('initial_flags',0):>6} | {scorecard.get('codex',{}).get('initial_flags',0):>5} |",
        f"| Confirmed catches     | {scorecard.get('claude',{}).get('confirmed_catches',0):>6} | {scorecard.get('codex',{}).get('confirmed_catches',0):>5} |",
        f"| Unique catches        | {scorecard.get('claude',{}).get('unique_catches',0):>6} | {scorecard.get('codex',{}).get('unique_catches',0):>5} |",
        f"| Concessions           | {scorecard.get('claude',{}).get('concessions',0):>6} | {scorecard.get('codex',{}).get('concessions',0):>5} |",
        f"| Refutations upheld    | {scorecard.get('claude',{}).get('refutations_upheld',0):>6} | {scorecard.get('codex',{}).get('refutations_upheld',0):>5} |",
        "",
    ]
    if fakes:
        lines += ["## Top fakes (sample)", ""]
        for r in fakes[:8]:
            lines.append(f"- `{r.get('bib_key','?')}` — _{(r.get('title') or '')[:120]}_")
        lines.append("")
        lines.append("→ Full evidence in `fake_references.md`.")
        lines.append("")
    if chim:
        lines += ["## Chimeric references (sample)", ""]
        for r in chim[:8]:
            lines.append(f"- `{r.get('bib_key','?')}` — _{(r.get('title') or '')[:120]}_")
        lines.append("")
        lines.append("→ Full evidence + corrections in `chimeric_references.md`.")
        lines.append("")
    if unres:
        lines += [
            "## ⚠️  Unresolved disagreements",
            "",
            f"{len(unres)} reference(s) did not converge after the adversarial challenge round.",
            "Each requires human adjudication. See `disagreements.md`.",
            "",
        ]
        for r in unres[:6]:
            lines.append(f"- `{r.get('bib_key','?')}` — _{(r.get('title') or '')[:120]}_")
        lines.append("")
    return "\n".join(lines)


def render_subreport(rows: list[dict[str, Any]], heading: str, blurb: str) -> str:
    out = [f"# {heading}", "", blurb, ""]
    if not rows:
        out.append("_(none)_")
        return "\n".join(out) + "\n"
    for r in rows:
        out.append(render_ref_block(r))
    return "\n".join(out)


def render_annotated_bib(input_bib: Path, rows_by_key: dict[str, dict]) -> str:
    text = input_bib.read_text(encoding="utf-8", errors="replace")
    out_lines = []
    i = 0
    n = len(text)
    while i < n:
        # Find next entry head
        at = text.find("@", i)
        if at < 0:
            out_lines.append(text[i:])
            break
        out_lines.append(text[i:at])
        # Find the bib key
        head_end = text.find("{", at)
        comma = text.find(",", head_end + 1) if head_end >= 0 else -1
        if head_end < 0 or comma < 0:
            out_lines.append(text[at:])
            break
        bk = text[head_end + 1: comma].strip()
        row = rows_by_key.get(bk)
        if row:
            verdict = row.get("final_verdict", "?")
            conf = row.get("claude_initial", {}).get("confidence")
            note = f"%KRIS: {verdict}"
            if conf is not None:
                note += f" (claude_conf={conf})"
            note += f" — see kris/REPORT.md\n"
            out_lines.append(note)
        # Advance to end of entry
        depth = 0
        j = head_end
        while j < n:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        out_lines.append(text[at:j])
        i = j
    return "".join(out_lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("kris_dir")
    ap.add_argument("input_bib")
    args = ap.parse_args()

    kris = Path(args.kris_dir)
    rec = json.loads((kris / "reconciliation.json").read_text(encoding="utf-8"))
    sc_path = kris / "scorecard.json"
    scorecard = json.loads(sc_path.read_text(encoding="utf-8")) if sc_path.exists() else {"champion": "?"}

    rows = rec.get("rows", [])
    fakes = [r for r in rows if r.get("final_verdict") == "FAKE"]
    chim = [r for r in rows if r.get("final_verdict") == "CHIMERIC"]
    unres = [r for r in rows if r.get("final_verdict") == "UNRESOLVED"]

    (kris / "REPORT.md").write_text(render_top_report(rec, scorecard), encoding="utf-8")
    (kris / "fake_references.md").write_text(
        render_subreport(fakes, "Confirmed FAKE references", "Both verification methods (or one with the other conceding) judged these to be fabricated. Evidence below; treat as do-not-cite unless human review overturns."),
        encoding="utf-8",
    )
    (kris / "chimeric_references.md").write_text(
        render_subreport(chim, "Confirmed CHIMERIC references", "These references map to a real paper, but the .bib metadata is wrong (mismatched title, authors, year, or DOI). Fix the entry; do not delete."),
        encoding="utf-8",
    )
    (kris / "disagreements.md").write_text(
        render_subreport(unres, "UNRESOLVED disagreements", "Claude and Codex did not converge even after the adversarial challenge round. Each needs human review with both bodies of evidence below."),
        encoding="utf-8",
    )

    rows_by_key = {r["bib_key"]: r for r in rows if r.get("bib_key")}
    annotated = render_annotated_bib(Path(args.input_bib), rows_by_key)
    out_bib = kris / (Path(args.input_bib).stem + "_kris_annotated.bib")
    out_bib.write_text(annotated, encoding="utf-8")

    print(f"reports -> {kris}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
