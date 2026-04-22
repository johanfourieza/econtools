---
name: ehrstyle
description: Apply Economic History Review house style to a LaTeX manuscript, bibliography, title page, or cover letter. Implements the full Notes for Contributors (Feb 2026 v1), including a bespoke biblatex style (echr.bbx/echr.cbx) with EHR footnote references, surname-first bibliography, 2nd-ser. + roman-volume handling for pre-1992 EHR citations, working-paper exclusion, UK -ize spelling, Oxford commas, and specific capitalisation/number/date conventions.
user-invocable: true
argument-hint: <paper|bib|titlepage|coverletter|check> [filename]
---

# /ehrstyle — Economic History Review submission style

Use this skill when preparing a LaTeX manuscript for submission to the
*Economic History Review*. The skill encodes EHR's *Notes for
Contributors* (Feb 2026 v1), provides a bespoke biblatex style, and
templates for the separate title page and cover letter required by
Research Exchange.

## When to trigger

- User mentions *Economic History Review*, *EHR*, or *EcHR* and LaTeX.
- User says `/ehrstyle`, `/ehrstyle paper`, `/ehrstyle check`, etc.
- User asks to "format for EHR", "apply EHR style", "convert to EHR".
- User is preparing or editing a file in a folder named `EHR_submission/`
  or similar.

## Sub-commands

The skill dispatches on the first argument:

| Command | What it does |
|---|---|
| `/ehrstyle paper [file]` | Install preamble + `echr.bbx`/`echr.cbx` in the paper folder; switch `\usepackage{biblatex}` to EHR style; walk through anonymisation, double-spacing, section-title CAPS, subsection flattening. |
| `/ehrstyle bib [file]` | Audit `references.bib`: add `options = {skipbib=true}` to `@techreport`/`@unpublished`/`@misc`; add `shorttitle` fields where `title` > 5 words; check EHR journal entries for `year`/`volume` compatibility with the 2nd-ser./roman rule (§3.1.8). |
| `/ehrstyle titlepage` | Copy `assets/title-page-template.tex` into the current folder; fill in author, affiliation, acknowledgements, corresponding author. |
| `/ehrstyle coverletter` | Copy `assets/cover-letter-template.tex` into the current folder; fill in title, authors, EHS membership. |
| `/ehrstyle check [file]` | Run style audit against `references/style-rules.md` (spelling, Oxford commas, capitalisation, numbers, dates); report deviations with line numbers; do NOT auto-edit. |

No arg: run `paper` then `bib` in sequence.

---

## Installation on first use

Copy the LaTeX assets into the paper's folder:

```bash
SKILL_DIR="C:/Users/johanf/.claude/skills/ehrstyle"
cp "$SKILL_DIR/assets/echr.bbx" ./
cp "$SKILL_DIR/assets/echr.cbx" ./
```

Both files must sit next to the main `.tex` so biber can find them.

---

## 1. Paper setup (`/ehrstyle paper`)

### 1.1 Preamble

Replace any existing `\usepackage{...}{biblatex}` line with the block in
`assets/preamble-snippet.tex`. Key elements:

```latex
\documentclass[12pt]{article}
\usepackage[margin=1.25in]{geometry}
\usepackage{setspace}
\doublespacing
\usepackage[T1]{fontenc}
\usepackage{csquotes}       % required by biblatex
\usepackage[backend=biber,
            bibstyle=echr,
            citestyle=echr,
            maxcitenames=3,
            mincitenames=1,
            isbn=false, doi=false, url=false, eprint=false]{biblatex}
\addbibresource{references.bib}
```

### 1.2 Anonymisation (rule 1.2)

See `references/submission-checklist.md`, §2. Checklist:

- [ ] Remove `\thanks{...}` from title and author lines.
- [ ] Set `\author{}` to empty.
- [ ] Strip all "we thank", "we are grateful", acknowledgement paragraphs.
- [ ] Rewrite any "one of us", "our earlier work", "in [authored] work"
  phrasing.
