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

### TannieDi

A LaTeX-to-Word round-trip tool for language editing. *Pack* converts your LaTeX project into a clean Word manuscript, and *unpack* applies the editor's tracked changes back into your original .tex files — preserving all LaTeX formatting, equations, and cross-references.

**Usage:**

```
/tanniedi pack
/tanniedi unpack
```

## License

MIT
