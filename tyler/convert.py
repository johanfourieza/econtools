#!/usr/bin/env python3
"""
PDF-to-Wiki converter for academic literature.

Converts a directory of academic PDFs into a structured markdown wiki with:
- YAML frontmatter (title, authors, year, abstract)
- Cleaned body text (stripped headers/footers/page numbers)
- Auto-generated index.md from extracted metadata
- Incremental mode (skips already-converted files)
- Optional BibTeX matching
- Optional recursive directory scanning
"""

import sys
import os
import re
import json
import hashlib
import argparse
from pathlib import Path


# ---------------------------------------------------------------------------
# Filename helpers
# ---------------------------------------------------------------------------

def sanitise_filename(name):
    """Convert a PDF filename to a safe markdown filename."""
    name = os.path.splitext(name)[0]
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[\s]+', '_', name)
    name = name.strip('_')
    return name + '.md'


def file_hash(path):
    """Return SHA-256 hex digest of a file (for incremental mode)."""
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Metadata extraction heuristics
# ---------------------------------------------------------------------------

def clean_field(text):
    """Remove markdown formatting artifacts from extracted metadata fields."""
    text = re.sub(r'\*\*?', '', text)     # remove bold/italic markers
    text = re.sub(r'_([^_]+)_', r'\1', text)  # remove _italic_
    text = re.sub(r'\[(\d+)\]', '', text)  # remove footnote refs like [1]
    text = re.sub(r'==>.*?<==', '', text)  # remove image placeholders
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def is_junk_line(line):
    """Return True if a line is boilerplate (JSTOR, image placeholders, etc.)."""
    line_lower = line.strip().lower()
    junk_patterns = [
        r'==>.*?<==',
        r'jstor',
        r'stable url',
        r'this content downloaded',
        r'terms and conditions',
        r'terms & conditions',
        r'all rights reserved',
        r'published by:',
        r'collaborating with jstor',
        r'not-for-profit',
        r'0002-9602',  # journal ISSNs
    ]
    for pat in junk_patterns:
        if re.search(pat, line_lower):
            return True
    return False


def extract_title(md_text):
    """Extract the paper title from markdown text.

    Tries: first markdown heading, first bold text, or first non-empty line.
    Skips image placeholders, JSTOR boilerplate, and very short lines.
    """
    # Try first markdown heading (skip image placeholders)
    for m in re.finditer(r'^#{1,3}\s+(.+)$', md_text, re.MULTILINE):
        title = m.group(1).strip()
        if len(title) > 10 and len(title) < 300 and '==>' not in title:
            return clean_field(title)

    # Try first bold text that isn't an image placeholder
    for m in re.finditer(r'\*\*(.{10,200}?)\*\*', md_text):
        candidate = m.group(1).strip()
        if '==>' not in candidate and not is_junk_line(candidate):
            return clean_field(candidate)

    # Fall back to first non-junk, non-empty line of reasonable length
    for line in md_text.split('\n'):
        line = line.strip()
        if len(line) > 15 and not is_junk_line(line) and '==>' not in line:
            return clean_field(line[:200])

    return "Unknown Title"


def extract_authors(md_text, title):
    """Extract authors — typically the lines just after the title."""
    # First try: look for "Author(s):" pattern (JSTOR-style)
    m = re.search(r'Author\(s\)\s*:\s*(.+?)(?:\n|;|Source)', md_text)
    if m:
        return clean_field(m.group(1).strip())

    lines = md_text.split('\n')
    title_idx = None

    # Find where the title appears
    title_clean = re.sub(r'[#*_\s]+', ' ', title).strip().lower()
    for i, line in enumerate(lines):
        line_clean = re.sub(r'[#*_\s]+', ' ', line).strip().lower()
        if title_clean and title_clean in line_clean:
            title_idx = i
            break

    if title_idx is None:
        return "Unknown"

    # Look at the next few non-empty lines for author-like patterns
    candidates = []
    for line in lines[title_idx + 1: title_idx + 8]:
        line = line.strip().strip('*').strip('_').strip()
        if not line:
            continue
        # Skip junk lines
        if is_junk_line(line) or '==>' in line:
            continue
        # Stop if we hit abstract or a section heading
        if re.match(r'^(abstract|introduction|#{1,3}\s)', line, re.IGNORECASE):
            break
        # Author lines often contain commas, "and", university names
        # Skip lines that look like dates, affiliations-only, or emails
        if re.match(r'^\d{4}', line):
            break
        if '@' in line and ',' not in line:
            continue
        # Skip very long lines (likely paragraphs, not author names)
        if len(line) > 200:
            continue
        if len(line) > 5 and len(line) <= 200:
            candidates.append(clean_field(line))
        if len(candidates) >= 3:
            break

    if candidates:
        return '; '.join(candidates)
    return "Unknown"


