---
name: tyler
description: Convert a folder of academic PDF papers into a token-efficient markdown wiki for literature review. Use this skill when the user has a folder of PDFs they want processed into .md files that Claude Code can read cheaply. Trigger phrases include "convert my PDFs", "build my wiki", "process my papers folder", "/tyler".
allowed-tools: Bash, Read, Write, Edit
user-invocable: true
---

# PDF-to-Wiki Skill

## Purpose

This skill converts a directory of academic PDF papers into a structured, two-tier markdown wiki optimised for token efficiency. A typical 25-page economics paper costs ~12,000 tokens to read as a full PDF or full markdown. This skill produces:

- **Tier 1 — Index** (`index.md`): ~400 tokens per paper. Contains title, authors, year, abstract, citation key, JEL codes, and keywords. For 100 papers, the entire index is ~40,000 tokens — easily readable in a single session.
- **Tier 2 — Full papers** (`papers/*.md`): Cleaned markdown with YAML frontmatter. Only read on demand when you need detail on a specific paper.

This means Claude can navigate a literature set of 100+ papers by reading just the index, then selectively read individual papers as needed.

## What this skill produces

```
WIKI_DIR/
├── index.md              # Auto-generated index with metadata + abstracts
├── papers/
│   ├── acemoglu_2012.md  # Full cleaned markdown with YAML frontmatter
│   ├── nunn_2011.md
│   └── ...
└── .wiki_state.json      # Tracks converted files for incremental updates
```

Each `papers/*.md` file has YAML frontmatter:
```yaml
---
title: "Why Nations Fail"
authors: "Daron Acemoglu; James Robinson"
year: "2012"
citekey: "acemoglu2012"       # if --bib provided
jel: "N10, O10"               # if found in paper
keywords: "institutions, ..."  # if found in paper
source_pdf: "Acemoglu_Robinson_2012.pdf"
---
```

## Step-by-step instructions

### Step 0: Ask the user for inputs

Ask the user for:

- **PDF_DIR**: Full path to the folder containing the PDF files.
- **WIKI_DIR**: Where to create the wiki. Default: `wiki/` in the current working directory.
- **BIB_FILE** (optional): Path to a `.bib` file for citation key matching.
- **Recursive?** (optional): Whether to scan subdirectories. Default: no.

Confirm paths before proceeding.

### Step 1: Check and install the conversion library

```bash
python -c "import pymupdf4llm" 2>/dev/null || pip install pymupdf4llm --break-system-packages --quiet
```

If pip fails, try:
```bash
pip install pymupdf4llm --user --quiet
```

Report success or failure before continuing.

### Step 2: Run the conversion script

The conversion script is at the absolute path shown below. Construct the command using the user's confirmed inputs:

```bash
python "C:\Users\johanf\.claude\skills\tyler\convert.py" "PDF_DIR" "WIKI_DIR" [OPTIONS]
```

**Available flags:**
- `--recursive` or `-r`: Scan PDF_DIR recursively
- `--bib PATH`: Path to a .bib file for citation key matching
- `--keep-references`: Keep the references section (default: trimmed to save tokens)
- `--force`: Re-convert all files, ignoring incremental cache

The script handles everything automatically:
1. Finds all PDFs (skips unchanged files in incremental mode)
2. Converts each to markdown via pymupdf4llm
3. Extracts metadata: title, authors, year, abstract, JEL codes, keywords
4. Cleans the text: strips repeated headers/footers, page numbers
5. Trims the references section (unless --keep-references)
6. Writes each paper as a `.md` file with YAML frontmatter
7. Builds `index.md` automatically from extracted metadata
8. Saves state for incremental updates

**Important:** The index is built entirely in Python from extracted abstracts — you (Claude) do NOT need to read the individual paper files to build it.

### Step 3: Report to the user

After the script finishes, tell the user:

- How many PDFs were found, converted, skipped, and failed
- The location of the wiki directory and index file
- The token savings (the script prints this)
- Any failed files and likely causes (scanned PDFs, corrupted files)

Then explain how to use the wiki in future sessions:

> **Using your wiki:** In any Claude Code session, read `WIKI_DIR/index.md` to see all papers with their abstracts. Ask me questions referencing the index — I'll read individual `papers/*.md` files only when I need the full text. You can also use Grep to search across all papers for specific terms or concepts.

### Step 4 (optional): Improve the index with Claude

If the user wants richer summaries beyond the extracted abstracts, offer to enhance the index. This is optional and costs tokens, but can add value:

- Read papers where the abstract extraction failed or was weak
- Add a 1–2 sentence "contribution" note per paper
- Group papers by theme or methodology

Only do this if the user explicitly asks. The auto-generated index is sufficient for most use cases.

## Gotchas and known issues

- **Scanned PDFs**: pymupdf4llm extracts embedded text only. Scanned-image PDFs produce empty/near-empty output. The script flags these (<500 bytes). Fix: run `ocrmypdf` first to add a text layer.
- **Metadata extraction is heuristic**: Title, author, and abstract extraction works well for standard academic paper layouts but may fail on unusual formats. The full text is always available in the paper file.
- **BibTeX matching is fuzzy**: It matches on title word overlap + author + year. High-confidence matches only (threshold score ≥ 6). Some papers may not match — check the index for missing citekeys.
- **Windows paths with spaces**: Always quoted in the command. The skill handles this.
- **Very large PDFs** (>100 pages): Convert fine but produce large markdown. Consider asking the user if they want to process only specific page ranges for book-length documents.
- **Re-running**: Incremental by default — only re-converts new or changed PDFs. Use `--force` to re-convert everything.
- **References trimmed by default**: The references/bibliography section is removed to save ~20–30% of tokens per paper. Use `--keep-references` if the user needs them.