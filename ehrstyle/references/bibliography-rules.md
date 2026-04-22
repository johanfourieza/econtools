# EHR Bibliography — §3 of the Notes for Contributors

Verbatim transcription of Section 3 of the *Economic History Review*
Notes for Contributors (Feb 2026 v1). The custom biblatex style
(`echr.bbx` + `echr.cbx`) implements these rules; this file is the
authoritative reference for checking output.

---

## 3.1 Consolidated list

- Alphabetical list of all **books, articles, essays, and theses**
  referred to (including any referred to in tables, graphs, and maps).
- Typed double-spaced, printed at the end of the article.
- Only items directly cited in the text.
- **Original documents** cited in the text should NOT be in this
  bibliography.
- **Newspapers and manuscripts** should NOT appear in the consolidated
  list (they are cited in full in footnotes only — see §3.2.5–3.2.6).
- **Working papers, research papers** — the Notes explicitly say these
  "should not be listed" (§3.1.1). In our biblatex pipeline, flag such
  entries with `options = {skipbib=true}` in `references.bib`.

## 3.1.1 Order

- Alphabetical by author, surname first then initials.
- Multiple publications by the same author: chronological order.
- Official publications: at the end, chronological, under the heading
  *Official publications*.

## 3.1.2 Capitalisation

- **Sentence case** for book and article titles: initial capital for the
  first word only, plus proper names.
- **Initial capitals** for the main words in titles of journals and
  official publications.
- Follow the capitalisation rules of §2.9.

## 3.1.3 Dates and subtitles in titles

- Dates in titles are preceded by a comma.
- Subtitles are separated by a colon.

## 3.1.4 Volume numbers

- Use **roman or arabic as in the original source**.
- Thus: when referring to *Economic History Review* up to 2006, or
  *English Historical Review*, use roman numerals.
- For most other journals, use arabic numerals.

## 3.1.5 Articles / contributions to collections

- **Complete page references are essential.**

## 3.1.6 Online sources

- Full reference details + URL.
- Authorship, year, title of document/report, URL.
- If this info is not available, remove the reference and cite only the
  web address in the text.

## 3.1.7 Microfiche sources

- Full reference details + name of the microfiche collection + date (if
  available).

## 3.1.8 Economic History Review citations (critical)

- **Up to 1991**: follow with *2nd ser.* —
  e.g. *Economic History Review*, 2nd ser., XXII (1969).
- **From 1992 onwards**: omit *2nd ser.*
- **Up to 2006**: use roman numbering —
  e.g. *Economic History Review*, LVI.
- **From 2007 onwards**: use arabic numbering —
  e.g. *Economic History Review*, 60.
- Failure to use the correct form of volume numbering in references can
  cause the online reference linking function not to work correctly.

(The `echr.bbx` style handles these transformations automatically when
`journaltitle = {Economic History Review}` and `year` are set.)

## 3.1.9 Books — worked examples

Place of publication to be given in all cases EXCEPT London.

```
Church, R., The history of the British coal industry, 3, 1830–1913,
  Victorian pre-eminence (Oxford, 1986).

Cunningham, W., Alien immigrants to England (1879).

Halévy, E., A history of the English people in the nineteenth century,
  6 vols. (1913–34).

Heaton, H., The Yorkshire woollen and worsted industries from the
  earliest times up to the industrial revolution (Oxford, 2nd edn. 1965).

Kirby, J. L., ed., Abstracts of feet of fines relating to Wiltshire,
  1377–1509 (Wilts. Rec. Soc., XII, 1985).

Supple, B. E., The Royal Exchange Assurance: a history of British
  insurance, 1720–1970 (1970).
```

### Volume in a series / chapter in a collective work

Give editor(s) of the individual volume.

```
Chambers, J. D., 'Population change in a provincial town: Nottingham,
  1700–1800', in L. S. Pressnell, ed., Studies in the industrial
  revolution presented to T. S. Ashton (1960), pp. 97–124.

Landes, D., 'Technological change and development in western Europe,
  1750–1914', in H. J. Habakkuk and M. M. Postan, eds., Cambridge
  economic history of Europe, VI, pt. 1, The industrial revolution and
  after (Cambridge, 1965), pp. 274–601.
```

### Foreign titles

Follow the conventions of their own language. Thus German
capitalisation is more extensive:

```
Imhof, A. E., ed., Historische Demographie als Sozialgeschichte: Giessen
  und Umgebung vom 17. zum 19. Jahrhundert, 2 vols. (Darmstadt, 1975).
```

## 3.1.10 Articles — worked examples

- Omit the definite article from journal titles.
- Date of publication as year only, unless series has no numbered volumes.
- **DO NOT abbreviate journal titles** — it diminishes online
  reference-linking.
- Sequence: volume number, year of publication, page references.
- Give pagination numbers only for journals that paginate each issue
  from 1 (e.g. *History Today*, *Business History*).

```
Ashworth, W., 'Economic aspects of late Victorian naval administration',
  Economic History Review, 2nd ser., XXII (1969), pp. 491–505.

Whyte, I. D. and Whyte, K. A., 'Continuity and change in a
  seventeenth-century Scottish farming community', Agricultural History
  Review, 32 (1984), pp. 159–69.
```

## 3.1.11 Official papers

- Parliamentary Papers always abbreviated *P.P.*
- Give full title, year, volume number.
- Command paper number NOT required.

```
Select Committee on Manufactures, Commerce, and Shipping (P.P. 1833, VI).
Accounts and Papers (P.P. 1890, XLV), Dockyard expense accounts, 1888–9.
```

