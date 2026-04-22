# EHR Submission Checklist — §A and §1 of the Notes

This file consolidates the submission-process and layout rules from the
*Economic History Review* Notes for Contributors (Feb 2026 v1), so that
Claude (and the author) can check a draft against them before upload.

---

## 1. Files and uploads

Submit via <https://wiley.atyponrex.com/journal/EHR>.

### First submission: either LaTeX OR Word

**Main document** (main `.tex` or `.docx`) must include:
- Article title
- Abstract (**maximum 200 words**)
- Main text
- Footnotes (using Word Footnotes/Endnotes feature, or LaTeX `\footnote`)
- Tables positioned at the relevant place in the text (if possible)
- Figures positioned at the relevant place in the text (if possible)
- Bibliography

**Title page** (separate file, uploaded as 'Title page') must include:
- Author's/authors' names
- Institutional affiliations
- Acknowledgements
(The electronic submission system automatically ensures this file is
not sent to referees.)

**Also required for upload**:
- A two-sentence summary of the article
- A 280-character tweet-type statement

### EHS membership

- At least ONE author must be a member of the Economic History Society.
- The membership number must be included in the cover letter and
  uploaded at submission.

### File names

- Must not contain any identifying information about the author(s).

---

## 2. Anonymity (rule 1.2)

**Absolute requirement** — papers failing this are rejected without review.

- The text of an article MUST be anonymous.
- NO acknowledgement or self-referencing in the main text or footnotes
  of the initial submission.
- If referring to data on an author's website: do NOT give the exact
  web address; simply note that such a website exists.
- Only the title page contains author names and acknowledgements.

### Common self-references to strip from a draft

| Self-flag | Replacement |
|---|---|
| "we thank" / "we are grateful to" | Move entirely to title page |
| "in our earlier paper" | "in [cited work]" |
| "one of us" / "one of the authors" | Rephrase impersonally |
| "[author]'s website" | "a companion website" or remove |
| Thanks footnote on title | Delete; move to title page |

### Self-citations

Citing one's own previous work is allowed (referees won't know the
author). But the TEXT must not flag the citation as one's own.

---

## 3. Length (rule 1.3)

- **Articles**: ≤10,000 words including footnotes.
  Excluded from this count: tables, figures, bibliography, appendices.
- **Notes and comments**: ≤2,500 words.
- Authors MUST inform the Editors of the exact length.
- The editors may accept longer articles where convincing justification
  is given, but normally expect initial submission to be under 10,000.
- For *Surveys and Speculations*, longer pieces may be accepted; flag
  in the cover letter.

### Word counting

Run word count on the main `.tex` with footnotes included, excluding:
- preamble
- bibliography
- any tables / figures captions
- appendices

A rough command:

```bash
pdftotext main.pdf - | awk '/BIBLIOGRAPHY/{exit} {print}' | wc -w
```

---

## 4. Layout (rule 1.1)

- **Double-spaced** with a wide margin.
- LaTeX: `\usepackage{setspace}` then `\doublespacing`.
- Margin: 1–1.25 inches.

---

## 5. Section headings (rule 1.4)

- Subsections with a brief section title in **CAPITAL LETTERS**.
- Further subdivisions of sections and subheadings not encouraged;
  accepted only where absolutely essential to readers' understanding.
- In LaTeX: `\section{INTRODUCTION}`, `\section{NARRATIVE ECONOMICS}`,
  etc.

---

## 6. Footnotes (rule 1.5)

- Confined, as far as possible, to necessary references.
- Use Word's Footnotes/Endnotes feature (NOT superscript figures typed
  into the document).
- In LaTeX: `\footnote{...}`.
- EHR does NOT use Harvard referencing — footnote references only, with
  a consolidated bibliography.

---

## 7. Tables (rule 1.6)

- Printed WITHOUT vertical rules; use horizontal rules for clarity.
- Created with Word Tables (not scanned / images / tab key).
- Submitted as a SEPARATE Word file (not embedded).
- Manual numbering (do NOT use Word's cross-reference feature — Research
  Exchange does not support it).
- Horizontal line under title, under title row, under last row.
- First column with row titles: left-justified.
- Row with column titles: centre-justified.
- Data columns: right-justified.
- Standardise digits after decimal point.
- Source always provided (using same conventions as footnotes).
- Regression tables: standard errors in parentheses under coefficient;
  asterisk explained in notes; number of observations as whole numbers.

---

## 8. Figures and maps (rule 1.7)

- Clearly drawn; colour permitted.
- Full-page proportions: **7 × 4 inches (20.0 × 12.4 cm)**.
- Maps: scale must be indicated.
- Figures: consider log vs natural scale (e.g. for growth rates).
- Axes always labelled.
- Sources always provided.
- Separate file, preferably Word format.
- On acceptance: Excel with data for graphs; `.eps` or `.tif` for other
  figures; halftones ≥300 dpi, line art ≥800 dpi in final version.

---

## 9. Cross-referencing (rule 1.8)

- Use "footnote 34" or "see above in section II" — NOT page numbers.
- Reason: Early View pagination differs from final print pagination.
- LaTeX `\ref{}` and `\label{}` on sections works; avoid `\pageref{}`.

---

## 10. Acknowledgements (rule 1.9)

- In the FINAL version: separate paragraph at the end of the article.
- In INITIAL submission: ONLY in the Title page file.

---

## 11. What §1 vs §2–3 require at initial submission

Per the §B intro of the Notes:

> Initial submissions of papers for publication must at least comply
> with rules 1.1 to 1.3 in Section B on **length, layout and anonymity**.
> Other elements of the style guide can be applied later where a paper
> is close to acceptance for publication.

So at first submission the non-negotiables are:
- Rule 1.1 (double-spaced, wide margin)
- Rule 1.2 (anonymity)
- Rule 1.3 (length)

Everything else (numbering conventions, Oxford commas, -ize spelling,
bibliography format) is *desirable* at submission and *required* on
acceptance. `/ehrstyle` aims for full conformance from the start because
Johan prefers to deliver a clean draft.
