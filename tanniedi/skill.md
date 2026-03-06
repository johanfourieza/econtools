---
name: tanniedi
description: Language editing round-trip for LaTeX papers. Use when the user wants to send a LaTeX paper to Di Kilpert for copy-editing (pack to Word) or apply edits back from Word (unpack to LaTeX). Accepts one argument - pack or unpack.
---

# Tanniedi — LaTeX ↔ Word Round-Trip for Language Editing

You are automating the round-trip of sending a LaTeX paper to language editor Di Kilpert for copy-editing. The skill has two modes:

- **`pack`**: Convert a LaTeX project → Word manuscript + separate Word file with figures & editable tables
- **`unpack`**: Apply edits from the returned Word file back into the original `.tex` file

This skill works from **any** LaTeX project directory, not just a specific one.

## Prerequisites

Before doing anything else, verify prerequisites:

1. **Pandoc**: Run `pandoc --version`. If missing, tell the user:
   ```
   Pandoc is required but not installed. Install it with:
     winget install --id JohnMacFarlane.Pandoc
   Then restart your terminal and re-run this command.
   ```
   Stop execution if pandoc is not found.

2. **Python 3**: Run `python --version`. Must be 3.x.

3. **python-docx**: Run `python -c "import docx; print(docx.__version__)"`. If missing, tell the user to install it: `pip install python-docx`.

---

## PACK workflow (`/tanniedi pack`)

### Step 1: Discover project files

Find the main `.tex` file in the current working directory:

- If there is exactly **one** `.tex` file → use it.
- If there are **multiple** `.tex` files → look for one matching `*main*.tex` or the one containing `\begin{document}`. If still ambiguous, ask the user which file to use.

From the main `.tex` file, extract:

- **Bibliography file**: Look for `\bibliography{...}` or `\addbibresource{...}`. Extract the filename (add `.bib` extension if not present). Verify the `.bib` file exists.
- **Included sub-files**: Recursively resolve `\input{...}` and `\include{...}` directives. Add `.tex` extension if not present. Read all sub-file contents for processing.
- **Graphics paths**: Check for `\graphicspath{...}` to know where images are stored.
- **Figure environments**: Extract all `\begin{figure}...\end{figure}` and `\begin{figure*}...\end{figure*}` blocks (including content). Track the `\includegraphics{...}` path and `\caption{...}` text within each.
- **Table environments**: Extract all `\begin{table}...\end{table}` and `\begin{table*}...\end{table*}` blocks (including content). Track `\caption{...}`, `\label{...}`, and the `\begin{tabular}...\end{tabular}` content within each.

### Step 2: Create output directory

Create `_tanniedi/` in the project root. If it already exists, ask the user whether to overwrite or abort.

### Step 3: Save originals for later unpack

- Copy the original main `.tex` file → `_tanniedi/_original.tex`
- If there are `\input{}`/`\include{}` sub-files, also copy them into `_tanniedi/_original_inputs/` preserving relative paths.

### Step 4: Pre-process the `.tex`

Create a stripped version of the `.tex` content (combining main file + resolved inputs into one logical document):

- **Remove** all `\begin{figure}...\end{figure}` blocks (including `figure*`). Number figures sequentially (Figure 1, Figure 2, …) in the order they appear. Replace each with a LaTeX comment **and** a visible placeholder paragraph that pandoc will render into the Word document:
  ```latex
  % [FIGURE REMOVED: <label or caption snippet>]
  \bigskip\noindent\textbf{$<$INSERT FIGURE N HERE$>$}\bigskip
  ```
- **Remove** all `\begin{table}...\end{table}` blocks (including `table*`). Number tables sequentially (Table 1, Table 2, …) in the order they appear. Replace each with a LaTeX comment **and** a visible placeholder paragraph:
  ```latex
  % [TABLE REMOVED: <label or caption snippet>]
  \bigskip\noindent\textbf{$<$INSERT TABLE N HERE$>$}\bigskip
  ```
- Keep everything else intact: preamble, `\section{}`, `\cite{}`, `\ref{}`, `\footnote{}`, math environments, comments, etc.
- Save → `_tanniedi/_stripped.tex`

### Step 5: Convert to Word via pandoc

