# Test fixture: expected verdicts

Use this to evaluate `/kris` end-to-end. Don't show this file to the agents — it's only for human grading.

| bib_key                  | expected         | why |
|--------------------------|------------------|------|
| acemoglu2001colonial     | REAL             | Real AER 2001 paper, valid DOI 10.1257/aer.91.5.1369 |
| hsiang2013climate        | REAL             | Real Science 2013 paper, valid DOI 10.1126/science.1235367 |
| piketty2014capital       | REAL             | Piketty's well-known book, ISBN resolves on OpenLibrary |
| smith2024unified         | FAKE             | Plausible-sounding ML paper. Title is generic/AI-tell, "Journal of AI Reasoning" is on the suspect-venue list, fabricated DOI 10.1234/... will not resolve |
| garcia2023dynamic        | FAKE             | Fabricated. Suspect venue ("Transactions on Artificial Intelligence"). No DOI. Will not appear in any database. |
| lee2025quantum           | FAKE             | Future year (2027), suspect venue, generic title pattern ("Towards…"), short author list |
| piketty2014keynes        | CHIMERIC         | ISBN 9780674430006 resolves to Piketty's *Capital* — title in .bib is wrong (Keynes book) |
| acemoglu1999colonial     | CHIMERIC         | DOI 10.1257/aer.91.5.1369 resolves to a different paper (year mismatch + title mismatch with the resolved record) |
| vaswani2017attention     | REAL (borderline)| Real arXiv preprint 1706.03762, also published in NeurIPS 2017. Should be REAL but coverage in CrossRef is partial |
| nakamura2018measuring    | REAL (borderline)| Real NBER working paper w19260. NBER refs sometimes have patchy coverage in OpenAlex |

Edge-case behaviour to verify:
- The two CHIMERIC entries have valid-looking DOIs that resolve, but the resolved record's title or year mismatches what the .bib claims. The Codex side's DOI-resolution check should catch both. The Claude side's red-flag heuristics may miss them — that's fine; the adversarial round is where Codex defends and Claude concedes.
- The FAKE entries have generic titles, suspect venues, and DOIs that won't resolve. Both sides should agree.
- The borderline entries should land as REAL (or UNCERTAIN with strong leaning toward REAL). They test that the skill doesn't false-positive on legitimate grey literature and preprints.