- [ ] Remove or anonymise website URLs that would identify authors.
- [ ] Self-citations may remain as normal references (referees don't
  know the author), but the TEXT must not flag them as self-citations.

### 1.3 Layout (rule 1.1)

- `\doublespacing` (setspace package).
- `margin=1.25in`.

### 1.4 Section titles (rule 1.4)

All section titles in CAPITAL LETTERS:

```latex
\section{INTRODUCTION}
\section{NARRATIVE ECONOMICS}
```

**Flatten** `\subsection*{}` blocks — EHR discourages subdivisions.
Convert each to a paragraph transition in the prose.

### 1.5 Citation commands

Replace natbib-style commands:

| Old | New |
|---|---|
| `\citet{key}` | `\cite{key}` |
| `\citep{key}` | `\cite{key}` |
| `\citet[p.~X]{key}` | `\cite[p.~X]{key}` |
| `\bibliographystyle{...}` + `\bibliography{...}` | `\printbibliography[title={FOOTNOTE REFERENCES (BIBLIOGRAPHY)}]` |

### 1.6 Compile

```bash
pdflatex -interaction=nonstopmode main.tex
biber main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

---

## 2. Bibliography (`/ehrstyle bib`)

See `references/bibliography-rules.md` for the full EHR rules; audit
`references.bib` against it.

### 2.1 Exclude working papers (rule 3.1.1)

For every `@techreport`, `@unpublished`, `@misc`, `@online`, or similar
non-published source, add:

```bibtex
@techreport{Key2024,
  author    = {...},
  title     = {...},
  institution = {...},
  year      = {2024},
  options   = {skipbib=true}
}
```

This keeps the entry citable in footnotes but excludes it from the
printed bibliography.

### 2.2 Sentence-case titles (rule 3.1.2)

EHR bibliography uses sentence case for book and article titles.
In `references.bib`, write:

```bibtex
title = {Hall of mirrors: the {Great Depression}, the {Great Recession},
         and the uses and misuses of history}