## 3.1.12 Theses

- No italics for titles of unpublished theses.

```
Vamplew, W., 'Railways and the transformation of the Scottish economy'
  (unpub. Ph.D. thesis, Univ. of Edinburgh, 1969).
```

## 3.1.13 Online sources — example

```
Smith, A., 'Select committee report into social care in the community'
  (1999) http://www.dhss.gov.uk/reports/report015285.html (accessed on
  7 Nov. 2003).
```

## 3.1.14 Microfiche — example

```
Maber, E. and Thornton, R., The cases of the defendant and plaintiff in
  error to be argued at the bar of the House of Lords 18 January 1722.
  Available on microfiche: British Trials, 1660–1900 (Cambridge, 1990).
```

---

## 3.2 Footnotes

- In footnotes, books, articles, essays, theses, and official
  publications should be referred to in **abbreviated form**, with the
  **precise page reference** if applicable.
- Reference to a **whole** article or book in general: no pagination.
- **ibid.** for consecutive citations of the same work (unless the
  previous note contains more than one source).
- **idem** when more than one work by the same author is cited within
  ONE footnote.
- **NEVER use** *op. cit.* or *loc. cit.*
- **Short titles** must be capable of standing alone — NOT
  computer-generated from the first words of the title.
- Similar short titles by an individual author must be clearly
  distinguished.

## 3.2.1 Books in footnotes

```
Cunningham, Alien immigrants, pp. 4–6.
Halévy, History of the English people, II, pp. 64–7.
Supple, Royal Exchange Assurance, p. 230.
Landes, 'Technological change', p. 382.
Kirby, ed., Feet of fines relating to Wiltshire, p. 19.
```

## 3.2.2 Articles in footnotes

```
Whyte and Whyte, 'Continuity and change', p. 163.
Ashworth, 'Economic aspects', p. 503.
```

## 3.2.3 Official papers in footnotes

Where a page reference is used, the CONTINUOUS pagination for the whole
volume (NOT the pagination for the individual report) must be given.

```
S.C. on Manufactures (P.P. 1833, VI), Q.456 or QQ.457–8.
Hansard (Commons), 4th ser., XXXVI, 22 Aug. 1896, cols. 641–2.
H. of C. Journals, LXXX (1824), p. 110.
H. of L. Journals, LXX (1824), 18 June.
```

## 3.2.4 Theses in footnotes

```
Vamplew, 'Railways', pp. 10–19.
```

## 3.2.5 Newspapers in footnotes

- Newspapers and manuscripts will NOT appear in the consolidated
  bibliography.
- Omit the definite article from newspaper titles, EXCEPT *The Times*.
- Sequence: title, day, month, year.

```
'The officious official' in Morning Post, 15 Sept. 1921.
Report in The Times, 30 Oct. 1918, p. 11, col. 1.
Economist, 11 Dec. 1920, p. 1032.
```

## 3.2.6 Manuscript references in footnotes

- **The National Archives** is abbreviated **TNA**.
- **The British Library** is abbreviated **BL**.
- Manuscript abbreviated as **MS** (not MSS); plural manuscripts = MSS.

```
TNA, King's Remembrancer's Memoranda Roll, E159/68, m, 78.
BL, Add. MS 36,042, fo. 2 (plural fos.).
```

Other repositories: give full title and location on first use, then
abbreviate:

```
Scottish Record Office (hereafter SRO), Airlie Papers, G.D. 16, section
  38/82, 5 April 1844.
Compton Papers, kept at the estate office of the Marquess of
  Northampton, Castle Ashby (hereafter CA), bundle 1011, no. 29.
Northampton County Record Office (hereafter NRO), Brudenell of Deene
  Papers, I.X.37, Peter Morlet to Thomas Lord Brudenell, 27 June 1652.
```

NOTE: Articles that rely heavily on unpublished discussion or research
papers and make extensive reference to them will not normally be
accepted for publication.

---

## Short-title conventions (authors' responsibility in `references.bib`)

For the footnote short-form to be coherent, every entry whose `title`
field is >5 words should have a `shorttitle` field. Examples:

| Full title | `shorttitle` |
|---|---|
| *Hall of Mirrors: The Great Depression, the Great Recession…* | `{Hall of mirrors}` |
| *A history of the English people in the nineteenth century* | `{History of the English people}` |
| 'Economic aspects of late Victorian naval administration' | `{Economic aspects}` |
| 'Continuity and change in a seventeenth-century Scottish farming community' | `{Continuity and change}` |

Short titles should:
- Stand alone and identify the work unambiguously.
- NOT be computer-generated from the first N words.
- Distinguish similar titles by the same author.

---

## Working-paper handling (§3.1.1 enforcement)

Working papers, research papers, and similar unpublished sources should
not appear in the consolidated bibliography. In the bib file, add:

```
@techreport{MyEntry2024,
  author    = {...},
  title     = {...},
  ...
  options   = {skipbib=true}
}
```

The `skipbib=true` option tells biblatex to exclude the entry from
`\printbibliography`, while still allowing it to be cited in footnotes.
Because the entry will not appear in the consolidated list, authors
should ensure the footnote citation contains enough context for readers
to locate the source (institution, working-paper number, URL).

Alternatively, cite unpublished sources inline in the footnote prose
(without `\cite`) — the Notes for Contributors do this implicitly in
§3.2.5 and §3.2.6 (newspapers and manuscripts cited in full in footnotes
only).
