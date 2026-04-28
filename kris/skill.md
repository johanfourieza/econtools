---
name: kris
description: Catches hallucinated, chimeric, and otherwise broken references in .bib files. Runs Claude and Codex (GPT-5.4) agents in parallel using two genuinely independent verification methods, randomly assigns references to Codex so there are no fixed agent pairs, and stages an adversarial challenge round wherever they disagree. Produces an evidence-backed scorecard so no fake slips through silently. Trigger with "/kris path/to/refs.bib" or "/kris path/to/paper.tex".
user-invocable: true
---

# /kris — Hallucinated reference catcher

You are orchestrating a multi-agent reference audit. The user has invoked `/kris` on a `.bib` file (or a `.tex` paper that points to one). Your job is to:

1. Parse the bibliography and assign references to two competing audit teams.
2. Spawn `k` Claude subagents (Method Set A — multi-database API cascade) **and** `k` Codex tasks (Method Set B — DOI resolution + reverse search + retraction + ORCID + venue/citation-graph plausibility + Internet Archive + ISBN). They work in parallel without seeing each other's verdicts.
3. Reconcile their verdicts. Where they disagree, run an **adversarial challenge round** where each side reads the other's evidence and either concedes or refutes with concrete counter-evidence.
4. Render a final report + competition scorecard. Surface unresolved disagreements prominently.

The framing is a competition: the side with more correct unique catches wins. But the goal is not to "win" — the goal is that **no hallucinated reference slips through silently** because both sides looked at it with different methods.

The skill lives at `~/.claude/skills/kris/`. All helper scripts and templates referenced below are in `{SKILL_DIR}/scripts/` and `{SKILL_DIR}/templates/`.

## Invocation

- `/kris path/to/refs.bib` — run on this .bib
- `/kris path/to/paper.tex` — auto-detect `\bibliography{…}` or `\addbibresource{…}` directive and use that .bib
- `/kris` (no arg) — ask the user which file to use; default to scanning the current working directory for `.bib` files

Optional flags after the path:
- `--no-codex` — skip the Codex side entirely (degraded mode; warn loudly in REPORT.md)
- `--seed N` — reproducible Codex assignment (default: current epoch)
- `--batch-size 10` — refs per agent (default 10; min 5; max 20)
- `--max-agents 20` — cap on parallel agents per side (default 20)
- `--resume` — reuse `assignment.json` and `cache/`; only re-run refs missing a verdict
- `--strict` — in the final REPORT, treat UNCERTAIN as suspicious-by-default

Resolve the home directory portably: `HOME_DIR="${USERPROFILE:-$HOME}"` (this prefers `$USERPROFILE` on Windows where `$HOME` may map to a Dropbox drive, and falls back to `$HOME` on Unix). Set `SKILL_DIR="$HOME_DIR/.claude/skills/kris"` and `CODEX_BIN="$HOME_DIR/.claude/plugins/cache/openai-codex/codex/1.0.1/scripts/codex-companion.mjs"`. Set `KRIS_DIR="<dir-of-bib>/kris"`. Create `KRIS_DIR` and these subdirectories: `claude/`, `claude/prompts/`, `codex/`, `codex/prompts/`, `codex/work/`, `challenge/`, `challenge/prompts/`, `cache/`.

---

## Phase 1 — Locate, parse, assign

1. **Locate the .bib.** If the user passed a `.tex`, read it and grep for `\bibliography{...}` and `\addbibresource{...}`. If multiple `.bib` files are referenced, ask the user which to audit. If the user passed a `.bib`, use it directly. If the user passed nothing, list `.bib` files under the current working directory (depth ≤ 2) and ask.

2. **Verify Codex availability.** Check that `$CODEX_BIN` (resolved above) exists with `[ -f "$CODEX_BIN" ]`. If it doesn't (or the user passed `--no-codex`), set `CODEX_AVAILABLE=false` and warn loudly in the final report. Do NOT silently fall back.

   **Windows note:** the upstream `codex-companion.mjs` plugin had a bug where `lib/app-server.mjs` called `spawn("codex", ["app-server"], …)` without `shell: true`, so Node could not resolve `codex.cmd` via `PATHEXT` and every Codex task failed with `spawn codex ENOENT`. The fix is a one-line addition (`shell: process.platform === "win32"`) at the spawn site. If you see `ENOENT` errors on Windows, check that the patch is still in place — plugin updates will overwrite it.

