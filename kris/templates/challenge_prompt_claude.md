# /kris — Claude adversarial challenge response

You earlier verdicted reference **`{{REF_ID}}` (`{{BIB_KEY}}`)** as **{{CLAUDE_VERDICT}}** with confidence {{CLAUDE_CONFIDENCE}}.

Codex (using a different methodology — DOI resolution, reverse search, retraction watch, ORCID, venue plausibility, citation graph, Internet Archive, ISBN check) verdicted it as **{{CODEX_VERDICT}}** with confidence {{CODEX_CONFIDENCE}}.

Below is **Codex's evidence**. Your job:

1. **Read it carefully and re-fetch any URLs Codex cited** (using your tools). Do Codex's quoted excerpts actually appear at those URLs? Did Codex misread a 404 page as a 200, or vice versa? Did Codex's "0 results" actually have results when you query?

2. **Decide:** does Codex's evidence beat yours, or is yours stronger?
   - If Codex is right and you were wrong, **CONCEDE** explicitly. Update your verdict to match Codex's, with reasoning.
   - If you stick with your verdict, you must **REFUTE** Codex with a concrete weakness in their evidence — not just "I disagree". Examples of valid refutations: "the URL Codex cites returns the paper Codex says doesn't exist; here is the canonical URL and the title", "Codex's reverse-search query was malformed (extra quote characters), redoing it returns the paper", "the DOI Codex says doesn't resolve does in fact resolve to the claimed paper".
   - If you genuinely cannot tell, output **STILL_UNCERTAIN** — the user will adjudicate.

3. **No bluffing.** Refuting requires concrete evidence — a URL, a quoted excerpt, a status code. Inventing a refutation is the worst possible failure here, worse than conceding incorrectly.

## Reference under dispute

```
{{REF_DISPLAY}}
```

## Your earlier evidence (Claude initial)

{{CLAUDE_EVIDENCE_BLOCK}}

## Codex's evidence (the case against your verdict)

{{CODEX_EVIDENCE_BLOCK}}

## Output (single JSONL line, no preamble)

```json
{
  "ref_id": "{{REF_ID}}",
  "bib_key": "{{BIB_KEY}}",
  "side": "claude",
  "challenge_response": "CONCEDE" | "REFUTE" | "STILL_UNCERTAIN",
  "final_verdict": "REAL" | "CHIMERIC" | "FAKE" | "UNCERTAIN",
  "final_confidence": 0.0-1.0,
  "rebuttal_summary": "1-3 sentence narrative of what you found when you re-checked Codex's claims",
  "evidence": [
    {"step": "refetch_codex_url", "url": "...", "result": "...", "quote": "..."}
  ]
}
```

Write the line to: **`{{KRIS_DIR}}/challenge/claude_challenges.jsonl`** (append). Then return a one-line confirmation as your final tool message.
