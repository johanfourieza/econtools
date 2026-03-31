# EconTools

Custom skills for [Claude Code](https://claude.com/claude-code) designed for economics research workflows.

## Skills

### EconGuru

A simulated peer review system for economics working papers. EconGuru creates a panel of independent referee agents — each with a distinct subspecialisation, personality, and fictitious university affiliation — who review your paper in isolation, with strict information barriers mirroring real peer review. An editor synthesises their feedback into a prioritised briefing. You choose which changes to implement, and the tool revises your LaTeX files accordingly. Referees persist in a local library that grows over time, building a roster of specialists with track records and seniority scores.

**Installation:**

```bash
# In your Claude Code settings, add the skill path:
# ~/.claude/skills/econguru/skill.md
```

Or copy `econguru/skill.md` to your Claude Code skills directory.

**Usage:**

```
/econguru
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
