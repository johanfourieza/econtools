---
name: leapwp
description: Turn a finished paper into a LEAP working paper and file it on the shelf. Covers the front matter intake (co-authors, acknowledgements, AI disclosure), the title footnote and cite-as line, the author block, the aea bibliography and its full-given-names audit, versioned file naming, the clean build, and the copy into 1Research/WorkingPapers with archiving of superseded versions. Use when the user invokes $leapwp; when a finished paper must be packaged, posted, circulated or shelved; or when the user asks for a working-paper front page, a cite-as line or an AI disclosure. For shaping a paper while it is being written, use leapstyle instead.
---

# LEAP Working Paper

Take a finished paper and make it circulable: front matter, disclosure, citation,
versioned filename, clean build, shelf copy. This is the last step in a project,
not the first.

The companion skill is `leapstyle`, which shapes the paper while it is being
written. Load `leapstyle` when the question is *how should this paper read*. Load
this skill when the question is *how does this paper get posted*. This skill does
not rewrite prose or restructure a paper; if that is needed, it happens first,
under `leapstyle`.

## Read this first

Read [references/package.md](references/package.md) completely before writing
anything. It carries the whole procedure: the ten steps, the templates, the
naming scheme and the checklist.

## Core workflow

1. Locate the source manuscript and read it end to end. In a journal submission
   folder, expect the front matter to have been stripped into a separate title
   page file; harvest it rather than asking the user to retype it.
2. Run the front matter intake: co-authors, acknowledgements, AI tools used. Ask
   only about what the paper and its title page do not already carry, and never
   invent any of the three. A declaration the manuscript already makes beats the
   current config.
3. Copy the source to a new versioned filename and edit the copy. Never write over
   the file that was read.
4. Fit the preamble, title footnote, author block and title page.
5. Install `assets/aea.bst` beside the `.tex`, set `\bibliographystyle{aea}`, and
   audit the `.bib` for full given names. Resolve against sources, never from
   memory; unresolved entries are reported, not guessed, and do not hold the
   build.
6. Build with `pdflatex`, `bibtex`, `pdflatex`, `pdflatex`. The build must be
   clean: no undefined citations, no undefined references, no stale-label warning.
7. Read pages 1 and 2 of the compiled PDF, and one page of the reference list.
   Verify the front page from the PDF, not from the source.
8. Copy the PDF to `C:\Users\johanf\Dropbox\0Claude0\1Research\WorkingPapers\`,
   moving any superseded version of the same stem into `archive\`. Never
   overwrite, never delete.
9. Report the source path, the shelf path, anything archived, what was decided on
   the author's behalf, and every open question.

## Invocation examples

```text
$leapwp paper.tex
$leapwp path/to/project/folder
```

Natural language also works when the skill is installed and discoverable: `Use
leapwp to turn this into a working paper`, `put this on the working paper shelf`.