3. **Parse the bib:**
   ```bash
   python "$SKILL_DIR/scripts/parse_bib.py" "$INPUT_BIB" "$KRIS_DIR/refs.json"
   ```

4. **Build assignments:**
   ```bash
   python "$SKILL_DIR/scripts/assign.py" "$KRIS_DIR/refs.json" "$KRIS_DIR/assignment.json" \
     --batch-size 10 --max-agents 20 [--seed $SEED]
   ```
   Read `assignment.json`. It tells you `k` (number of agents per side), and gives you per-agent ref_id lists for Claude (contiguous batches) and Codex (random permutation chunks).

5. **Tell the user** how many refs you parsed, how many agents you'll spawn per side, and the seed used. Example:
   > Parsed 87 refs from `references.bib`. Spawning 9 Claude subagents and 9 Codex tasks (10 refs each, last batch 7). Seed=1714233601. Max Claude/Codex batch overlap: 1 ref.

---

## Phase 2 — Parallel verification

This phase runs Method Set A and Method Set B simultaneously. **Both sides launch in a single message containing all `2k` tool calls** so they run concurrently under the harness's tool-call concurrency.

### Build the prompts

For each Claude agent `n` in `1..k`:
1. Read `{SKILL_DIR}/templates/claude_subagent_prompt.md` and substitute placeholders:
   - `{{AGENT_N}}` → `n`
   - `{{AGENT_N_PADDED}}` → `n` zero-padded to 2 digits (e.g. `01`)
   - `{{K}}` → total agent count
   - `{{REF_IDS_CSV}}` → comma-joined ref_ids for this Claude agent's batch (from `assignment.json` → `claude[n-1].ref_ids`)
   - `{{SKILL_DIR}}` → absolute path to skill folder
   - `{{KRIS_DIR}}` → absolute path to the run's kris/ folder
2. Save the substituted prompt at `{KRIS_DIR}/claude/prompts/agent_{n_padded}.md` for audit.

For each Codex agent `n` in `1..k`:
1. Read `{SKILL_DIR}/templates/codex_prompt.xml` and substitute placeholders:
   - `{{AGENT_N}}`, `{{AGENT_N_PADDED}}`, `{{K}}`
   - `{{REF_IDS_CSV}}` → from `assignment.json` → `codex[n-1].ref_ids`
   - `{{INPUT_BIB}}` → absolute path to the input .bib
   - `{{KRIS_DIR}}` → absolute path to kris/
2. Save the substituted prompt at `{KRIS_DIR}/codex/prompts/agent_{n_padded}.xml`.

### Launch in a single message

Issue **all** `2k` tool calls together (one message, multiple `tool_use` blocks):

- For each Claude agent: an Agent tool call with `subagent_type: general-purpose`. Pass the substituted prompt from `agent_{n_padded}.md` as the `prompt` parameter. The description should be e.g. `Claude ref-audit agent 3`.
- For each Codex agent: a Bash tool call:
  ```bash
  node "$CODEX_BIN" task \
      --read-only \
      --model gpt-5.4 \
      --effort medium \
      "$(cat '{KRIS_DIR}/codex/prompts/agent_{n_padded}.xml')"
  ```
  The Bash description should be e.g. `Codex ref-audit agent 3`. You don't need to capture stdout — Codex writes its JSONL directly to its output file.

If `--no-codex` was passed, skip the Codex Bash calls but still issue all Claude Agent calls.

### After both sides finish

Read each agent's output file:
- `{KRIS_DIR}/claude/agent_{n_padded}.jsonl` (one JSONL line per ref the agent verdicted)
- `{KRIS_DIR}/codex/agent_{n_padded}.jsonl`

Sanity check: every ref_id in `assignment.json` must have exactly one Claude verdict and (unless `--no-codex`) exactly one Codex verdict. If any are missing, surface this to the user — do NOT mark the missing refs REAL by default.

If a Claude agent crashed mid-batch, re-issue an Agent call for the missing refs only.
If a Codex task timed out, re-issue with `--effort high`. If it still fails, those refs are recorded as UNCERTAIN with evidence "codex timeout".

---

## Phase 3 — Reconcile

```bash
python "$SKILL_DIR/scripts/reconcile.py" "$KRIS_DIR"
```