def extract_year(md_text, filename):
    """Extract publication year from text or filename."""
    # Try filename first
    m = re.search(r'(19|20)\d{2}', filename)
    if m:
        return m.group(0)

    # Try common patterns in text: "(2023)", "2023", "Published 2023"
    # Look only in the first ~2000 chars to avoid picking up random years
    header = md_text[:2000]
    years = re.findall(r'((?:19|20)\d{2})', header)
    if years:
        # Return the most recent plausible year
        valid = [y for y in years if 1900 <= int(y) <= 2030]
        if valid:
            return max(valid)

    return "Unknown"


def extract_abstract(md_text):
    """Extract the abstract section from an academic paper."""
    # Pattern 1: Explicit "Abstract" heading or label
    patterns = [
        r'(?:^|\n)\s*#{0,3}\s*\**\s*Abstract\s*\**\s*\n+(.*?)(?=\n\s*#{1,3}\s|\n\s*\**\s*(?:Introduction|1[\.\s]|JEL|Keywords)\s*\**)',
        r'(?:^|\n)\s*\**Abstract[\.:]\**\s*(.*?)(?=\n\s*\**\s*(?:Introduction|1[\.\s]|JEL|Keywords))',
        r'(?:^|\n)\s*\**Abstract\**\s*[-—:.]?\s*\n*(.*?)(?=\n\n\n|\n\s*\**(?:Introduction|1[\.\s]))',
    ]

    for pattern in patterns:
        m = re.search(pattern, md_text, re.IGNORECASE | re.DOTALL)
        if m:
            abstract = m.group(1).strip()
            # Clean up: remove excess whitespace, limit length
            abstract = re.sub(r'\s+', ' ', abstract)
            if len(abstract) > 50:
                return abstract[:3000]  # cap at ~3000 chars

    # Fallback: if no explicit abstract found, return empty
    return ""


