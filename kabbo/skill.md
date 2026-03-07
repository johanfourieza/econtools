---
name: kabbo
description: "Workflow tracker and productivity advisor. Logs session activity, analyzes patterns over time, and recommends skills, agents, and optimizations. Run at end of session to log, or at start/periodically to get recommendations. Use '/kabbo quick' for headlines, '/kabbo analytics' for full dashboard, '/kabbo deep' for monthly executive briefing."
---

# //Kabbo — Workflow Tracker & Productivity Advisor

> Named after //Kabbo (/Han≠kass'o, 1815–1876), a /Xam visionary, rainmaker,
> and storyteller from the Northern Cape. He spent over a thousand days with
> Wilhelm Bleek and Lucy Lloyd recording the knowledge of his people — over
> 12,000 handwritten pages now in UNESCO's Memory of the World Register.
> //Kabbo understood that preserving and transmitting accumulated wisdom was
> the highest form of practical intelligence.
> See: https://www.capetownmuseum.org.za/they-built-this-city/kabbo

## Purpose

//Kabbo tracks the user's Claude Code workflow across sessions and provides
actionable recommendations to improve productivity, reduce token usage, and
expand capabilities through skills and agents. Every metric is framed in
economic language and every recommendation includes a specific action.

## Data location

- Session log: `~/.claude/workflow-tracker/sessions.jsonl`
- Each line is a JSON object representing one session summary.

---

# PART I: LOGGING

## Mode 1: LOG (end of session)

If the current session contains substantive work (file edits, tool usage,
tasks completed), log it. Review the conversation so far and append ONE
JSON line to `sessions.jsonl` with this structure:

```json
{
  "date": "YYYY-MM-DD",
  "duration_estimate": "short|medium|long",
  "duration_minutes_est": 45,
  "token_intensity": "light|medium|heavy",
  "focus_score": 0.75,
  "projects_touched": ["website", "econguru"],
  "tasks": [
    {
      "description": "Brief description of what was done",
      "category": "one of: paper-editing, data-analysis, website-management, github-ops, skill-development, teaching, admin, writing, coding, other",
      "project": "inferred-project-name",
      "skills_used": ["econguru", "leapstyle"],
      "tools_used": ["Bash", "Edit", "WebSearch"],
      "files_touched": ["path/to/file.tex"],
      "repetitive": false,
      "pain_points": "Optional: what was slow, awkward, or token-heavy",
      "duration_minutes_est": 10
    }
  ],
  "multi_step_sequences": [
    "edit file -> copy to repo -> render -> commit -> push (website deploy)"
  ],
  "manual_work_that_could_be_automated": [
    "Had to manually run update_bookshop.py before render"
  ],
  "skills_that_would_have_helped": [
    "A deploy-site skill to automate the render-commit-push cycle"
  ],
  "agents_that_would_have_helped": [
    "A background agent to verify all links on the website are live"
  ],
  "notes": "Optional free-text observations"
}
```

### Schema field definitions

**Session-level fields:**
- `duration_minutes_est`: Numeric estimate of total session duration in minutes.
  Short ≈ 5–15 min, Medium ≈ 15–60 min, Long ≈ 60+ min. Keep the categorical
  `duration_estimate` for backward compatibility.
- `focus_score`: Computed at log time. Calculate the share of tasks in each
  category; the focus score is the maximum share. Range 0–1. Higher = more
  focused session. Example: 5 tasks, 3 are paper-editing → focus_score = 0.6.
- `projects_touched`: List of distinct project names inferred from
  `files_touched` paths across all tasks. Infer from the top-level directory
  under the workspace root, or from a project CLAUDE.md if the session runs
  inside a project directory. Use short, recognizable names (e.g., "website",
  "cape-wages", "econguru", "econ214").

**Task-level fields:**
- `project`: Inferred from the files touched in this specific task. Same
  inference rule as `projects_touched`. Default: "unknown" if no files touched.
- `duration_minutes_est`: Rough estimate for this task within the session.

### Logging rules

- Be precise about categories and tools — this data drives the analytics.
- Capture multi-step sequences verbatim — these are automation candidates.
- Note pain points honestly — "searched for same file 3 times" matters.
- If the session was trivial (a single question, no file work), log it as
  a lightweight entry and move on.
