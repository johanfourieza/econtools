# EconTools

Custom skills for [Claude Code](https://claude.com/claude-code) designed for economics research workflows.

This folder is the development home for five skills (`diebolt`, `ehrstyle`, `janluiten`, `tanniedi`, `tyler`) that have subfolders below. Other skills listed at the end live only in the global skills directory (`~/.claude/skills/`).

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

## Other custom skills (global only)

These live in `~/.claude/skills/` and have no subfolder here. Short summaries:

- **`/leapstyle`** — Apply the LEAP Economics house style to LaTeX working papers, beamer slides, R graphs, and academic writing. Covers preambles, colour palette, ggplot2 theme, and writing guidelines.
- **`/leapletter`** — Create a reference letter or formal letter on LEAP letterhead, using the LaTeX letterhead template with logo, accent strip, watermark, and signature block.
- **`/olwstyle`** — Apply the Our Long Walk house style to R graphs, beamer slides, and blog writing for [ourlongwalk.com](https://www.ourlongwalk.com). Colour palette, graph theme, beamer template, writing voice, content guidelines.
- **`/olwsocial`** — Build a social media package from an Our Long Walk blog post. Produces platform-specific text posts (LinkedIn, X, Substack Notes, Instagram), quote cards, and adapted graphs.
- **`/deploy-jf`** — Deploy [johanfourie.com](https://www.johanfourie.com): renders changed Quarto pages, commits, and pushes to GitHub Pages.
- **`/deslop`** — Remove AI writing patterns from prose. Invoke when drafting, editing, or reviewing any text to strip out predictable AI tells.
- **`/avoid-ai-writing`** — Audit and rewrite existing content to remove "AI-isms" — the formulaic patterns that give AI-generated prose away.

## License

MIT
