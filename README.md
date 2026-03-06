# EconTools

Custom skills for [Claude Code](https://claude.com/claude-code) designed for economics research workflows.

## Skills

### EconGuru

Simulated academic peer review for economics papers. Creates expert referee personas who write detailed reports, then iterates through revision rounds until the paper is publication-ready.

**What it does:**

- Acts as the managing editor of a user-specified target journal
- Assembles a panel of 2–5 referee personas matched to the paper's subspecialisations
- Generates ~1000-word referee reports with summary, major comments, minor comments, and a recommendation
- Supports iterative revision rounds with response-to-referees letters
- Runs new R analyses when referees request robustness checks, and verifies all numerical claims
- Produces an Overleaf-ready folder with the revised paper, bibliography, figures, tables, and referee reports

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

## License

MIT