Run:
```bash
pandoc _tanniedi/_stripped.tex --from=latex --to=docx \
  --bibliography=<bibfile>.bib --citeproc \
  --output=_tanniedi/manuscript.docx
```

Key flags:
- `--citeproc` resolves citations to readable author-year text (e.g. "Acemoglu and Wolitzky (2011)")
- Pandoc handles `\ref{}` cross-references, math, footnotes, formatting natively

If the `.bib` file is not found or pandoc fails on bibliography, try without `--bibliography` and `--citeproc` flags and warn the user that citations will appear as raw keys.

If pandoc returns errors, show them to the user and attempt to fix common issues (e.g., missing packages, encoding problems).

### Step 6: Generate original plain text for unpack comparison

Run:
```bash
pandoc _tanniedi/_stripped.tex --from=latex --to=plain --wrap=none \
  --bibliography=<bibfile>.bib --citeproc \
  --output=_tanniedi/_original_plain.txt
```

This plain text version serves as the baseline for diffing against the edited Word file during unpack. Use the same `--bibliography` and `--citeproc` flags as Step 5 so citation rendering matches.

### Step 7: Build figures-and-tables Word document

Write a Python script (inline or as a temp file) using `python-docx` to create `_tanniedi/figures_and_tables.docx`:

**For each figure extracted in Step 1:**
1. Determine the image file path. Check for the file with extensions `.png`, `.jpg`, `.jpeg`, `.pdf` in order.
2. If the image is `.pdf`:
   - Try converting to PNG using Python (e.g., `pdf2image` if available, or `subprocess` call to `magick` / ImageMagick).
   - If conversion fails, insert a placeholder paragraph: "[Figure image: <filename> — PDF could not be converted to PNG. Please insert manually.]"
3. If the image is `.png`, `.jpg`, or `.jpeg`, insert it into the Word document using `document.add_picture(path, width=Inches(5.5))`.
4. Add the caption text below the image as a paragraph with bold "Figure N:" prefix.

**For each table extracted in Step 1:**
1. Parse the `\begin{tabular}{...}...\end{tabular}` content:
   - Determine column count from the column spec (e.g., `{lccr}` → 4 columns).
   - Split rows by `\\`.
   - Split cells by `&`.
   - Strip LaTeX formatting: convert `\textbf{...}` → bold run, `\textit{...}` / `\emph{...}` → italic run, remove `\toprule`, `\midrule`, `\bottomrule`, `\hline`, `\cline{...}`.
   - Handle `\multicolumn{N}{spec}{text}` by merging cells where python-docx supports it, or by placing the text in the first cell with a note.
2. Create a native Word table using `document.add_table(rows=..., cols=...)`.
3. Populate cells with the parsed content, applying bold/italic formatting to individual runs as needed.
4. Add the caption text above or below the table as a paragraph with bold "Table N:" prefix.
5. If parsing fails for a table, fall back to inserting the raw LaTeX source as a code-formatted paragraph.

**If there are no figures and no tables**, skip creating this file and inform the user.

Save → `_tanniedi/figures_and_tables.docx`

The Python script should handle errors gracefully — if one figure or table fails, continue with the rest and report issues at the end.

### Step 8: Print summary

Display a clear summary to the user:

```
Pack complete!

Output files in _tanniedi/:
  - manuscript.docx        — Main text for Di to edit
  - figures_and_tables.docx — Figures and tables (for reference/editing)
  - _original.tex          — Original .tex (preserved for unpack)
  - _original_plain.txt    — Plain text baseline (for unpack diffing)
  - _stripped.tex           — Stripped .tex (intermediate, can ignore)

Instructions for Di:
  1. Edit manuscript.docx — track changes or edit freely
  2. Save the edited file in _tanniedi/ (keep or rename as you wish)
  3. Do NOT restructure sections or delete citation markers
  4. Tables in figures_and_tables.docx are editable — edit if needed
  5. When done, Johan will run /tanniedi unpack to apply changes back to LaTeX
```

---

## UNPACK workflow (`/tanniedi unpack`)

### Step 1: Locate files

In the current project directory, verify:

- `_tanniedi/` directory exists
- `_tanniedi/_original.tex` exists
- `_tanniedi/_original_plain.txt` exists

