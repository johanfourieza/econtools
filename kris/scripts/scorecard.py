#!/usr/bin/env python3
"""Compute the Claude vs Codex competition scorecard from reconciliation.json.

Definitions:
- Initial flags        : count of FAKE + CHIMERIC verdicts the side issued initially.
- Confirmed catches    : count of those flags upheld in the final adjudication
                         (final_verdict ∈ {FAKE, CHIMERIC} AND this side initially
                         flagged it).
- Unique catches       : confirmed catches the OTHER side initially missed
                         (other side's initial verdict was REAL or UNCERTAIN).
- Concessions          : count of times this side conceded in the challenge round.
- Refutations upheld   : count of times this side refused to concede AND the final
                         verdict matched this side's initial verdict.
- Champion             : whichever side has the higher 'unique catches' count
                         (tie-break: confirmed catches; then: lower concessions).

Output: kris/scorecard.md (and a JSON sibling for machine reading).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

FLAGGED = {"FAKE", "CHIMERIC"}


def score_side(rows: list[dict[str, Any]], side: str) -> dict[str, Any]:
    other = "codex" if side == "claude" else "claude"
    init_key = f"{side}_initial"
    other_key = f"{other}_initial"
    chal_key = f"{side}_challenge"

    initial_flags = 0
    confirmed = 0
    unique = 0
    concessions = 0
    refutations_upheld = 0

    for r in rows:
        si = r.get(init_key, {}) or {}
        oi = r.get(other_key, {}) or {}
        ch = r.get(chal_key) or {}
        siv = si.get("verdict", "UNCERTAIN")
        oiv = oi.get("verdict", "UNCERTAIN")
        fv = r.get("final_verdict", "UNCERTAIN")

        if siv in FLAGGED:
            initial_flags += 1
        if siv in FLAGGED and fv in FLAGGED:
            confirmed += 1
            if oiv not in FLAGGED:
                unique += 1
        if ch.get("challenge_response") == "CONCEDE":
            concessions += 1
        if ch.get("challenge_response") == "REFUTE" and fv == siv:
            refutations_upheld += 1

    return {
        "initial_flags": initial_flags,
        "confirmed_catches": confirmed,
        "unique_catches": unique,
        "concessions": concessions,
        "refutations_upheld": refutations_upheld,
    }


def determine_champion(c: dict[str, Any], x: dict[str, Any]) -> str:
    if c["unique_catches"] != x["unique_catches"]:
        return "Claude" if c["unique_catches"] > x["unique_catches"] else "Codex"
    if c["confirmed_catches"] != x["confirmed_catches"]:
        return "Claude" if c["confirmed_catches"] > x["confirmed_catches"] else "Codex"
    if c["concessions"] != x["concessions"]:
        return "Codex" if c["concessions"] > x["concessions"] else "Claude"
    return "Tied"


def render_md(claude: dict[str, Any], codex: dict[str, Any], rows: list[dict[str, Any]], champion: str) -> str:
    joint = sum(
        1 for r in rows
        if (r.get("claude_initial", {}).get("verdict") in FLAGGED)
        and (r.get("codex_initial", {}).get("verdict") in FLAGGED)
        and r.get("final_verdict") in FLAGGED
    )
    one_side = sum(
        1 for r in rows
        if (r.get("claude_initial", {}).get("verdict") in FLAGGED)
        != (r.get("codex_initial", {}).get("verdict") in FLAGGED)
        and r.get("final_verdict") in FLAGGED
    )
    unresolved = sum(1 for r in rows if r.get("final_verdict") == "UNRESOLVED")

    lines = []
    lines.append("# /kris — competition scorecard\n")
    lines.append(f"**Champion: {champion}**\n")
    lines.append("")
    lines.append("|                          | Claude | Codex |")
    lines.append("|--------------------------|--------|-------|")
    lines.append(f"| Initial flags            | {claude['initial_flags']:>6} | {codex['initial_flags']:>5} |")
    lines.append(f"| Confirmed catches        | {claude['confirmed_catches']:>6} | {codex['confirmed_catches']:>5} |")
    lines.append(f"| Unique catches           | {claude['unique_catches']:>6} | {codex['unique_catches']:>5} |")
    lines.append(f"| Concessions              | {claude['concessions']:>6} | {codex['concessions']:>5} |")
    lines.append(f"| Refutations upheld       | {claude['refutations_upheld']:>6} | {codex['refutations_upheld']:>5} |")
    lines.append("")
    lines.append(f"- Joint catches (both flagged, upheld): **{joint}**")
    lines.append(f"- Caught by exactly one side (upheld): **{one_side}**")
    lines.append(f"- Unresolved (sent to human review): **{unresolved}**")
    lines.append("")
    lines.append("## How to read this")
    lines.append("")
    lines.append("- **Unique catches** is the headline number — it captures the value each side adds that the other side did not. A high count on one side means the other side has a blind spot.")
    lines.append("- **Refutations upheld** means a side stuck with its verdict during the challenge round and was vindicated in the final adjudication.")
    lines.append("- **Unresolved** items did not converge even after both sides reviewed each other's evidence; they are listed in `disagreements.md` for human review.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("kris_dir")
    args = ap.parse_args()
    kris = Path(args.kris_dir)
    rec_path = kris / "reconciliation.json"
    if not rec_path.exists():
        print(f"error: {rec_path} not found — run reconcile.py first", file=sys.stderr)
        return 1
    rec = json.loads(rec_path.read_text(encoding="utf-8"))
    rows = rec.get("rows", [])

    claude = score_side(rows, "claude")
    codex = score_side(rows, "codex")
    champion = determine_champion(claude, codex)

    md = render_md(claude, codex, rows, champion)
    (kris / "scorecard.md").write_text(md, encoding="utf-8")
    (kris / "scorecard.json").write_text(json.dumps({
        "champion": champion,
        "claude": claude,
        "codex": codex,
        "totals": rec.get("summary", {}),
    }, indent=2), encoding="utf-8")
    print(f"scorecard -> {kris / 'scorecard.md'}  (Champion: {champion})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