- **Backward compatibility**: Old session entries that lack the new fields
  (focus_score, projects_touched, project, duration_minutes_est) are handled
  gracefully. Default: focus_score=null, projects_touched=[], project="unknown",
  duration_minutes_est=null.

After logging, confirm to the user: "Session logged. You now have N sessions
in the tracker."

---

# PART II: ANALYTICS

## Invocation modes

| Command | Tier | Time | What it does |
|---------|------|------|-------------|
| `/kabbo` | Auto | Varies | LOG if end of session, REVIEW if start, BOTH if 7+ days since review |
| `/kabbo quick` | 1 | 30 sec | 4 headline numbers with traffic lights |
| `/kabbo analytics` | 2 | 2 min | Full dashboard across all 6 modules |
| `/kabbo deep` | 3 | 5 min | Monthly executive briefing with forecasts |
| `/kabbo log` | — | 1 min | Force log mode only |

## Minimum data thresholds

Each module requires a minimum number of logged sessions to produce meaningful
output. Below threshold, the module states: "Need N more sessions for [X]
analysis. Keep logging!" Do not produce spurious patterns from small samples.

| Module | Min sessions | Below threshold |
|--------|-------------|-----------------|
| 1. Yield Curve | 5 | Show raw category counts only |
| 2. Token Economics | 3 | Show current session intensity |
| 3. Temporal Patterns | 14 | Show day-of-week counts (no trends) |
| 4. Automation Index | 5 | Show backlog only (no ROI) |
| 5. Portfolio | 7 | Show active projects only |
| 6. Nudges | 10 | Show one nudge from best-data module |

---

## MODULE 1: Productivity Yield Curve

**Economic frame:** Comparative advantage, opportunity cost

**What it measures:** The ratio of high-value research work to infrastructure
work. An economist's comparative advantage is in research — paper-editing,
data-analysis, writing. Infrastructure work (website-management, github-ops,
admin, skill-development) is necessary but should be minimised through
automation. This module tracks whether Claude Code usage is converging toward
the user's comparative advantage over time.

### Category classification

| Group | Categories | Label |
|-------|-----------|-------|
| Research | paper-editing, data-analysis, writing | High-value |
| Teaching | teaching | Investment |
| Infrastructure | website-management, github-ops, admin, skill-development | Overhead |
| Other | coding, other | Neutral |

### Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Research Yield Ratio (RYR) | research_tasks / total_tasks | > 0.60 |
| Infrastructure Tax | infra_tasks / total_tasks | < 0.30 |
| Yield Trend | Slope of RYR over rolling 14-day windows | Positive |
| Session Depth | avg tasks per session (research categories) | Increasing |

### Visualization

**Tier 1 (quick):**
```
Research Yield: 52% [!] (target >60%)  |  Infra Tax: 30% [ok]  |  Trend: ↑ +5pp/mo
```

**Tier 2 (analytics) — ASCII bar chart comparing last 4 weeks:**
```
PRODUCTIVITY YIELD CURVE (% research vs infrastructure)
Week  Research                          Infra
W12   ██████████████████████████░░░░░░  52% / 30%
W11   ████████████████████████░░░░░░░░  48% / 35%
W10   ██████████████████████████████░░  58% / 25%  ← best
W09   ████████████████████░░░░░░░░░░░░  42% / 38%  [!]
```

**Tier 3 (deep):** Decompose by category within each group. Identify which
infrastructure category is the largest drag. Connect to Module 4 (which
automation would reduce it). Include comparative advantage analysis:
"Your revealed comparative advantage is in [X]. Every hour on [Y] is an hour
not spent on the work that advances your research and your field."

### Actionable output

When Infrastructure Tax > 0.30:
- Identify the largest infrastructure category
- Recommend: (a) build a skill, (b) batch to one session/week, or (c) delegate to agent
- Quantify: "Reducing website-management by 50% would push RYR from 52% to 61%"

---

## MODULE 2: Token Economics Dashboard

**Economic frame:** Marginal cost curves, learning curves

**What it measures:** The cost-efficiency of Claude Code usage by task
category. If heavy-intensity sessions are spent on trivial admin, you are
overpaying. If paper-editing sessions become lighter over time (refined prompts,
cached context, skill-handled boilerplate), your learning curve is paying off.

### Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Token Intensity Score (TIS) | light=1, medium=2, heavy=3; weighted avg | Lower = more efficient |
| Cost per Research Task | sum(intensity for research tasks) / count | Declining = good |
| Cost per Infra Task | sum(intensity for infra tasks) / count | Should be lowest |
| Heavy Session Rate | sessions(heavy) / total_sessions | Target < 0.25 |
| Intensity–Category Matrix | Cross-tab of intensity × category | Spots overpaying |

### Visualization

**Tier 1 (quick):**
```
Token Efficiency: 2.1 avg [ok]  |  Heavy Rate: 28% [!]  |  Cost/Research: 2.4 (was 2.7) ↓
```

**Tier 2 (analytics) — matrix table:**
```
TOKEN INTENSITY BY CATEGORY (last 30 days)
                    Light  Medium  Heavy  Avg    Trend
paper-editing         1      3       2    2.2    ↓
data-analysis         0      2       3    2.6    →     [!] expensive
website-management    2      4       1    1.9    ↓↓    /deploy-site paying off
github-ops            3      1       0    1.3    →     [ok]
skill-development     0      1       2    2.7    →     [!] expected for builds
teaching              1      0       0    1.0    →
admin                 2      1       0    1.3    →
```

**Tier 3 (deep):** Time series of TIS with annotations for spikes. Loss
aversion framing: "Your 3 heavy-intensity admin sessions last month cost the
equivalent of 1 full paper-editing session. If batched with a skill, estimated
savings: 6 intensity-units (≈ 2 light research sessions recovered)."

### Actionable output

- Categories with avg intensity > 2.5 → "token diet" recommendation:
  add context to project CLAUDE.md, build a skill, use prompt caching.
- Frame as loss: "You spent heavy tokens on github-ops 3 times. A /deploy-site
  skill would reduce each to light-intensity. You are losing the equivalent
  of N research sessions per month."

---

## MODULE 3: Temporal Patterns & Focus Analysis

**Economic frame:** Opportunity cost of context-switching

**What it measures:** When you work, how you distribute effort, and whether
you achieve deep focus. Knowledge worker research shows 90+ minute focus
blocks on a single task type are the gold standard. Context-switching between
paper-editing and website-management in the same session is costly.

### Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Focus Score | max(category_share_in_session), averaged over sessions | > 0.70 |
| Context Switch Rate | avg distinct categories per session | < 2.5 |
| Deep Session Rate | sessions(duration=long AND categories ≤ 2) / total | Higher = better |
| Day-of-Week Profile | session count + dominant category by weekday | Pattern detection |

### Visualization

**Tier 1 (quick):**
```
Focus: 0.61 [!] (target >0.70)  |  Avg categories/session: 3.2 [!]  |  Deep: 22%
```

**Tier 2 (analytics) — day-of-week heatmap + focus distribution:**
```
WEEKLY RHYTHM (last 30 days)
Mon  ████████  8 sessions  [mixed: paper, admin, website]
Tue  ██████    6 sessions  [focused: paper-editing dominant]
Wed  ████████  8 sessions  [mixed: data, website, github]
Thu  ████      4 sessions  [focused: data-analysis]
Fri  ██        2 sessions  [admin cleanup]
Sat  ░         0
Sun  ░         0

FOCUS DISTRIBUTION
Single-category  █████████████░░░░░░░░░░░░░░░░░  35%
Two-category     █████████████████░░░░░░░░░░░░░  25%
Three+           ████████████████████████░░░░░░  40%  [!]
```

**Tier 3 (deep):**
- Seasonal decomposition: "During semester, admin share rises to X%. During
  vacation, research yield peaks at Y%. This Zpp swing suggests semester admin
  is your biggest productivity drag."