Find the edited `.docx` file:
- Look for any `.docx` file in `_tanniedi/` that is NOT `manuscript.docx` (the original), NOT `figures_and_tables.docx`, and NOT a file starting with `~$` (Word temp file).
- If no such file is found, check if `manuscript.docx` has been modified more recently than `_original_plain.txt` (the user may have edited it in place).
- If still ambiguous or no edited file found, ask the user which `.docx` file contains the edits. Accept a path.

### Step 2: Convert edited Word to plain text

Run:
```bash
pandoc "_tanniedi/<edited_file>.docx" --from=docx --to=plain --wrap=none \
  --output=_tanniedi/_edited_plain.txt
```

### Step 3: Compute diff

Write a Python script using `difflib` to produce a word-level diff between `_tanniedi/_original_plain.txt` and `_tanniedi/_edited_plain.txt`:

1. Read both files.
2. Normalize both texts:
   - Replace en-dash (`–`) and em-dash (`—`) with `--` and `---` for matching
   - Normalize whitespace (collapse multiple spaces/newlines)
   - Strip leading/trailing whitespace from lines
3. Split into sections based on headings (lines that were `\section{}`, `\subsection{}` etc. — they appear as plain text headings in the pandoc output).
4. For each section, compute a word-level diff using `difflib.SequenceMatcher` or `difflib.ndiff`.
5. Save the diff report → `_tanniedi/_diff_report.txt`

### Step 4: Apply changes to the `.tex` file

This is the core algorithm. Read `_tanniedi/_original.tex` (and any sub-files from `_tanniedi/_original_inputs/` if they exist).

The approach:

1. **Tokenize the original `.tex`** into a stream of tokens, each classified as either:
   - **Prose token**: A word that would appear in the pandoc plain-text output (i.e., visible text content)
   - **Command token**: LaTeX markup that is invisible in plain text — `\cite{...}`, `\citet{...}`, `\citep{...}`, `\ref{...}`, `\label{...}`, `\textit{...}` (the command, not the content), `\textbf{...}` (the command, not the content), `\emph{...}`, `\footnote{...}`, comments (`%...`), environment markers (`\begin{...}`, `\end{...}`), preamble commands, `\section{...}` (the command itself), etc.
   - **Whitespace/structure token**: Newlines, blank lines, `\\`, `&`

2. **Extract the prose sequence** from the original `.tex` tokens — this should closely match `_original_plain.txt` after normalization.

3. **Align** the original prose sequence with the edited prose sequence (from `_edited_plain.txt`) using `difflib.SequenceMatcher`:
   - Matching blocks → keep the original `.tex` tokens (prose + surrounding commands) unchanged
   - Deleted words → remove the prose token but preserve adjacent command tokens (e.g., if a word before `\cite{...}` is deleted, keep the cite)
   - Inserted words → insert new prose tokens at the correct position
   - Changed words → replace the prose token in-place, keeping surrounding LaTeX commands

4. **Special character handling during patching**:
   - If the editor changed `--` to `–` (en-dash), convert back to `--` in LaTeX
   - If the editor changed `---` to `—` (em-dash), convert back to `---` in LaTeX
   - Preserve `~` (non-breaking space) where it existed in the original
   - Preserve `\%`, `\&`, `\$` escaping
   - If the editor introduced new special characters, escape them for LaTeX

5. **Preserve these LaTeX constructs absolutely** (never modify or remove):
   - `\cite{...}`, `\citet{...}`, `\citep{...}` and their arguments
   - `\ref{...}`, `\label{...}`, `\pageref{...}`
   - `\footnote{...}` (the command wrapper; content inside may be edited if it appeared in plain text)
   - `\textit{...}`, `\textbf{...}`, `\emph{...}` (the command; content may change)
   - All preamble content (everything before `\begin{document}`)
   - All `% [FIGURE REMOVED: ...]` and `% [TABLE REMOVED: ...]` placeholders and their accompanying `\bigskip\noindent\textbf{...}\bigskip` marker lines
   - `\section{...}`, `\subsection{...}`, `\subsubsection{...}` commands (content may change if heading text was edited)
   - Math environments: `$...$`, `\[...\]`, `\begin{equation}...\end{equation}`, etc.

