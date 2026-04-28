#!/usr/bin/env python3
"""Build Claude+Codex batch assignments for kris.

Claude side: contiguous deterministic batches.
Codex side:  seeded random permutation, then contiguous chunks → random reassignment
             so no Claude/Codex pair shares a batch.

Usage:
    python assign.py <refs.json> <assignment.json> [--seed N] [--batch-size 10] [--max-agents 20]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from pathlib import Path


def build_assignment(refs: list[dict], seed: int, batch_size: int, max_agents: int) -> dict:
    n = len(refs)
    if n == 0:
        return {"seed": seed, "n": 0, "k": 0, "batch_size": batch_size, "claude": [], "codex": []}

    # Determine k: try one agent per batch_size refs, but cap at max_agents.
    k = min(max_agents, max(1, math.ceil(n / batch_size)))
    # Resulting per-agent size — may exceed batch_size if we hit the cap.
    per_agent = math.ceil(n / k)

    ref_ids = [r["ref_id"] for r in refs]

    # Claude: contiguous slice of original order
    claude_batches = []
    for i in range(k):
        chunk = ref_ids[i * per_agent: (i + 1) * per_agent]
        if chunk:
            claude_batches.append({"agent_n": i + 1, "ref_ids": chunk})

    # Codex: seeded permutation, then chunked. We re-roll up to 8 times to ensure
    # max overlap with any Claude batch is small (<=2 refs for k>=3).
    rng = random.Random(seed)
    permutation = ref_ids.copy()
    best_perm = None
    best_max_overlap = n + 1
    target = 1 if k >= 5 else 2
    for _ in range(8):
        rng.shuffle(permutation)
        codex_chunks = [permutation[i * per_agent: (i + 1) * per_agent] for i in range(k)]
        # Compute worst overlap between any (claude_i, codex_j)
        worst = 0
        for cb in claude_batches:
            cset = set(cb["ref_ids"])
            for cx in codex_chunks:
                ov = len(cset.intersection(cx))
                if ov > worst:
                    worst = ov
        if worst < best_max_overlap:
            best_max_overlap = worst
            best_perm = permutation.copy()
        if worst <= target:
            break
    permutation = best_perm or permutation
    codex_batches = []
    for i in range(k):
        chunk = permutation[i * per_agent: (i + 1) * per_agent]
        if chunk:
            codex_batches.append({"agent_n": i + 1, "ref_ids": chunk})

    return {
        "seed": seed,
        "n": n,
        "k": k,
        "per_agent": per_agent,
        "batch_size": batch_size,
        "max_overlap_claude_codex": best_max_overlap,
        "claude": claude_batches,
        "codex": codex_batches,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("refs_json")
    ap.add_argument("assignment_json")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=10)
    ap.add_argument("--max-agents", type=int, default=20)
    args = ap.parse_args()

    refs_path = Path(args.refs_json)
    out_path = Path(args.assignment_json)
    if not refs_path.exists():
        print(f"error: {refs_path} not found", file=sys.stderr)
        return 1
    seed = args.seed if args.seed is not None else int(time.time())

    payload = json.loads(refs_path.read_text(encoding="utf-8"))
    refs = payload.get("refs", [])

    assignment = build_assignment(refs, seed=seed, batch_size=args.batch_size, max_agents=args.max_agents)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(assignment, indent=2), encoding="utf-8")
    print(
        f"k={assignment['k']} agents/side, per_agent={assignment.get('per_agent', 0)}, "
        f"max-overlap(claude,codex)={assignment.get('max_overlap_claude_codex', 0)}, seed={seed}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