This produces `{KRIS_DIR}/reconciliation.json`. The `contested_ids` field lists ref_ids that need the adversarial challenge round.

Tell the user the headline numbers:
> Reconciliation: 14 AGREE_REAL, 8 AGREE_FAKE, 3 AGREE_CHIMERIC, 4 CONTESTED, 1 UNCERTAIN_BOTH. Launching adversarial challenge round on 5 contested refs.

If `contested_ids` is empty, skip Phase 4 and go directly to Phase 5.

---

## Phase 4 — Adversarial challenge round

For each ref_id in `contested_ids`, prepare two prompts and launch them **in parallel** (single message containing both calls per ref, or all `2 × |contested|` calls in one message if |contested| is small).

### Build the prompts (per contested ref)

Look up the row in `reconciliation.json`. You'll need the ref's title/authors/year, Claude's initial evidence, Codex's initial evidence.

For the Claude challenge prompt (`{SKILL_DIR}/templates/challenge_prompt_claude.md`), substitute:
- `{{REF_ID}}`, `{{BIB_KEY}}`
- `{{CLAUDE_VERDICT}}`, `{{CLAUDE_CONFIDENCE}}`
- `{{CODEX_VERDICT}}`, `{{CODEX_CONFIDENCE}}`
- `{{REF_DISPLAY}}` → a 5-line summary of the .bib entry (title, authors, year, journal, doi)
- `{{CLAUDE_EVIDENCE_BLOCK}}` → markdown rendering of Claude's initial `evidence` array
- `{{CODEX_EVIDENCE_BLOCK}}` → markdown rendering of Codex's initial `evidence` array
- `{{KRIS_DIR}}`

For the Codex challenge prompt (`{SKILL_DIR}/templates/challenge_prompt_codex.xml`), substitute the same fields plus `{{INPUT_BIB}}`.

Save both substituted prompts to `{KRIS_DIR}/challenge/prompts/{ref_id}_claude.md` and `{KRIS_DIR}/challenge/prompts/{ref_id}_codex.xml` for audit.

### Launch

For each contested ref, in a single message:
- Agent call (`subagent_type: general-purpose`) with the Claude challenge prompt.
- Bash call: `node "$CODEX_BIN" task --read-only --model gpt-5.4 --effort high "$(cat <codex challenge prompt path>)"`

If there are many contested refs (>5), you may batch them — but every ref's two challenge calls go in the same message so they run concurrently. The Codex output is appended to `{KRIS_DIR}/challenge/codex_challenges.jsonl`; the Claude output is appended to `{KRIS_DIR}/challenge/claude_challenges.jsonl`. The agents do this themselves per their prompt instructions.

### Re-reconcile

Run `reconcile.py` again. It picks up the challenge files and updates `final_verdict` / `final_label` on every row. Items where both sides REFUTE (or both STILL_UNCERTAIN) become `UNRESOLVED` — these go to `disagreements.md` and need human review.

```bash
python "$SKILL_DIR/scripts/reconcile.py" "$KRIS_DIR"
```

---

## Phase 5 — Score and report

```bash
python "$SKILL_DIR/scripts/scorecard.py" "$KRIS_DIR"
python "$SKILL_DIR/scripts/render_report.py" "$KRIS_DIR" "$INPUT_BIB"
```

This produces:
- `{KRIS_DIR}/REPORT.md` — top-line summary, scorecard, sample fakes, sample chimerics, unresolved
- `{KRIS_DIR}/scorecard.md` and `scorecard.json` — competition scorecard
- `{KRIS_DIR}/fake_references.md` — every confirmed FAKE with full evidence
- `{KRIS_DIR}/chimeric_references.md` — every confirmed CHIMERIC with corrections suggested
- `{KRIS_DIR}/disagreements.md` — UNRESOLVED items with all four pieces of evidence
- `{KRIS_DIR}/<bibname>_kris_annotated.bib` — copy of input .bib with `%KRIS:` comments per entry

### Final message to user