- Anomaly detection: Flag unusual sessions (e.g., "4 website sessions in 2 days
  vs baseline of 1/week").
- Forecast: "Based on patterns, heavy admin load expected in [week]. Consider
  pre-building automation."
- Academic calendar overlay: map patterns to semester/vacation/exam/grant cycles.

### Actionable output

- Identify best research day: "Your Tuesdays are your best research days
  (focus 0.82). Protect them."
- Identify worst focus day with IF-THEN nudge: "Wednesdays show 4+ categories.
  Try: IF Wednesday morning THEN 90 min on priority paper BEFORE infrastructure."
- Flag context-switching cost: "Sessions with 4+ categories average 2.5
  intensity vs 1.8 for single-category sessions. Switching costs you 0.7
  intensity-units per session."

---

## MODULE 4: Automation Maturity Index (AMI)

**Economic frame:** Economies of scale, capital investment with depreciation

**What it measures:** How much repetitive work has been automated through
skills, agents, and refined workflows. This is the core economies-of-scale
metric. The first skill takes hours to build; the twentieth takes minutes.
Track where you are on this learning curve.

### Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Automation Coverage | tasks_using_skills / total_tasks | Rising = maturing |
| Repetition Rate | tasks_flagged_repetitive / total_tasks | Should decline |
| Skill Utilization | per skill: sessions_used / total_sessions | Underuse flags |
| Automation Backlog | distinct entries in manual_work_that_could_be_automated | Should shrink |
| Pain Point Recurrence | similar pain_points across sessions (top 3) | Build targets |
| Skill ROI | (repetitive_tasks_eliminated × avg_intensity_saved) / build_cost | Prioritizes next build |

### Visualization

**Tier 1 (quick):**
```
Automation: 18% [!]  |  Backlog: 7 candidates  |  Next target: /deploy-site (ROI: 3.2x)
```

**Tier 2 (analytics) — automation opportunity board:**
```
AUTOMATION MATURITY INDEX
Coverage ██████░░░░░░░░░░░░░░░░░░░░░░░░  18% (target >50% by month 3)

TOP AUTOMATION CANDIDATES (by estimated ROI)
Rank  Pattern                              Freq  Est. Savings    Build Cost
  1   website deploy (edit→render→push)     4x    2000 tok/mo    1 session
  2   bookshop pipeline (xlsx→py→render)    2x     800 tok/mo    0.5 session
  3   skill install from GitHub             2x     400 tok/mo    0.5 session

SKILL HEALTH
  econguru    ████████░░  Used 1/10 sessions  [ok — specialized]
  leapstyle   ░░░░░░░░░░  Used 0/10 sessions  [!] dormant
  tanniedi    ░░░░░░░░░░  Used 0/10 sessions  [!] dormant
  olwstyle    ░░░░░░░░░░  Used 0/10 sessions  [!] dormant
  kabbo       █████████░  Used 9/10 sessions  [ok — meta-skill]
```

**Tier 3 (deep) — automation roadmap + learning curve:**
```
AUTOMATION ROADMAP
Month 1: Build /deploy-site → -4 tasks/wk, -2000 tokens/mo
Month 2: Build /bookshop-update, /skill-install → -3 tasks/wk
Month 3: Refine CLAUDE.md context for paper-editing → -1 intensity/session

ECONOMIES OF SCALE CURVE (skill development learning curve)
Skills built:   1 ──── 2 ──── 3 ──── 4 ──── 5
Avg build time: 3hr   2hr   1.5hr  1hr   0.5hr
Cumul. savings: 2k tokens/mo → 5k → 8k → 10k → 12k
```

Also search online (GitHub, LobeHub, awesome-claude-skills) for existing skills
that match automation candidates. For each external skill found:
- Name and link
- One-line description
- Relevance to user's pattern
- Security assessment (clean / review carefully / avoid)

### Agent recommendations

Within this module, identify tasks where agents would help:

- **Parallel agents**: tasks that could run simultaneously
  (e.g., "while editing paper X, launch an agent to search for literature")
- **Background agents**: long-running tasks not needing immediate results
  (e.g., "link-checking across all website pages")
- **Specialist agents**: focused exploration tasks
  (e.g., "Explore agent to map a new codebase before editing")

For each, provide the exact invocation:
```
Agent tool, subagent_type: "general-purpose", run_in_background: true
Prompt: "Check all URLs in research.qmd and report any broken links"
```

### Actionable output

Always show the single highest-ROI automation candidate with a one-line spec:
"Build a /deploy-site skill that takes a source dir and GitHub Pages repo,
syncs changed files, renders, and pushes. Estimated payback: 2 sessions."

---

## MODULE 5: Project Portfolio Analyzer

**Economic frame:** Markowitz diversification, knowledge depreciation

**What it measures:** Which projects are getting attention, which are
neglected, and whether allocation is rational. An academic managing 10–20
projects needs portfolio-level visibility. Knowledge of a project depreciates
when you are away from it — context evaporates, co-authors move on, data
becomes stale.

### Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Active Projects | distinct projects in last 14 days | Awareness |
| Herfindahl Index | sum(share_of_tasks_per_project²) | 0.10–0.30 = healthy |
| Neglected Projects | active in prior 30d but untouched for 14+ days | Flags |
| Project Velocity | tasks/project/week, trended | Momentum |
| Cross-Project Scope | sessions touching 2+ projects in same category | Efficiency |

### Visualization

**Tier 1 (quick):**
```
Active: 6/14 projects  |  Concentration: 0.22 [ok]  |  Neglected: 3 [!]
```

**Tier 2 (analytics) — portfolio table:**
```
PROJECT PORTFOLIO (last 14 days)
Project                Tasks  Last Active  Velocity  Status
Website                  7    Mar 7        ███████   [hot]
EconGuru skill           4    Mar 7        ████      [active]
Kabbo skill              2    Mar 7        ██        [new]
cape-wages               0    Feb 20       ░         [!] dormant 15d
econ214-slides           0    Feb 18       ░         [!] dormant 17d

NEGLECTED PROJECT ALERT
  cape-wages: Last touched Feb 20. Was averaging 3 tasks/wk.
  >> Is this deliberate (waiting for co-author/data) or drift?
```

**Tier 3 (deep) — portfolio lifecycle + pipeline analysis:**
- Phase each project: active development / revision / dormant / completed
- Pipeline health: "3 papers in revision, 0 in active data analysis. Your
  pipeline will thin out in 6 months if you don't start new empirical work."
- Knowledge depreciation warning: "You lose ~23% of working context per week
  away from a project. A 30-minute re-engagement session preserves your
  investment."
- Scope economies: "Your leapstyle skill serves N papers. That is an Nx return
  on the time invested in building it."

### Actionable output

- Dormant project alerts with depreciation framing
- Portfolio rebalancing advice: "You spent 60% of last month on website. Your
  comparative advantage is in research. Consider whether the website time has
  positive ROI for your research program."
- Scope economy highlights: shared skill usage across projects

---

## MODULE 6: Behavioral Nudge Engine

**Economic frame:** Kahneman-Tversky prospect theory, Becker-Murphy habit
formation

**What it measures:** Nothing new — this module synthesises Modules 1–5 and
delivers insights as behaviorally-informed nudges. Drawing on loss aversion,
implementation intentions, streak tracking, and default effects.

### Nudge types

| Type | Source | Frame | Example |
|------|--------|-------|---------|
| Loss aversion | Modules 2, 4 | "You lost..." | "You lost ~3,200 tokens on manual deploys this month" |
| Streak | Module 1 | "Keep going..." | "Research focus streak: 4 days. Personal best: 7" |
| IF-THEN | Module 3 | "If X then Y" | "If Wednesday morning, then 90 min priority paper first" |
| Best self | Module 3 | "Your best week..." | "Best week was Feb 12: RYR 72%. Current: 52%" |
| Depreciation | Module 5 | "Context fading..." | "cape-wages dormant 15 days — context depreciating" |
| Opportunity cost | Module 1 | "Instead of..." | "3 admin sessions = 1 paper session forgone" |

### Visualization

**Tier 1 (quick) — one rotating nudge:**
```
NUDGE: You lost ~3,200 tokens last week on manual deploys. /deploy-site
would recover them. Build time: 1 session. Payback: 2 weeks.
```

**Tier 2 (analytics) — three nudges:**
```
BEHAVIORAL INSIGHTS
[LOSS]   3 heavy admin sessions this month = 1 paper session forgone.
         Batch admin to Fridays (your lowest-research day).

[STREAK] Research focus streak: 4 days. Personal best: 7 (Feb 12–18).
         3 days from matching your record.

[IF→THEN] Wednesdays average 4.2 categories/session.
          IF Wednesday morning THEN 90 min on priority paper BEFORE infra.
```

**Tier 3 (deep) — Monthly Executive Briefing:**

This is the "$50k management consultant" report. Produce it monthly or on
`/kabbo deep`. Structure:

```
//KABBO MONTHLY EXECUTIVE BRIEFING — [Month Year]

YOUR CLAUDE CODE ROI
Sessions: N  |  Est. hours saved: X–Y (vs manual workflow)
Most valuable skill: [name] (saved ~Z hours of manual [task])
Biggest waste: [pattern] (manual, repeated N times = ~X hours lost)

THE ONE THING
If you do nothing else this month, [specific recommendation].
  - Eliminates your #1 [repetitive sequence / pain point]
  - Saves ~N tokens/month
  - Frees ~X hours/month for research
  - Payback: Y sessions to build, recouped in Z weeks

COMPARATIVE ADVANTAGE ANALYSIS
You are spending your Claude Code time as if you are a [infrastructure role]
who occasionally writes papers. Your revealed comparative advantage
(publication record, citation impact) is in [domain].

Optimal allocation (based on your patterns):
  Research (paper + data + writing):  65%  (current: N%)
  Teaching:                           15%  (current: N%)
  Infrastructure (website + github):  15%  (current: N%)  ← target
  Meta (skills + admin):               5%  (current: N%)

Path to optimal: [specific steps — build N skills, batch infra to 1 session/wk]

ECONOMIES OF SCALE REPORT
  Skills built to date: N
  Avg build time trend: X → Y hours (learning curve slope: Z%)
  Cumulative token savings: N tokens/month
  Skills with highest ROI: [ranked list]
  Skills dormant (consider retiring): [list]

ECONOMIES OF SCOPE REPORT
  Skills serving multiple projects: [list with project counts]
  Cross-project prompt reuse: [estimate]
  Scope efficiency: [trend]
  Recommendation: [which project domains could share more infrastructure]

FORECAST
  Based on current trajectory:
  - Automation coverage will reach X% by [date]
  - Research yield will reach target (60%) by [date] if [condition]
  - Next bottleneck: [predicted friction point]
```

---

# PART III: IMPORTANT RULES

1. **Never fabricate log data.** Only log what actually happened in the
   session. If you can't determine what happened, ask the user.
2. **Be specific in recommendations.** "Consider using agents" is useless.
   "Run a background Explore agent to index your LaTeX projects" is useful.
3. **Quantify where possible.** "This pattern appeared in 3 of your last
   10 sessions" is better than "you do this sometimes."
4. **Respect the user's workflow.** Don't recommend changes to things that
   work well. Focus on genuine friction points.
5. **Keep output tier-appropriate.** Quick = 30 seconds. Analytics = 2 minutes.
   Deep = 5 minutes. Do not exceed.
6. **Search before recommending a build.** If a good skill already exists
   online, recommend installing it rather than building from scratch.
7. **Security first on external skills.** Always flag if an online skill
   has low stars, unclear provenance, or suspicious instructions.
8. **Use loss-aversion framing.** "You lost X" is always more motivating
   than "You could save X." Frame waste as forgone research sessions.
9. **Economic language throughout.** Use the glossary below. The user is an
   economist — speak the language.
10. **Backward compatibility.** Handle old session entries gracefully. Default
    missing fields (focus_score=null, projects_touched=[], project="unknown").

## Economic framing glossary

Use these frames consistently throughout all analytics output:

| Analytics concept | Economic frame |
|-------------------|---------------|
| Task allocation | Comparative advantage |
| Token spending | Marginal cost curve |
| Automation ROI | Capital investment with depreciation |
| Focus time | Opportunity cost of context-switching |
| Skill reuse across projects | Economies of scope |
| Repetitive task automation | Economies of scale / returns to scale |
| Project neglect | Knowledge depreciation / capital decay |
| Batching similar tasks | Inventory management (EOQ model) |
| Consistency tracking | Habit formation (Becker-Murphy) |
| Framing waste | Prospect theory (Kahneman-Tversky) |
| Project balance | Markowitz diversification |
| Spending on low-value tasks | Misallocation / deadweight loss |

## ASCII visualization primitives

Use these consistently across modules:

| Primitive | Example | Usage |
|-----------|---------|-------|
| Bar chart | `████████░░░░░░ 58%` | Category shares, yields |
| Traffic light | `[ok]` `[!]` `[!!]` | All quick-check metrics |
| Sparkline | `▁▂▃▅▇█▇▅▃▂` | Trends over time |
| Trend arrow | `↑ +3pp` `↓ -2pp` `→ flat` | All trended metrics |
| Progress bar | `██████░░░░░░░░░░ 30%` | Coverage, targets |
| Table | Markdown with alignment | Matrices, rankings |
| Header line | `━━━━━━━━━━━━━━━━━` | Section dividers |
