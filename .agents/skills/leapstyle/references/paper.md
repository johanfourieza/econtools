# LEAP LaTeX papers

The shape of a LEAP paper: preamble, section order, body formatting, and the
conventions that go with them. The front page -- title footnote, acknowledgements,
AI disclosure, cite-as line -- is not here. It is added once, at the end, by the
`leapwp` skill, so that a paper in progress never carries a half-written citation
for its own draft.

## Contents

- Preamble and preservation rules
- Front matter while drafting
- Paper structure
- Body formatting
- Bibliography
- Validation
- Minimal template
- Packaging: use `leapwp`

## Preamble and preservation rules

Use an 11-point `article`, one-inch margins and one-and-a-half spacing. Preserve the document's title, author, date, bibliography path and custom commands. Preserve any extra packages that the body genuinely uses; do not delete packages merely because they are absent from the minimal template.

```latex
\documentclass[11pt]{article}

% ---------- LEAP working paper setup ----------
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\onehalfspacing

\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{booktabs}
\usepackage{float}
\usepackage{caption}
\usepackage{hyperref}
\hypersetup{
  colorlinks=true,
  linkcolor=black,
  citecolor=black,
  urlcolor=black
}

\usepackage[authoryear,round]{natbib}
```

`fontenc` and `lmodern` are there for the posted PDF: without them the footnote
markers, quotation marks and en dashes are not recoverable when a reader copies
text out of the file. `lmodern` is metrically identical to Computer Modern, so
the paper looks the same and paginates the same.

## Front matter while drafting

Keep the front matter minimal while the paper is being written:

```latex
\title{Paper Title}
\author{Johan Fourie}
\date{}
```

Do not draft the title footnote here. The acknowledgements, the AI disclosure and
the cite-as line are written once, from the finished paper, by `leapwp`, which also
fills in the co-author affiliation footnotes. A draft carrying a half-finished
citation for itself is worse than one carrying none, because the citation is the
thing most likely to be copied out and reused unchecked.

Two layout rules do apply from the start, because they shape the paper rather than
decorate it:

1. Put `\maketitle`, the abstract, keywords and JEL codes on page 1, and nothing
   else.
2. Insert `\newpage` before the body so the paper begins on page 2. If the
   manuscript deliberately uses an unnumbered opening before Section 1, keep that
   architecture while enforcing the page break.

Format keywords and JEL codes as follows:

```latex
\begin{abstract}
\noindent Abstract text.
\end{abstract}

\vspace{1em}\noindent\textbf{Keywords:} keyword1; keyword2; keyword3

\vspace{0.25em}
\noindent\textbf{JEL codes:} X00; Y00; Z00
```

Leave `\date{}` empty. No date is printed, in a draft or on the shelf.

## Paper structure

Follow the shape of an AER paper. This is the default section order; depart from
it when the paper needs a different one, and say why.

1. **Introduction** -- built to the formula in [writing.md](writing.md).
2. **Background** -- the historical or institutional setting the design relies
   on. Omit it when the setting is familiar to the paper's readers.
3. **Data** -- sources, construction, coverage, and the measurement problems
   that come with them.
4. **Empirical strategy** -- the specification, the identifying assumption, and
   the threats to it.
5. **Results** -- main estimates first, then robustness.
6. **Mechanisms and heterogeneity** -- after the reader has absorbed the main
   result.
7. **Conclusion** -- built to the formula in [writing.md](writing.md).

Then References, then an appendix numbered A1, A2 and so on.

Conventions that go with this structure:

- **No separate literature-review section.** The literature belongs in the
  introduction's contribution paragraphs, where each cited work is tied to what
  this paper changes.
- **No separate limitations or scope section, ever.** See [writing.md](writing.md)
  for where each kind of limitation goes instead.
- **Robustness is not a section by default.** Fold it into Results, or move it
  to the appendix.
- **Tables and figures stand alone.** Every one carries a note giving the
  sample, the unit of observation and the standard-error clustering.

## Body formatting

- Keep standard paragraph indentation. Do not set `\parindent` to zero or add paragraph spacing.
- Keep hyperlinks black and print-ready.
- Use figures in this form unless the document requires a deliberate alternative:

```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=\linewidth]{figure.pdf}
\caption{Caption}
\label{fig:example}
\end{figure}
```

- Preserve theorem, table and epigraph packages used by the manuscript.
- Apply [writing.md](writing.md) as well when the request includes prose or a complete manuscript style pass.

## Bibliography

Cite with `natbib` in author-year form, and set the reference list in `aea.bst`, the
official American Economic Association style. It prints full first names, inverts the
first author and preserves title case.

```latex
\bibliographystyle{aea}
\bibliography{references}
```

Place both commands before `\end{document}`. Do not rewrite a valid relative
bibliography path to the example path.

Two things follow from this style, and the `leapwp` skill handles both when the paper
is packaged: `aea.bst` is not in the standard MiKTeX or TeX Live tree, so a copy has
to travel beside the `.tex`; and because `aea.bst` prints whatever the `.bib` holds,
every entry needs the authors' full given names rather than initials. Never expand an
initial from memory while drafting -- leave it, and let the packaging pass resolve it
against a source.

## Validation

Run the full build sequence required by the repository, normally:

```text
pdflatex -interaction=nonstopmode -halt-on-error FILE.tex
bibtex FILE
pdflatex -interaction=nonstopmode -halt-on-error FILE.tex
pdflatex -interaction=nonstopmode -halt-on-error FILE.tex
```

Inspect the log for undefined citations/references, LaTeX/package warnings, overfull boxes and underfull boxes. Confirm the abstract limit, page count and venue requirements. For a style-only conversion, verify citation, numeral, equation, theorem and label/reference preservation.

## Minimal template

A paper in progress. The front page is deliberately bare: `leapwp` fills it in when
the paper is finished.

```latex
\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\onehalfspacing
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{booktabs}
\usepackage{float}
\usepackage{caption}
\usepackage{hyperref}
\hypersetup{colorlinks=true,linkcolor=black,citecolor=black,urlcolor=black}
\usepackage[authoryear,round]{natbib}

\title{Writing in the Age of AI}
\author{Johan Fourie}
\date{}

\begin{document}
\maketitle

\begin{abstract}
\noindent Abstract text.
\end{abstract}
\vspace{1em}\noindent\textbf{Keywords:} keyword1; keyword2

\vspace{0.25em}
\noindent\textbf{JEL codes:} N17; O10

\newpage
\section{Introduction}
Body text.

\bibliographystyle{aea}
\bibliography{references}
\end{document}
```

## Packaging: use `leapwp`

Everything that turns a styled paper into a posted one lives in the `leapwp` skill:

- the front matter intake -- co-authors, acknowledgements, the AI tools used;
- the title footnote, in its fixed order of acknowledgements, AI disclosure,
  cite-as line;
- the author block and its affiliation footnotes;
- installing `aea.bst` and auditing the `.bib` for full given names;
- the versioned filename, `JF_KS_WritingInThe_v2.tex`, written beside the file it
  was made from and never over it;
- supplements, versioned in lockstep with the paper they document;
- the clean four-pass build, and reading the compiled front page rather than
  trusting the source;
- the copy into `1Research\WorkingPapers\`, with any superseded version moved into
  `archive\`.

Do none of that from this skill. A paper can be restyled a dozen times during a
project; it should be versioned and shelved only when it is ready to circulate, and
keeping the two apart is what stops the shelf filling with drafts.