def extract_jel_codes(md_text):
    """Extract JEL classification codes if present."""
    m = re.search(r'JEL[\s:]*(?:codes?|classification)?[\s:]*([A-Z]\d{1,2}(?:\s*[,;]\s*[A-Z]\d{1,2})*)', md_text[:5000], re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return ""


def extract_keywords(md_text):
    """Extract keywords if present."""
    m = re.search(r'(?:^|\n)\s*\**Keywords?\**[\s:]+(.+?)(?:\n\n|\n\s*\**(?:JEL|Introduction|1[\.\s]))', md_text[:5000], re.IGNORECASE | re.DOTALL)
    if m:
        kw = m.group(1).strip()
        kw = re.sub(r'\s+', ' ', kw)
        return kw[:500]
    return ""


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

def clean_markdown(md_text):
    """Clean pymupdf4llm output for token efficiency."""
    lines = md_text.split('\n')

    # 0. Remove JSTOR/publisher boilerplate lines
    lines = [l for l in lines if not is_junk_line(l)]

    # 0b. Remove image placeholder lines
    lines = [l for l in lines if '==>' not in l]

    # 1. Remove likely headers/footers: short lines that repeat across the doc
    if len(lines) > 50:
        # Count line frequencies (exact match, stripped)
        freq = {}
        for line in lines:
            stripped = line.strip()
            if 3 < len(stripped) < 80:
                freq[stripped] = freq.get(stripped, 0) + 1
        # Lines appearing 3+ times are likely headers/footers
        repeated = {k for k, v in freq.items() if v >= 3}
        lines = [l for l in lines if l.strip() not in repeated]

    # 2. Remove standalone page numbers
    lines = [l for l in lines if not re.match(r'^\s*-?\s*\d{1,4}\s*-?\s*$', l)]

    # 3. Remove excessive blank lines (more than 2 consecutive)
    cleaned = []
    blank_count = 0
    for line in lines:
        if line.strip() == '':
            blank_count += 1
            if blank_count <= 2:
                cleaned.append(line)
        else:
            blank_count = 0
            cleaned.append(line)

    return '\n'.join(cleaned)


def trim_references(md_text):
    """Optionally remove the references/bibliography section to save tokens.

    Returns (body_text, references_text) so references can be stored separately if needed.
    """
    # Find the references section
    patterns = [
        r'\n\s*#{0,3}\s*\**\s*References\s*\**\s*\n',
        r'\n\s*#{0,3}\s*\**\s*Bibliography\s*\**\s*\n',
        r'\n\s*#{0,3}\s*\**\s*Works Cited\s*\**\s*\n',
        r'\n\s*\**\s*REFERENCES\s*\**\s*\n',
    ]

    for pattern in patterns:
        m = re.search(pattern, md_text)
        if m:
            body = md_text[:m.start()]
            refs = md_text[m.start():]
            return body.rstrip(), refs.strip()

    return md_text, ""


# ---------------------------------------------------------------------------
# BibTeX matching
# ---------------------------------------------------------------------------

def load_bibtex(bib_path):
    """Parse a .bib file and return a list of entries with citekey, title, authors, year."""
    entries = []
    with open(bib_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Simple regex-based bib parser (handles most common formats)
    for m in re.finditer(r'@\w+\{(\w+)\s*,\s*(.*?)\n\}', content, re.DOTALL):
        citekey = m.group(1)
        body = m.group(2)

        title_m = re.search(r'title\s*=\s*[\{"](.+?)[\}"]', body, re.IGNORECASE)
        author_m = re.search(r'author\s*=\s*[\{"](.+?)[\}"]', body, re.IGNORECASE)
        year_m = re.search(r'year\s*=\s*[\{"]?(\d{4})[\}"]?', body, re.IGNORECASE)

        entries.append({
            'citekey': citekey,
            'title': title_m.group(1) if title_m else '',
            'author': author_m.group(1) if author_m else '',
            'year': year_m.group(1) if year_m else '',
        })

    return entries


def match_bibtex(title, authors, year, bib_entries):
    """Fuzzy-match a paper to a BibTeX entry. Returns citekey or empty string."""
    if not bib_entries:
        return ""

    title_lower = re.sub(r'[^\w\s]', '', title.lower())
    title_words = set(title_lower.split())

    best_score = 0
    best_key = ""

    for entry in bib_entries:
        score = 0
        entry_title = re.sub(r'[^\w\s]', '', entry['title'].lower())
        entry_words = set(entry_title.split())

        # Title word overlap (most important signal)
        if title_words and entry_words:
            overlap = len(title_words & entry_words) / max(len(title_words), len(entry_words))
            score += overlap * 10

        # Year match
        if year != "Unknown" and entry['year'] == year:
            score += 2

        # Author last-name overlap
        if authors != "Unknown" and entry['author']:
            author_words = set(re.sub(r'[^\w\s]', '', authors.lower()).split())
            bib_author_words = set(re.sub(r'[^\w\s]', '', entry['author'].lower()).split())
            if author_words & bib_author_words:
                score += 3

        if score > best_score:
            best_score = score
            best_key = entry['citekey']

    # Require a minimum confidence
    return best_key if best_score >= 6 else ""


# ---------------------------------------------------------------------------
# Core conversion
# ---------------------------------------------------------------------------

def convert_one_pdf(pdf_path, output_path, bib_entries=None, keep_references=False):
    """Convert a single PDF to cleaned markdown with YAML frontmatter.

    Returns a metadata dict for the index, or None on failure.
    """
    import pymupdf4llm

    md_text = pymupdf4llm.to_markdown(pdf_path)
    original_filename = os.path.basename(pdf_path)

    # Extract metadata
    title = extract_title(md_text)
    authors = extract_authors(md_text, title)
    year = extract_year(md_text, original_filename)
    abstract = extract_abstract(md_text)
    jel = extract_jel_codes(md_text)
    keywords = extract_keywords(md_text)

    # BibTeX matching
    citekey = ""
    if bib_entries:
        citekey = match_bibtex(title, authors, year, bib_entries)

    # Clean the text
    cleaned = clean_markdown(md_text)

    # Handle references
    body, refs = trim_references(cleaned)
    if keep_references:
        body = cleaned  # keep everything

    # Build YAML frontmatter
    fm_lines = ['---']
    fm_lines.append(f'title: "{title}"')
    fm_lines.append(f'authors: "{authors}"')
    fm_lines.append(f'year: "{year}"')
    if citekey:
        fm_lines.append(f'citekey: "{citekey}"')
    if jel:
        fm_lines.append(f'jel: "{jel}"')
    if keywords:
        fm_lines.append(f'keywords: "{keywords}"')
    fm_lines.append(f'source_pdf: "{original_filename}"')
    fm_lines.append('---')
    fm_lines.append('')

    # Add abstract prominently if extracted
    if abstract:
        fm_lines.append('## Abstract')
        fm_lines.append('')
        fm_lines.append(abstract)
        fm_lines.append('')
        fm_lines.append('---')
        fm_lines.append('')

    # Write the file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fm_lines) + '\n' + body)

    # Return metadata for index
    return {
        'title': title,
        'authors': authors,
        'year': year,
        'abstract': abstract[:800],  # truncate for index
        'citekey': citekey,
        'jel': jel,
        'keywords': keywords,
        'source_pdf': original_filename,
        'md_filename': os.path.basename(output_path),
        'body_tokens_approx': len(body.split()),  # rough word count as proxy
    }


# ---------------------------------------------------------------------------
# Index generation
# ---------------------------------------------------------------------------

def build_index(metadata_list, output_path):
    """Build index.md from extracted metadata — no Claude tokens needed."""
    n = len(metadata_list)
    lines = [
        '# Literature Wiki — Index',
        '',
        f'This index covers **{n} papers**. Each entry has structured metadata and the abstract.',
        'To read a full paper, open the linked `.md` file in `papers/`.',
        '',
        '**How to use this wiki:**',
        '- Read this index to understand what each paper covers',
        '- Use Grep to search across all papers for specific terms or concepts',
        '- Read individual `papers/*.md` files only when you need full detail',
        '',
        '---',
        '',
    ]

    for meta in sorted(metadata_list, key=lambda m: (m['year'], m['title'])):
        lines.append(f'## {meta["title"]}')
        lines.append('')
        lines.append(f'**Authors:** {meta["authors"]}  ')
        lines.append(f'**Year:** {meta["year"]}  ')
        if meta['citekey']:
            lines.append(f'**Citekey:** `{meta["citekey"]}`  ')
        if meta['jel']:
            lines.append(f'**JEL:** {meta["jel"]}  ')
        if meta['keywords']:
            lines.append(f'**Keywords:** {meta["keywords"]}  ')
        lines.append(f'**Full text:** `papers/{meta["md_filename"]}`  ')
        lines.append('')
        if meta['abstract']:
            lines.append(f'> {meta["abstract"]}')
            lines.append('')
        lines.append('---')
        lines.append('')

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return output_path


# ---------------------------------------------------------------------------
# State tracking (incremental mode)
# ---------------------------------------------------------------------------

def load_state(state_path):
    """Load .wiki_state.json or return empty dict."""
    if os.path.exists(state_path):
        with open(state_path, 'r') as f:
            return json.load(f)
    return {}


def save_state(state_path, state):
    """Save state to .wiki_state.json."""
    with open(state_path, 'w') as f:
        json.dump(state, f, indent=2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Convert academic PDFs to a structured markdown wiki.'
    )
    parser.add_argument('pdf_dir', help='Directory containing PDF files')
    parser.add_argument('wiki_dir', help='Output wiki directory')
    parser.add_argument('--recursive', '-r', action='store_true',
                        help='Scan PDF_DIR recursively for PDFs')
    parser.add_argument('--bib', type=str, default=None,
                        help='Path to a .bib file for citation key matching')
    parser.add_argument('--keep-references', action='store_true',
                        help='Keep the references section (default: trim it)')
    parser.add_argument('--force', action='store_true',
                        help='Re-convert all files, ignoring incremental state')

    args = parser.parse_args()

    pdf_dir = args.pdf_dir
    wiki_dir = args.wiki_dir

    if not os.path.isdir(pdf_dir):
        print(f"ERROR: PDF directory not found: {pdf_dir}")
        sys.exit(1)

    # Create output structure
    papers_dir = os.path.join(wiki_dir, 'papers')
    os.makedirs(papers_dir, exist_ok=True)

    # Find PDFs
    if args.recursive:
        pdf_files = []
        for root, dirs, files in os.walk(pdf_dir):
            for f in files:
                if f.lower().endswith('.pdf'):
                    pdf_files.append(os.path.join(root, f))
    else:
        pdf_files = [os.path.join(pdf_dir, f) for f in os.listdir(pdf_dir)
                     if f.lower().endswith('.pdf')]

    if not pdf_files:
        print(f"No PDF files found in: {pdf_dir}")
        sys.exit(0)

    pdf_files.sort()
    print(f"Found {len(pdf_files)} PDF files.\n")

    # Load incremental state
    state_path = os.path.join(wiki_dir, '.wiki_state.json')
    state = load_state(state_path) if not args.force else {}

    # Load BibTeX if provided
    bib_entries = None
    if args.bib:
        if os.path.isfile(args.bib):
            bib_entries = load_bibtex(args.bib)
            print(f"Loaded {len(bib_entries)} BibTeX entries from {args.bib}\n")
        else:
            print(f"WARNING: .bib file not found: {args.bib}\n")

    # Convert
    succeeded = []
    skipped = []
    failed = []
    metadata_list = []

    for i, pdf_path in enumerate(pdf_files, 1):
        pdf_filename = os.path.basename(pdf_path)
        md_filename = sanitise_filename(pdf_filename)
        output_path = os.path.join(papers_dir, md_filename)

        # Incremental check
        current_hash = file_hash(pdf_path)
        if pdf_path in state and state[pdf_path].get('hash') == current_hash and not args.force:
            # Already converted and unchanged — load cached metadata
            cached_meta = state[pdf_path].get('metadata')
            if cached_meta:
                metadata_list.append(cached_meta)
                skipped.append(pdf_filename)
                print(f"  [{i}/{len(pdf_files)}] SKIP (unchanged): {pdf_filename}")
                continue

        try:
            meta = convert_one_pdf(pdf_path, output_path, bib_entries, args.keep_references)

            # Check for near-empty output (likely scanned PDF)
            file_size = os.path.getsize(output_path)
            if file_size < 500:
                print(f"  [{i}/{len(pdf_files)}] WARNING (possible scan, little text): {pdf_filename}")
            else:
                print(f"  [{i}/{len(pdf_files)}] OK: {pdf_filename} -> {md_filename}")

            succeeded.append(pdf_filename)
            metadata_list.append(meta)

            # Save state for incremental mode
            state[pdf_path] = {'hash': current_hash, 'metadata': meta}

        except Exception as e:
            print(f"  [{i}/{len(pdf_files)}] FAILED: {pdf_filename} | Error: {e}")
            failed.append((pdf_filename, str(e)))

    # Save state
    save_state(state_path, state)

    # Build index from metadata (no Claude involvement!)
    index_path = os.path.join(wiki_dir, 'index.md')
    build_index(metadata_list, index_path)

    # Report
    print(f"\n{'='*50}")
    print(f"  Conversion complete")
    print(f"{'='*50}")
    print(f"  New/updated: {len(succeeded)}")
    print(f"  Skipped:     {len(skipped)}")
    print(f"  Failed:      {len(failed)}")
    print(f"  Total index: {len(metadata_list)} papers")
    print(f"  Wiki:        {wiki_dir}")
    print(f"  Index:       {index_path}")

    if failed:
        print(f"\n  Failed files:")
        for name, err in failed:
            print(f"    - {name}: {err}")

    # Token estimate
    total_papers = len(metadata_list)
    pdf_token_est = total_papers * 12000
    index_tokens = total_papers * 400
    print(f"\n  Token estimate:")
    print(f"    Reading all PDFs directly:  ~{pdf_token_est:,} tokens")
    print(f"    Reading index.md only:      ~{index_tokens:,} tokens")
    print(f"    Savings:                    ~{pdf_token_est - index_tokens:,} tokens ({((pdf_token_est - index_tokens)/max(pdf_token_est,1))*100:.0f}%)")


if __name__ == '__main__':
    main()
