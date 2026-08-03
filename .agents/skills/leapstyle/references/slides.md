# LEAP presentation style

Use this reference for Beamer presentations and slide-deck conversions. Preserve the substance of the source. Improve the sequence, hierarchy and visual economy without inventing claims, evidence or citations.

## Contents

1. Conversion workflow
2. Required Beamer setup
3. Slide architecture
4. Slide-level writing
5. Figures, tables and citations
6. Validation
7. Minimal template

## 1. Conversion workflow

1. Inspect the whole source deck, associated figures, bibliography and local commands.
2. Identify the audience, talk length and venue before changing the structure.
3. Draft a ghost deck: one sentence per intended slide, with the argumentative job of each slide.
4. Rebuild the deck around that sequence.
5. Preserve title, subtitle, author, affiliation, date, custom commands, bibliography and working image paths unless the user asks to change them.
6. Use the current year in a new deck unless the user provides a date.
7. Do not silently remove qualifications, counterarguments, definitions or evidence.
8. Keep a separate note of possible substantive problems discovered while restructuring.

If the input is not Beamer, route the visual conversion through the paper rules rather than forcing it into this format.

## 2. Required Beamer setup

Start from the existing preamble when one is present. Preserve packages and commands needed by the document. For a new deck, use this baseline:

```latex
\documentclass[aspectratio=169,11pt]{beamer}

\usetheme{Boadilla}
\usecolortheme{seagull}

\definecolor{leapplum}{HTML}{5C2346}
\definecolor{leapblue}{HTML}{3D8EB9}
\definecolor{leapsage}{HTML}{6B8E5E}
\definecolor{leapgold}{HTML}{D4A03E}
\definecolor{leaprose}{HTML}{A34466}
\definecolor{leapteal}{HTML}{45808B}
\definecolor{leapearth}{HTML}{8B6B3D}
\definecolor{leapmint}{HTML}{97C5B0}
\definecolor{leapmaroon}{HTML}{7A0019}
\definecolor{leapgrey}{HTML}{AAAAAA}

\setbeamercolor{structure}{fg=leapmaroon}
\setbeamercolor{frametitle}{fg=leapmaroon}
\setbeamercolor{title}{fg=leapmaroon}
\setbeamercolor{palette primary}{bg=leapmaroon,fg=white}
\setbeamercolor{palette secondary}{bg=leapmaroon!85,fg=white}
\setbeamercolor{palette tertiary}{bg=leapmaroon!70,fg=white}
\setbeamercolor{palette quaternary}{bg=leapmaroon!55,fg=white}
\setbeamercolor{block title}{bg=leapmaroon,fg=white}
\setbeamercolor{block body}{bg=leapmaroon!5,fg=black}
\setbeamertemplate{navigation symbols}{}

\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{amsmath,amssymb}
\usepackage{microtype}
\usepackage[style=authoryear,backend=biber]{biblatex}
% \addbibresource{references.bib}
```

Use the organisation's supplied logo when it exists. Do not fabricate or download a substitute without permission. Keep it small and subordinate to the intellectual content.

## 3. Slide architecture

Build the talk as an argument, not as a compressed paper. A useful default sequence is:

1. motivating fact or puzzle;
2. question;
3. answer in one sentence;
4. mechanism or conceptual framework;
5. evidence and design;
6. main results;
7. interpretation and limits;
8. conclusion.

Adjust this sequence to the genre. A theory talk may need the mechanism earlier; a historical talk may need brief context before design. Every section should advance the audience's understanding rather than reproduce manuscript headings mechanically.

Aim for roughly one substantive slide per minute, fewer when slides contain equations, unfamiliar figures or discussion. Include only appendix slides likely to support questions.

Use section-divider slides sparingly. The audience should always know where the talk is going, but repeated agenda slides consume attention.

## 4. Slide-level writing

### Use action titles

The title should state the slide's conclusion or argumentative function:

