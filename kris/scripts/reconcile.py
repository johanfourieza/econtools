#!/usr/bin/env python3
"""Join Claude + Codex per-ref verdicts and classify each pair.

Inputs: every kris/claude/agent_*.jsonl and kris/codex/agent_*.jsonl.
Optional inputs: kris/challenge/claude_challenges.jsonl and codex_challenges.jsonl
                 — if present, post-challenge verdicts are also reconciled and the
                 final adjudication is recorded in `final_*` fields.

Output: kris/reconciliation.json with one record per ref_id + the contested list.

Joint label table (initial verdicts):

    Claude          Codex          Joint
    ──────          ─────          ─────
    REAL            REAL           AGREE_REAL
    FAKE            FAKE           AGREE_FAKE
    CHIMERIC        CHIMERIC       AGREE_CHIMERIC
    REAL            FAKE/CHIMERIC  CONTESTED
    FAKE/CHIMERIC   REAL           CONTESTED
    FAKE            CHIMERIC       CONTESTED_DEGREE
    CHIMERIC        FAKE           CONTESTED_DEGREE
    *               UNCERTAIN      → inherits other side's verdict + flagged
    UNCERTAIN       UNCERTAIN      UNCERTAIN_BOTH

Final adjudication (after challenge round, optional):

    Claude.challenge_response  Codex.challenge_response  Final
    ─────────────────────────  ────────────────────────  ─────
    CONCEDE                    *                         use Codex.final_verdict
    *                          CONCEDE                   use Claude.final_verdict
    REFUTE                     REFUTE                    UNRESOLVED
    STILL_UNCERTAIN            STILL_UNCERTAIN           UNRESOLVED
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

VALID_VERDICTS = {"REAL", "CHIMERIC", "FAKE", "UNCERTAIN"}


def load_jsonl_dir(d: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not d.exists():
        return out
    # Match exactly agent_NN.jsonl (verdict files only) — NOT agent_NN_dossier.jsonl etc.
    import re as _re
    files = [f for f in sorted(d.glob("agent_*.jsonl")) if _re.fullmatch(r"agent_\d+\.jsonl", f.name)]
    for f in files:
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                rec.setdefault("_source_file", f.name)
                out.append(rec)
            except json.JSONDecodeError:
                pass
    return out


def load_jsonl_file(p: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not p.exists():
        return out
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return out


def initial_joint_label(c_v: str, x_v: str) -> str:
    if c_v == x_v and c_v in VALID_VERDICTS and c_v != "UNCERTAIN":
        return f"AGREE_{c_v}"
    if c_v == "UNCERTAIN" and x_v == "UNCERTAIN":
        return "UNCERTAIN_BOTH"
    if c_v == "UNCERTAIN":
        return f"UNCERTAIN_CLAUDE_INHERITS_{x_v}"
    if x_v == "UNCERTAIN":
        return f"UNCERTAIN_CODEX_INHERITS_{c_v}"
    if {c_v, x_v} == {"FAKE", "CHIMERIC"}:
        return "CONTESTED_DEGREE"
    return "CONTESTED"


def needs_challenge(label: str) -> bool:
    return label.startswith("CONTESTED") or label == "UNCERTAIN_BOTH"


def final_label(c_initial: str, x_initial: str, c_chal: dict | None, x_chal: dict | None) -> tuple[str, str]:
    """Return (final_verdict, final_label)."""
    cresp = (c_chal or {}).get("challenge_response")
    xresp = (x_chal or {}).get("challenge_response")
    cfinal = (c_chal or {}).get("final_verdict") or c_initial
    xfinal = (x_chal or {}).get("final_verdict") or x_initial

    if cresp == "CONCEDE" and xresp == "CONCEDE":
        # both concede — use whichever is more specific (CHIMERIC > FAKE > REAL > UNCERTAIN)
        for v in ("CHIMERIC", "FAKE", "REAL", "UNCERTAIN"):
            if v in (cfinal, xfinal):
                return v, f"FINAL_{v}_BOTH_CONCEDED"
        return "UNCERTAIN", "FINAL_UNCERTAIN"
    if cresp == "CONCEDE":
        return xfinal, f"FINAL_{xfinal}_CLAUDE_CONCEDED"
    if xresp == "CONCEDE":
        return cfinal, f"FINAL_{cfinal}_CODEX_CONCEDED"
    if cresp == "REFUTE" and xresp == "REFUTE":
        return "UNRESOLVED", "UNRESOLVED_BOTH_REFUTE"
    if "STILL_UNCERTAIN" in (cresp, xresp):
        return "UNRESOLVED", "UNRESOLVED_LINGERING_UNCERTAINTY"
    # No challenge run yet — use the initial reconciliation result.
    # Agreement: trivially the agreed verdict.
    if c_initial == x_initial and c_initial in VALID_VERDICTS:
        return c_initial, f"AGREE_{c_initial}"
    # One side UNCERTAIN, other certain: the certain side wins (no challenge needed).
    if c_initial == "UNCERTAIN" and x_initial in VALID_VERDICTS:
        return x_initial, f"AGREE_{x_initial}_CLAUDE_UNCERTAIN"
    if x_initial == "UNCERTAIN" and c_initial in VALID_VERDICTS:
        return c_initial, f"AGREE_{c_initial}_CODEX_UNCERTAIN"
    # Both UNCERTAIN with no challenge round having run yet — surface as UNCERTAIN.
    if c_initial == "UNCERTAIN" and x_initial == "UNCERTAIN":
        return "UNCERTAIN", "UNCERTAIN_BOTH_NO_CHALLENGE"
    # Genuinely contested with no challenge — flag for the orchestrator to run Phase 4.
    return "UNRESOLVED", "UNRESOLVED_NO_CHALLENGE"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("kris_dir")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    kris = Path(args.kris_dir)
    refs_path = kris / "refs.json"
    if not refs_path.exists():
        print(f"error: {refs_path} not found", file=sys.stderr)
        return 1
    refs = {r["ref_id"]: r for r in json.loads(refs_path.read_text(encoding="utf-8")).get("refs", [])}

    claude = {r["ref_id"]: r for r in load_jsonl_dir(kris / "claude") if r.get("ref_id")}
    codex = {r["ref_id"]: r for r in load_jsonl_dir(kris / "codex") if r.get("ref_id")}

    chal_c = {r["ref_id"]: r for r in load_jsonl_file(kris / "challenge" / "claude_challenges.jsonl") if r.get("ref_id")}
    chal_x = {r["ref_id"]: r for r in load_jsonl_file(kris / "challenge" / "codex_challenges.jsonl") if r.get("ref_id")}

    rows: list[dict[str, Any]] = []
    contested_ids: list[str] = []
    for rid, ref in refs.items():
        c = claude.get(rid)
        x = codex.get(rid)
        c_v = (c or {}).get("verdict", "UNCERTAIN")
        x_v = (x or {}).get("verdict", "UNCERTAIN")
        if c_v not in VALID_VERDICTS:
            c_v = "UNCERTAIN"
        if x_v not in VALID_VERDICTS:
            x_v = "UNCERTAIN"
        initial_label = initial_joint_label(c_v, x_v)
        cc = chal_c.get(rid)
        xc = chal_x.get(rid)
        f_v, f_label = final_label(c_v, x_v, cc, xc)
        if needs_challenge(initial_label) and not (cc or xc):
            contested_ids.append(rid)
        rows.append({
            "ref_id": rid,
            "bib_key": ref.get("bib_key"),
            "title": ref.get("title", ""),
            "claude_initial": {
                "verdict": c_v,
                "confidence": (c or {}).get("confidence"),
                "evidence": (c or {}).get("evidence", []),
                "missing": c is None,
            },
            "codex_initial": {
                "verdict": x_v,
                "confidence": (x or {}).get("confidence"),
                "evidence": (x or {}).get("evidence", []),
                "missing": x is None,
            },
            "initial_label": initial_label,
            "needs_challenge": needs_challenge(initial_label) and not (cc or xc),
            "claude_challenge": cc,
            "codex_challenge": xc,
            "final_verdict": f_v,
            "final_label": f_label,
        })

    summary = {
        "n": len(rows),
        "AGREE_REAL": sum(1 for r in rows if r["initial_label"] == "AGREE_REAL"),
        "AGREE_FAKE": sum(1 for r in rows if r["initial_label"] == "AGREE_FAKE"),
        "AGREE_CHIMERIC": sum(1 for r in rows if r["initial_label"] == "AGREE_CHIMERIC"),
        "CONTESTED": sum(1 for r in rows if r["initial_label"] == "CONTESTED"),
        "CONTESTED_DEGREE": sum(1 for r in rows if r["initial_label"] == "CONTESTED_DEGREE"),
        "UNCERTAIN_BOTH": sum(1 for r in rows if r["initial_label"] == "UNCERTAIN_BOTH"),
        "UNCERTAIN_INHERITED": sum(
            1 for r in rows if r["initial_label"].startswith("UNCERTAIN_") and r["initial_label"] != "UNCERTAIN_BOTH"
        ),
        "UNRESOLVED": sum(1 for r in rows if r["final_verdict"] == "UNRESOLVED"),
        "FINAL_REAL": sum(1 for r in rows if r["final_verdict"] == "REAL"),
        "FINAL_FAKE": sum(1 for r in rows if r["final_verdict"] == "FAKE"),
        "FINAL_CHIMERIC": sum(1 for r in rows if r["final_verdict"] == "CHIMERIC"),
        "FINAL_UNCERTAIN": sum(1 for r in rows if r["final_verdict"] == "UNCERTAIN"),
    }

    out_path = Path(args.out) if args.out else kris / "reconciliation.json"
    out_path.write_text(json.dumps({"summary": summary, "contested_ids": contested_ids, "rows": rows}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"reconciled {len(rows)} refs -> {out_path}")
    print(f"  AGREE_REAL={summary['AGREE_REAL']}  AGREE_FAKE={summary['AGREE_FAKE']}  AGREE_CHIMERIC={summary['AGREE_CHIMERIC']}")
    print(f"  CONTESTED={summary['CONTESTED']}  CONTESTED_DEGREE={summary['CONTESTED_DEGREE']}  UNCERTAIN_BOTH={summary['UNCERTAIN_BOTH']}")
    print(f"  needs_challenge={len(contested_ids)}  unresolved_post_challenge={summary['UNRESOLVED']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