6. **Reconstruct** the patched `.tex` by emitting all tokens in order (command tokens preserved, prose tokens updated where the diff indicates changes).

### Step 5: Re-insert figures and tables

Read the `% [FIGURE REMOVED: ...]` and `% [TABLE REMOVED: ...]` comment placeholders in the patched output. Each placeholder consists of two lines: the comment line and the visible `\bigskip\noindent\textbf{...}\bigskip` marker. Replace **both lines** of each placeholder with the corresponding original `\begin{figure}...\end{figure}` or `\begin{table}...\end{table}` block from `_tanniedi/_original.tex`.

If `figures_and_tables.docx` was edited (tables modified), attempt to detect table changes:
- Convert `figures_and_tables.docx` tables back to LaTeX tabular format
- Compare with original tables
- If changes are detected, show a diff to the user and ask whether to apply

For simplicity in the first version: always re-insert the original figure/table blocks unchanged and note to the user that table edits from Word must be transferred manually.

### Step 6: Write output

Save the patched `.tex` file as `<original_name>_edited.tex` in the project root (not inside `_tanniedi/`).

### Step 7: Show diff and ask user

Display a summary of changes to the user:

1. Show statistics: number of words changed, inserted, deleted.
2. Show a section-by-section summary of edits (e.g., "Section 2: 14 words changed, 3 deleted, 5 inserted").
3. For each section with changes, show representative examples of edits (first few changes per section).
4. Read and display the full diff from `_tanniedi/_diff_report.txt` if the user wants it.

Then ask: **"Overwrite the original .tex file with the edited version?"**
- If yes → copy `<name>_edited.tex` over the original `.tex` file (back up original to `_tanniedi/_original.tex` if not already there).
- If no → leave `<name>_edited.tex` alongside the original for manual review.

---

## Edge cases and error handling

### Multiple .tex files with \input{}/\include{}
- The pack step must resolve `\input{}`/`\include{}` recursively to find all prose content.
- Track which prose tokens belong to which source file.
- During unpack, write changes back to the correct source file.
- If sub-files exist, produce one `_edited` version per modified sub-file.

### No bibliography file found
- Run pandoc without `--bibliography` and `--citeproc`.
- Warn the user that citations will appear as raw LaTeX keys in the Word document.

### No figures or tables
- Skip creating `figures_and_tables.docx`.
- Adjust the summary message accordingly.

### PDF-only figures
- Attempt conversion via Python or ImageMagick.
- If conversion is not possible, insert a text placeholder in the Word document.
- Never fail the entire pack because of one unconvertible figure.

### Complex tables
- Parse heuristically: handle `booktabs` commands (`\toprule`, `\midrule`, `\bottomrule`), `\multicolumn{}{}{}`, `\textit{}`, `\textbf{}`, `\emph{}`, `\cmidrule{}`.
- If parsing fails entirely for a table, insert the raw LaTeX as a code block in the Word document with a note.

### Special characters in diff
- `--` (en-dash) and `---` (em-dash): normalize during comparison, restore LaTeX form in output.
- `~` (non-breaking space): preserve original usage.
- `\%`, `\&`, `\$`: keep escaped in LaTeX output.
- Curly quotes introduced by Word: convert back to straight quotes or LaTeX equivalents.
- Ligatures (fi, fl, etc.) that Word may introduce: normalize back to individual characters.

### Pandoc conversion failures
- If pandoc fails, show the error message and suggest common fixes.
- For encoding issues, try adding `--from=latex+smart` or specifying input encoding.
- Never silently swallow pandoc errors.

### Empty or minimal edits
- If the diff shows zero changes, inform the user and do not create an `_edited.tex` file.

---

## Important notes

- **Never modify the original `.tex` file during pack** — only create files inside `_tanniedi/`.
- **Always preserve LaTeX commands** during unpack — the editor edits prose, not markup.
- **The `_tanniedi/` directory is the working area** — all intermediate files go there.
- **Idempotency**: Running pack twice should produce the same result (after confirming overwrite of `_tanniedi/`).
- **Platform**: This runs on Windows. Use forward slashes in Python paths. Pandoc commands run in bash.
