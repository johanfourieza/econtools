# EconTools

Custom skills for [Claude Code](https://claude.com/claude-code) designed for economics research workflows.

This folder is the development home for six skills (`diebolt`, `ehrstyle`, `janluiten`, `kris`, `tanniedi`, `tyler`) that have subfolders below.

## Skills in this folder

Each of these has a subfolder here that mirrors the installed copy in `~/.claude/skills/`. Edits made here are the source of truth.

### Diebolt — `diebolt/`

A simulated peer review system for economics working papers, named in honour of [Claude Diebolt](https://en.wikipedia.org/wiki/Claude_Diebolt) — Research Professor at CNRS, Director of BETA, and founding Managing Editor of *Cliometrica* — whose editorial generosity gave Johan Fourie and Dieter von Fintel their first chance with their 2010 *Cliometrica* paper on inequality in the Cape Colony, and who has been a steadfast supporter of work at Stellenbosch ever since.

Diebolt creates a panel of independent referee agents — each with a distinct subspecialisation, personality, and fictitious university affiliation — who review your paper in isolation, with strict information barriers mirroring real peer review. An editor synthesises their feedback into a prioritised briefing. You choose which changes to implement, and the tool revises your LaTeX files accordingly. Accepted papers are signed off with Claude Diebolt's own *Que la force*.

The `diebolt/` folder is both source and runtime state:

- `skill.md` — the skill definition (mirrored to `~/.claude/skills/diebolt/`)
- `gurus/` — individual referee persona files
- `guru_registry.json` — registry of all reviewer personas
- `review_log.json` — history of reviews performed

**Usage:** `/diebolt`

### EHRstyle — `ehrstyle/`

A Claude Code skill that applies the *Economic History Review* house style (Notes for Contributors, Feb 2026 v1) to a LaTeX manuscript prepared for submission to the *Review*. Encodes the full style guide — anonymity, double-spacing, ≤10,000 word budget, UK -ize spelling, Oxford commas, EHR-specific capitalisation (e.g. lower-case *global financial crisis*), number and date conventions — and ships a bespoke biblatex style (`echr.bbx` + `echr.cbx`) that produces EHR footnote references with short-title form, *ibid.*/*idem* handling, surname-first bibliography, *"2nd ser."* and roman-volume treatment for pre-1992 *Economic History Review* citations, and automatic exclusion of working papers from the consolidated bibliography.

The `ehrstyle/` folder contains:

- `SKILL.md` — the skill definition, with sub-command dispatch (`paper`, `bib`, `titlepage`, `coverletter`, `check`)
- `assets/echr.bbx` + `assets/echr.cbx` — bespoke biblatex style files
- `assets/preamble-snippet.tex` — drop-in LaTeX preamble
- `assets/title-page-template.tex` — anonymous-submission title page
- `assets/cover-letter-template.tex` — cover letter for Research Exchange
- `references/style-rules.md` — verbatim §2 of the EHR Notes (spelling, punctuation, capitalisation)
- `references/bibliography-rules.md` — verbatim §3 (consolidated list + footnote form)
- `references/submission-checklist.md` — §1 and §A (anonymity, length, layout, file uploads)

**Usage:**

```
/ehrstyle paper [file]
/ehrstyle bib [file]
/ehrstyle titlepage
/ehrstyle coverletter
/ehrstyle check [file]
```

### Janluiten — `janluiten/`

A lifelong sounding board for research ideas, named in honour of [Jan Luiten van Zanden](https://www.uu.nl/staff/JLvanZanden) — Professor of Global Economic History at Utrecht University, mentor to a generation of economic historians, and Johan Fourie's own PhD advisor (Utrecht, 2012). At his Utrecht valedictory dinner, van Zanden was described as a scholar of unusual **intuition** — always a few years ahead of the field on the topics he chose, from environmental economics to gender to inequality. The skill is built in that image.

Janluiten helps you decide whether the idea on your desk is the right one to spend your next year on. He listens first, then asks — drawing on three things: the long view of how research programs rise and fall, cultural evolution (how prestige and conformity quietly steer what fields work on), and behavioural science (how researchers misread their own motives). The deliverable is mentorship on three questions: *what* to work on, *with whom*, and *why*. The axiom underneath all of it is that **interest is the best predictor of success**.

The `janluiten/` folder contains:

- `skill.md` — the skill definition
- `references/` — reading material the skill draws on at runtime (van Zanden's writings and related sources)

Use whenever you have a research idea — at any career stage, from a first paper to a senior pivot — and want help distilling whether it is the right one for you.

**Usage:** `/janluiten`

### Kris — `kris/`

A reference auditor that catches hallucinated and chimeric entries in `.bib` files. Kris runs Claude and Codex (GPT-5.4) agents in parallel using **two genuinely independent verification methods**, randomly assigns references to Codex so no Claude/Codex pair shares a batch, and stages an adversarial challenge round where the two sides review each other's evidence and either concede or refute with concrete counter-evidence. The output is a scorecard plus an evidence-backed list of confirmed fakes — designed so no hallucinated reference slips through silently.

- **Method Set A (Claude):** cascading API queries across CrossRef, OpenAlex, Semantic Scholar, and arXiv, with title-Jaccard similarity, author-lastname overlap, and red-flag heuristics (invalid DOI format, future year, generic-title patterns, suspect-venue list, DOI conflict).
- **Method Set B (Codex / GPT-5.4):** DOI resolution against the publisher landing page, reverse search of the exact title, Retraction Watch lookup, author-existence cross-check via ORCID, venue and citation-graph plausibility, Internet Archive corroboration, and ISBN check via OpenLibrary.

The two method sets are designed to be non-overlapping, so a fake that defeats one almost certainly trips the other.

**Acknowledgments.** The design of Kris builds on two earlier projects whose authors deserve direct credit:

- [PHY041/claude-skill-citation-checker](https://github.com/PHY041/claude-skill-citation-checker) — the inspiration for Method Set A. The API-cascade approach (CrossRef + OpenAlex + Semantic Scholar), the title-Jaccard threshold, the author-overlap heuristic, and several of the red-flag checks all trace back to this project.
- [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills) — the inspiration for Method Set B. The contextual cross-model verification, mandatory integrity gates, and the broader idea of running a second model with a different methodology to catch what the first missed all draw on this project.

The orchestration on top — running both methods in parallel, randomly reassigning references between sides, and staging an adversarial challenge round on disagreements — is original to this skill. Named after my late father, Kris.

The `kris/` folder contains:

- `skill.md` — the skill definition and orchestrator instructions
- `scripts/` — eight Python helpers (`parse_bib.py`, `assign.py`, `api_lookup.py`, `reconcile.py`, `scorecard.py`, `render_report.py`, `extract_thebibliography.py`, `extract_codex_jsonl.py`)
- `templates/` — Claude and Codex subagent prompts plus the Claude/Codex challenge-round prompts
- `tests/fixtures/` — a 10-reference test fixture (`mixed.bib`) with known REAL/FAKE/CHIMERIC/borderline cases and a cheat-sheet for grading

**Usage:** `/kris path/to/refs.bib` — or `/kris path/to/paper.tex` (auto-finds the `.bib`)

### TannieDi — `tanniedi/`

A LaTeX-to-Word round-trip tool for language editing. *Pack* converts your LaTeX project into a clean Word manuscript for Di Kilpert; *unpack* applies the editor's tracked changes back into your original `.tex` files — preserving LaTeX formatting, equations, and cross-references.

The `tanniedi/` folder contains only `skill.md`.

**Usage:**

```
/tanniedi pack
/tanniedi unpack
```

### Tyler — `tyler/`

A literature-review helper that converts a folder of academic PDFs into a token-efficient markdown wiki, so Claude Code can read the papers cheaply when working on a project. Named in honour of economist Tyler Cowen — a famously voracious reader whose [Marginal Revolution](https://marginalrevolution.com) blog pioneered the practice of rapid, generous synthesis across fields.

Point Tyler at a folder of PDFs and it produces one `.md` file per paper plus a `summary.txt` index, letting you load literature into context without burning tokens on raw PDF parsing.

The `tyler/` folder contains:

- `SKILL.md` — the skill definition
- `convert.py` — the PDF-to-markdown conversion script
- `summary.txt` — template/example summary index

**Usage:** `/tyler`

## License

MIT
