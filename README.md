# EconTools

Custom skills for [Claude Code](https://claude.com/claude-code) designed for economics research workflows.

## Skills

### Diebolt

A simulated peer review system for economics working papers, named in honour of [Claude Diebolt](https://en.wikipedia.org/wiki/Claude_Diebolt) — Research Professor at CNRS, Director of BETA, and founding Managing Editor of *Cliometrica* — whose editorial generosity gave Johan Fourie and Dieter von Fintel their first chance with their 2010 *Cliometrica* paper on inequality in the Cape Colony, and who has been a steadfast supporter of work at Stellenbosch ever since.

Diebolt creates a panel of independent referee agents — each with a distinct subspecialisation, personality, and fictitious university affiliation — who review your paper in isolation, with strict information barriers mirroring real peer review. An editor synthesises their feedback into a prioritised briefing. You choose which changes to implement, and the tool revises your LaTeX files accordingly. Accepted papers are signed off with Claude Diebolt's own *Que la force*.

**Installation:**

```bash
# In your Claude Code settings, add the skill path:
# ~/.claude/skills/diebolt/skill.md
```

Or copy `diebolt/skill.md` to your Claude Code skills directory.

**Usage:**

```
/diebolt
```

Then follow the prompts to select a paper, target journal, and referee panel.

### Janluiten

A lifelong sounding board for research ideas, named in honour of [Jan Luiten van Zanden](https://www.uu.nl/staff/JLvanZanden) — Professor of Global Economic History at Utrecht University, mentor to a generation of economic historians, and Johan Fourie's own PhD advisor (Utrecht, 2012).

Janluiten helps you decide whether the idea on your desk is the right one to spend your next year on. He listens first, then asks — drawing on three things: the long view of how research programs rise and fall, cultural evolution (how prestige and conformity quietly steer what fields work on), and behavioural science (how researchers misread their own motives). The deliverable is mentorship on three questions: *what* to work on, *with whom*, and *why*. The axiom underneath all of it is that **interest is the best predictor of success**.

Use whenever you have a research idea — at any career stage, from a first paper to a senior pivot — and want help distilling whether it is the right one for you.

**Usage:**

```
/janluiten
```

### TannieDi

A LaTeX-to-Word round-trip tool for language editing. *Pack* converts your LaTeX project into a clean Word manuscript, and *unpack* applies the editor's tracked changes back into your original .tex files — preserving all LaTeX formatting, equations, and cross-references.

**Usage:**

```
/tanniedi pack
/tanniedi unpack
```

## License

MIT
