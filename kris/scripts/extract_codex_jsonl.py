#!/usr/bin/env python3
"""Extract JSONL verdict records from a Codex task's stdout file.

Codex's `<action_safety>` requires writing to a per-agent JSONL output file. On
some Windows harnesses the shell-write tool denies the filesystem operation —
in that case Codex's fallback is to emit the JSONL records inline in stdout
("Assistant message captured: {...}" style).

This script accepts a stdout file (the harness's task output dump) and emits a
clean JSONL file containing only the records that match the kris verdict schema.

Usage:
    python extract_codex_jsonl.py <stdout.txt> <agent.jsonl>
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Both initial verdict records and challenge-round records share these three
# fields. Initial records carry "verdict"; challenge records carry "final_verdict"
# and "challenge_response". Keep REQUIRED minimal so both pass through.
REQUIRED = {"ref_id", "bib_key", "side"}


def find_json_objects(text: str) -> list[dict]:
    """Greedy brace-matched extraction of top-level JSON objects.

    Codex's streaming logs include truncated previews like
        Assistant message captured: {"ref_id":"...","verdict":"RE...
    (open brace, no matching close). When we hit such an unmatched start, we
    must advance past it and keep scanning — otherwise we lose the well-formed
    records that appear later in the file.
    """
    out = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] == "{":
            depth = 0
            in_string = False
            escape = False
            j = i
            matched = False
            while j < n:
                c = text[j]
                if in_string:
                    if escape:
                        escape = False
                    elif c == "\\":
                        escape = True
                    elif c == '"':
                        in_string = False
                elif c == '"':
                    in_string = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        snippet = text[i: j + 1]
                        try:
                            obj = json.loads(snippet)
                            if isinstance(obj, dict) and REQUIRED.issubset(obj.keys()):
                                out.append(obj)
                        except Exception:
                            pass
                        matched = True
                        break
                j += 1
            # If we balanced, jump past the closing brace; otherwise advance one
            # char so we can find later, valid records past the truncated stub.
            i = (j + 1) if matched else (i + 1)
        else:
            i += 1
    return out


def find_jsonl_lines(text: str) -> list[dict]:
    """Cheap line-based pass: parse any line that is itself a complete JSON
    object containing our required fields. This handles the Codex stdout
    fallback where the agent prints the JSONL record on its own line."""
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("{") or not s.endswith("}"):
            continue
        try:
            obj = json.loads(s)
        except Exception:
            continue
        if isinstance(obj, dict) and REQUIRED.issubset(obj.keys()):
            out.append(obj)
    return out


def main(argv):
    if len(argv) != 3:
        print("usage: extract_codex_jsonl.py <stdout.txt> <agent.jsonl>", file=sys.stderr)
        return 2
    src = Path(argv[1])
    dst = Path(argv[2])
    text = src.read_text(encoding="utf-8", errors="replace")
    # Try the line-based pass first (fast, robust for the common case where
    # Codex prints each verdict on its own line). Fall back to brace-walking
    # for pretty-printed multi-line JSON if line-based finds nothing.
    records = find_jsonl_lines(text)
    if not records:
        records = find_json_objects(text)
    # Dedupe by ref_id, keep last occurrence (later Codex turns refine earlier ones).
    seen: dict[str, dict] = {}
    for r in records:
        if r.get("side") == "codex":
            seen[r["ref_id"]] = r
    if not seen:
        print(f"warning: no Codex JSONL records found in {src}", file=sys.stderr)
        return 1
    dst.parent.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for rid in sorted(seen):
            f.write(json.dumps(seen[rid], ensure_ascii=False) + "\n")
    print(f"extracted {len(seen)} records -> {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