```

Not "Hall of Mirrors: The Great Depression..." (title case).

Use brace-wrapped `{Great Depression}` and `{Great Recession}` to
preserve capitals on proper names that biber would otherwise
lower-case.

### 2.3 Short titles (rule 3.2)

Every entry whose `title` is >5 words should have a `shorttitle`
field. The echr.cbx footnote style uses `shorttitle` (via biblatex's
`labeltitle`) if present:

```bibtex
@book{Eichengreen2015,
  author     = {Barry Eichengreen},
  title      = {Hall of mirrors: the {Great Depression}, ...},
  shorttitle = {Hall of mirrors},
  year       = {2015},
  ...
}
```

### 2.4 Economic History Review special casing (rule 3.1.8)

No author action needed. `echr.bbx` automatically:

- Prepends `, 2nd ser.` to entries with
  `journaltitle = {Economic History Review}` and `year < 1992`.
- Outputs volumes as roman numerals for
  `journaltitle = {Economic History Review}` and `year < 2007`.

For this to work, the `journaltitle` field must match exactly
`Economic History Review` (not `The Economic History Review` or
`Econ. Hist. Rev.`).

### 2.5 Place of publication (rule 3.1.9)

- Set `location` or `address` field for books.
- EHR omits `London` as place; the style file auto-suppresses it.
- Brace-wrap "London" is not needed — a biber source map in
  `echr.bbx` deletes it at parse time.

### 2.6 Editors, theses, official papers

See `references/bibliography-rules.md`, §3.1.9–§3.1.14 for worked
examples. `echr.bbx` handles all @book-with-editor, @incollection,
@thesis cases automatically.

---

## 3. Title page (`/ehrstyle titlepage`)

Copy `assets/title-page-template.tex` into the paper folder; fill in:
- Title
- Author name(s) and institutional affiliations
- Acknowledgements (from the original `\thanks{}`)
- Corresponding author contact details (full postal address + email)

---

## 4. Cover letter (`/ehrstyle coverletter`)

Copy `assets/cover-letter-template.tex`; fill in:
- Title
- Short summary paragraph
- Fit with the Review (e.g., *Surveys and Speculations* section)
- Word count note (flag if >10,000)
- EHS membership number

---

## 5. Style check (`/ehrstyle check`)

Audit the main `.tex` against `references/style-rules.md`:

- **-ize/-ise**: scan for -ise, -ised, -ising, -isation endings;
  list occurrences that should be converted to -ize (excluding the
  exceptions: *analyse, comprise, expertise, likewise, otherwise,
  practise, promise, revise, surprise*, etc.)
- **Oxford comma**: flag `X, Y and Z` patterns (three-or-more item lists
  without serial comma).
- **Capitalisation**: flag `Global Financial Crisis`, `Middle Ages`,
  `Old Poor Law`, `New Poor Law` — EHR wants lower case.
- **Numbers**: flag single-digit numerals in text (e.g. `3 women`
  should be `three women`).
- **Years**: flag `YYYY–YYYY` full-year ranges that should be abbreviated
  (e.g. `1852–1872` should be `1852–72`).
- **Dates**: flag `January 30, 1938` (US style) — EHR uses
  `30 January 1938`.
- **Abbreviations**: flag `op. cit.` and `loc. cit.` (forbidden in
  footnotes).
- **Anonymity**: flag "we thank", "we are grateful", "one of us",
  "our earlier work" in the main .tex; these belong in the separate
  title page, not the anonymised text.

Report with line numbers. Do NOT auto-edit — let the author approve
each change.

---

## Reference files

- [`references/style-rules.md`](references/style-rules.md) — verbatim §2 of EHR Notes.
- [`references/bibliography-rules.md`](references/bibliography-rules.md) — verbatim §3 of EHR Notes.
- [`references/submission-checklist.md`](references/submission-checklist.md) — §A and §1.

## Asset files

- [`assets/echr.bbx`](assets/echr.bbx) — bespoke biblatex bibliography style.
- [`assets/echr.cbx`](assets/echr.cbx) — bespoke biblatex citation style.
- [`assets/preamble-snippet.tex`](assets/preamble-snippet.tex) — drop-in preamble block.
- [`assets/title-page-template.tex`](assets/title-page-template.tex) — anonymous-submission title page.
- [`assets/cover-letter-template.tex`](assets/cover-letter-template.tex) — cover letter for Research Exchange.

---

## Design rationale

- **biblatex, not BibTeX.** BibTeX + natbib cannot produce short-title
  footnote citations with ibid. handling; biblatex can.
- **Base `authortitle-ibid`, override drivers.** Writing drivers from
  scratch risks missing edge cases (multi-volume works, series, editors).
  Basing on the standard style and overriding only what EHR diverges on
  minimises bugs.
- **Source map for London suppression.** biblatex's `\iflistequalstr`
  and `\DeclareListFormat` options are fragile; a biber source map that
  deletes `location = {London}` at parse time is cleaner.
- **Roman volumes via `\mkehrroman`.** Conditional on year < 2007 AND
  journaltitle = "Economic History Review".
- **Working papers excluded via `options = {skipbib=true}`.** The rule
  3.1.1 says they "should not be listed"; biblatex's native option is
  the right mechanism.

## Notes on initial-submission vs pre-acceptance

Per the EHR Notes (Section B intro):

> Initial submissions of papers for publication must at least comply
> with rules 1.1 to 1.3 in Section B on length, layout and anonymity.
> Other elements of the style guide can be applied later where a paper
> is close to acceptance for publication.

This skill produces full-conformance output from the initial submission
because Johan prefers a clean draft. The style is overridable: if a rule
here conflicts with editor feedback on a revision, the echr.bbx/cbx
files can be edited in place and the skill updated to match.