End your turn with a short summary:
- One line per category count (REAL / CHIMERIC / FAKE / UNCERTAIN / UNRESOLVED).
- The Champion (Claude or Codex) and unique-catch counts.
- Direct path to `REPORT.md`, `fake_references.md`, `chimeric_references.md`, and `disagreements.md`.
- If there are UNRESOLVED items, name them up front and ask the user whether to (a) launch a third tie-breaker agent (a fresh Claude agent with a third method — e.g., scholarly Web Search via WebSearch + reading the publisher's PDF directly), or (b) leave them for manual review.

---

## Reconciliation rules (truth table)

| Claude initial | Codex initial | Joint label |
|---|---|---|
| REAL | REAL | `AGREE_REAL` |
| FAKE | FAKE | `AGREE_FAKE` |
| CHIMERIC | CHIMERIC | `AGREE_CHIMERIC` |
| REAL | FAKE / CHIMERIC | `CONTESTED` |
| FAKE / CHIMERIC | REAL | `CONTESTED` |
| FAKE | CHIMERIC (or vice versa) | `CONTESTED_DEGREE` |
| any | UNCERTAIN | inherits the certain side, but flagged |
| UNCERTAIN | UNCERTAIN | `UNCERTAIN_BOTH` (queue for adversarial round) |

After challenge:

| Claude challenge_response | Codex challenge_response | Final |
|---|---|---|
| CONCEDE | * | use Codex's `final_verdict` |
| * | CONCEDE | use Claude's `final_verdict` |
| REFUTE | REFUTE | `UNRESOLVED` |
| STILL_UNCERTAIN | STILL_UNCERTAIN | `UNRESOLVED` |

---

## Edge cases & failure modes

- **N ≤ 10:** `k = 1` — one Claude agent and one Codex agent see the same refs but use different methods. Random reassignment is trivially identity. This is fine.
- **N > 200:** the assigner caps `k = 20`; per-agent batches will be > 10. Tell the user, and offer to split the .bib into halves and run twice if they prefer ≤ 10/agent.
- **Codex unavailable:** Already handled in Phase 1. The skill still produces a useful (but degraded) report; the top of REPORT.md gets a `⚠️  WARNING: Codex unavailable — single-method audit only` banner.
- **WebFetch / API failures:** recorded as evidence (`fetch failed: <reason>`). Never inferred as evidence of fakeness on its own.
- **BibTeX parse error:** `parse_bib.py` records `parse_error: true` and ships the entry through anyway. Both sides will mark it UNCERTAIN.
- **`@misc` / `@unpublished` / `@techreport`:** API cascade often returns nothing legitimately. Both methods should lean toward UNCERTAIN unless a strong red flag is present.
- **Resume after partial failure:** `--resume` reuses `assignment.json` and `cache/`; only refs missing a verdict on either side are re-run. Reproducibility is exact for the deterministic parts.

---

## Hard requirements (do not violate)

1. **Never modify the input .bib.** All annotations go in `{bibname}_kris_annotated.bib`, a copy.
2. **Codex side is launched without seeing Claude's verdicts** in Phase 2. Only the challenge round shows each side the other's evidence.
3. **Random assignment is mandatory.** Never let the orchestrator pair Claude agent `n` with Codex agent `n` on the same ref batch — that defeats the cross-check. The `assign.py` algorithm guarantees max-overlap ≤ 1 for k ≥ 5.
4. **Evidence is mandatory for FAKE / CHIMERIC verdicts** — every such verdict cites at least one URL queried plus a metric or quoted excerpt. The agent prompts enforce this; you should not relax it in your final report.
5. **UNRESOLVED items are surfaced prominently.** Never silently drop a contested ref because both sides refused to back down. The whole point of the skill is to ensure no fake slips through unnoticed.
6. **Do not "average" disagreements.** This is not a voting system; it is an evidence-based adjudication. Conceding requires saying so explicitly; refuting requires concrete counter-evidence.

---

## What good looks like

- The user gets a one-page `REPORT.md` they can paste into a co-author email.
- Every entry in `fake_references.md` is something the user would not want to cite — and the evidence makes it clear why.
- `chimeric_references.md` is actionable: it tells the user how to fix each broken metadata block.
- `disagreements.md` (when non-empty) is the single most valuable file — it surfaces refs that are *genuinely hard* to verify and where human judgment is needed.
- The competition scorecard tells a story about which method caught what — useful both for trust calibration and for tuning future runs.

If the user re-runs `/kris --resume` later, the report is byte-identical for the deterministic portions and only re-runs network calls for refs that haven't been verdicted yet.