- Weak: `Results`
- Better: `Writing lowers measured performance in the model`
- Weak: `Data`
- Better: `The experiment separates drafting from evaluation`

An action title may be a complete sentence or a compact claim. Avoid cryptic fragments.

### Give each slide one job

A slide may introduce a puzzle, define a term, present a design choice, show a result or qualify an inference. If it does several of these, split it.

### Control density

- Prefer one exhibit or one compact cluster of text.
- Keep prose in short grammatical statements, not telegraphic fragments whose relation is unclear.
- Avoid full paragraphs except for a short quotation that is indispensable.
- Use bold to mark the one or two phrases the audience must retain.
- Use italics rarely and consistently.
- Do not shrink type to rescue an overloaded slide.
- Reveal material incrementally only when the sequence matters.

### Maintain a spoken register

Write for the ear. Sentences may be shorter than in the paper, but they should remain precise. Define specialised terms before using abbreviations. Do not use unexplained shorthand merely to save space.

### Preserve qualifications

Condense caveats rather than deleting them. If a result is descriptive, correlational, model-dependent or conditional, the slide must say so. A more attractive slide is not licence for a stronger claim.

## 5. Figures, tables and citations

### Figures

- Use the graph module for newly generated statistical figures.
- Make axis labels, units, legends and notes readable from the back of a room.
- Prefer direct labels when they reduce eye travel.
- Remove decorative chart elements that do not convey information.
- Give each figure a short interpretive title.
- Preserve aspect ratios and use relative paths.

### Tables

- Show only the columns and rows needed for the point of the slide.
- Use `booktabs`; avoid vertical rules.
- Align decimals when comparison depends on magnitude.
- Put units and samples in the title or note.
- Do not convert a complex regression table into illegibly small text. Extract the relevant estimates and state that the full table is in the paper or appendix.

### Citations

Use brief author-year citations on the slide. Place full bibliographic details in the references frame. Keep source notes visible for data, quotations and reproduced figures.

The final references frame may use:

```latex
\begin{frame}[allowframebreaks]{References}
  \printbibliography
\end{frame}
```

If an existing deck uses BibTeX rather than `biblatex`, preserve that system unless the user asks for a migration.

## 6. Validation

Compile with the toolchain required by the existing bibliography. Then check:

- no missing files, citations, references or fonts;
- no overfull boxes or text outside the frame;
- no unreadably small figures, legends, notes or tables;
- image paths work from the project directory;
- titles state the intended sequence when read alone;
- the conclusion answers the opening question;
- qualifiers and source attributions survived the conversion;
- the PDF page count is plausible for the stated talk length.

When possible, inspect representative rendered slides: the title page, a dense text slide, a figure, a table, an equation and the conclusion.

## 7. Minimal template

```latex
\documentclass[aspectratio=169,11pt]{beamer}
\usetheme{Boadilla}
\usecolortheme{seagull}

\definecolor{leapmaroon}{HTML}{7A0019}
\setbeamercolor{structure}{fg=leapmaroon}
\setbeamercolor{frametitle}{fg=leapmaroon}
\setbeamercolor{title}{fg=leapmaroon}
\setbeamertemplate{navigation symbols}{}

\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{amsmath,amssymb}

\title{Title}
\subtitle{Optional subtitle}
\author{Author}
\institute{Affiliation}
\date{2026}

\begin{document}

\begin{frame}
  \titlepage
\end{frame}

\begin{frame}{The puzzle in one sentence}
  \begin{itemize}
    \item Motivation
    \item Question
  \end{itemize}
\end{frame}

\begin{frame}{The evidence supports a qualified answer}
  % One exhibit or one compact argument
\end{frame}

\begin{frame}{Conclusion}
  \begin{enumerate}
    \item Answer the question.
    \item State the mechanism or interpretation.
    \item State the principal limit.
  \end{enumerate}
\end{frame}

\end{document}
```
