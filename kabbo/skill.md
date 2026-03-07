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
expand capabilities through skills and agents. Every metric uses economic
language; every recommendation includes a specific action.

## Data locations

- Session log: `~/.claude/workflow-tracker/sessions.jsonl`
- Decision queue: `~/.claude/workflow-tracker/decisions.jsonl`

---

# PART I: LOGGING

## Mode 1: LOG (end of session)

If the session contains substantive work, append ONE JSON line to
`sessions.jsonl`:

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
      "category": "paper-editing|data-analysis|website-management|github-ops|skill-development|teaching|admin|writing|coding|other",
      "project": "inferred-project-name",
      "skills_used": ["econguru"],
      "tools_used": ["Bash", "Edit"],
      "files_touched": ["path/to/file.tex"],
      "repetitive": false,
      "pain_points": "Optional: what was slow or token-heavy",
      "duration_minutes_est": 10
    }
  ],
  "multi_step_sequences": ["edit→copy→render→commit→push (website deploy)"],
  "manual_work_that_could_be_automated": ["Manually ran update_bookshop.py"],
  "skills_that_would_have_helped": ["A deploy-site skill"],
  "agents_that_would_have_helped": ["Background link-checker agent"],
  "notes": "Optional free-text"
}
```

**Field notes:**
- `focus_score`: max(category_share) across tasks. Range 0–1. Higher = more focused.
- `projects_touched`: Inferred from file paths. Short names (e.g., "website", "cape-wages").
- **Backward compatibility**: Old entries missing new fields default gracefully
  (focus_score=null, projects_touched=[], project="unknown").

**Logging rules:**
- Be precise about categories and tools — this data drives analytics.
- Capture multi-step sequences verbatim — these are automation candidates.
- Note pain points honestly.
- Trivial sessions (single question, no file work) get lightweight entries.

After logging: "Session logged. You now have N sessions in the tracker."

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

Each module requires minimum sessions for meaningful output. Below threshold,
state: "Need N more sessions for [X] analysis. Keep logging!"

| Module | Min sessions | Below threshold |
|--------|-------------|-----------------|
| 1. Yield Curve | 5 | Raw category counts only |
| 2. Token Economics | 3 | Current session intensity |
| 3. Temporal Patterns | 14 | Day-of-week counts (no trends) |
| 4. Automation Index | 5 | Backlog only (no ROI) |
| 5. Portfolio | 7 | Active projects only |
| 6. Nudges | 10 | One nudge from best-data module |

---

## MODULE 1: Productivity Yield Curve

**Frame:** Comparative advantage, opportunity cost

Tracks the ratio of high-value research work to infrastructure overhead.

**Categories:** Research (paper-editing, data-analysis, writing) | Investment (teaching) | Overhead (website-management, github-ops, admin, skill-development) | Neutral (coding, other)

| Metric | Formula | Target |
|--------|---------|--------|
| Research Yield Ratio (RYR) | research_tasks / total_tasks | > 0.60 |
| Infrastructure Tax | infra_tasks / total_tasks | < 0.30 |
| Yield Trend | Slope of RYR over rolling 14-day windows | Positive |

**Tier 1:** `Research Yield: 52% [!] (target >60%) | Infra Tax: 30% [ok] | Trend: ↑ +5pp/mo`

**Tier 2:** ASCII bar chart comparing RYR and Infra Tax over last 4 weeks.

**Tier 3:** Decompose by category within each group. Connect to Module 4: which automation would reduce the largest infrastructure drag. Comparative advantage analysis.

**Action:** When Infra Tax > 0.30, identify the largest category. Recommend: build skill, batch to one session/week, or delegate to agent. Quantify: "Reducing [category] by 50% pushes RYR from X% to Y%."

---

## MODULE 2: Token Economics Dashboard

**Frame:** Marginal cost curves, learning curves

Tracks cost-efficiency by task category. Heavy tokens on admin = overpaying.

| Metric | Formula | Target |
|--------|---------|--------|
| Token Intensity Score (TIS) | light=1, medium=2, heavy=3; weighted avg | Declining |
| Cost per Research Task | sum(intensity for research) / count | Declining |
| Heavy Session Rate | sessions(heavy) / total | < 0.25 |

**Tier 1:** `Token Efficiency: 2.1 [ok] | Heavy Rate: 28% [!] | Cost/Research: 2.4 ↓`

**Tier 2:** Intensity × Category matrix (cross-tab with trends per category).

**Tier 3:** Time series of TIS with spike annotations. Loss-aversion framing.

**Action:** Categories with avg intensity > 2.5 → "token diet": add context to CLAUDE.md, build skill, use prompt caching. Frame as loss: "Heavy tokens on github-ops 3 times = N research sessions forgone."

---

## MODULE 3: Temporal Patterns & Focus Analysis

**Frame:** Opportunity cost of context-switching

Tracks when you work, focus depth, and context-switching costs. 90+ minute
focus blocks on a single task type are the gold standard.

| Metric | Formula | Target |
|--------|---------|--------|
| Focus Score | avg of max(category_share) per session | > 0.70 |
| Context Switch Rate | avg distinct categories per session | < 2.5 |
| Deep Session Rate | long + ≤2 categories / total | Higher = better |

**Tier 1:** `Focus: 0.61 [!] (target >0.70) | Avg categories: 3.2 [!] | Deep: 22%`

**Tier 2:** Day-of-week heatmap with dominant categories + focus distribution chart.

**Tier 3:** Seasonal decomposition (semester vs vacation), anomaly detection, academic calendar overlay, forecasts.

**Action:** Identify best research day ("Protect your Tuesdays"). IF-THEN nudges for worst focus day. Quantify switching cost in intensity-units.

---

## MODULE 4: Automation Maturity Index (AMI)

**Frame:** Economies of scale, capital investment

The core automation tracker. Measures how much repetitive work has been
automated and identifies next build targets.

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Automation Coverage | tasks_using_skills / total | Rising = maturing |
| Repetition Rate | repetitive_tasks / total | Should decline |
| Skill Utilization | per skill: sessions_used / total | Underuse flags |
| Automation Backlog | distinct manual_work entries | Should shrink |
| Skill ROI | (repetitive_eliminated × intensity_saved) / build_cost | Prioritizes next build |

**Tier 1:** `Automation: 18% [!] | Backlog: 7 | Next: /deploy-site (ROI: 3.2x)`

**Tier 2:** Automation opportunity board (ranked candidates with freq, savings, build cost) + skill health table (utilization per skill).

**Tier 3:** Automation roadmap (month-by-month plan) + economies of scale learning curve.

**Action:** Highest-ROI candidate → trigger **Component 1 (Skill Auto-Draft)**. Top 3 candidates → trigger **Component 2 (Skill Discovery)**. Agent-suitable tasks → trigger **Component 3 (Agent Playbooks)**.

---

## MODULE 5: Project Portfolio Analyzer

**Frame:** Markowitz diversification, knowledge depreciation

Portfolio-level visibility across 10–20 projects. Knowledge depreciates when
you are away — context evaporates, co-authors move on, data becomes stale.

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Active Projects | distinct in last 14 days | Awareness |
| Herfindahl Index | sum(project_share²) | 0.10–0.30 healthy |
| Neglected Projects | active prior 30d, untouched 14+ days | Flags |
| Project Velocity | tasks/project/week | Momentum |

**Tier 1:** `Active: 6/14 | Concentration: 0.22 [ok] | Neglected: 3 [!]`

**Tier 2:** Portfolio table (project, tasks, last active, velocity, status) + neglected project alerts.

**Tier 3:** Phase each project (active/revision/dormant/completed). Pipeline health forecast. Knowledge depreciation warnings. Scope economies: shared skill usage across projects.

**Action:** Dormant projects → trigger **Component 3 (Context Refresher playbook)**. Portfolio rebalancing advice with comparative advantage framing.

---

## MODULE 6: Behavioral Nudge Engine

**Frame:** Kahneman-Tversky prospect theory, Becker-Murphy habit formation

Synthesises Modules 1–5 into behaviorally-informed nudges.

| Type | Frame | Example |
|------|-------|---------|
| Loss aversion | "You lost..." | "~3,200 tokens on manual deploys this month" |
| Streak | "Keep going..." | "Research focus streak: 4 days. Best: 7" |
| IF-THEN | "If X then Y" | "If Wednesday morning, then priority paper first" |
| Depreciation | "Context fading..." | "cape-wages dormant 15 days" |
| Opportunity cost | "Instead of..." | "3 admin sessions = 1 paper session forgone" |

**Tier 1:** One rotating nudge (loss-framed).

**Tier 2:** Three nudges from different types.

**Tier 3 — Monthly Executive Briefing** ("$50k management consultant" report):
- **Claude Code ROI**: sessions, hours saved, most valuable skill, biggest waste
- **THE ONE THING**: single highest-impact recommendation with payback estimate
- **Comparative advantage**: current vs optimal allocation with path to optimal
- **Economies of scale**: skills built, learning curve slope, cumulative savings
- **Economies of scope**: cross-project skill reuse, scope efficiency trend
- **Forecast**: automation coverage trajectory, next bottleneck prediction

All tiers end by showing **Component 5 (Decision Queue)** pending items.

---

# PART III: RULES & REFERENCE

1. **Never fabricate log data.** Only log what happened.
2. **Be specific.** "Run a background Explore agent to index LaTeX projects" not "consider agents."
3. **Quantify.** "3 of last 10 sessions" not "sometimes."
4. **Respect workflow.** Focus on genuine friction, not theoretical improvements.
5. **Tier-appropriate output.** Quick = 30s. Analytics = 2min. Deep = 5min.
6. **Search before building.** Recommend existing skills when available.
7. **Security first.** Flag low-star, unclear provenance, or suspicious external skills.
8. **Loss-aversion framing.** "You lost X" > "You could save X."
9. **Economic language.** Use the glossary. The user is an economist.
10. **Backward compatibility.** Default missing fields gracefully.

## Economic framing glossary

| Concept | Frame |
|---------|-------|
| Task allocation | Comparative advantage |
| Token spending | Marginal cost curve |
| Automation ROI | Capital investment with depreciation |
| Focus time | Opportunity cost of context-switching |
| Skill reuse across projects | Economies of scope |
| Repetitive task automation | Economies of scale |
| Project neglect | Knowledge depreciation |
| Batching tasks | Inventory management (EOQ) |
| Consistency | Habit formation (Becker-Murphy) |
| Framing waste | Prospect theory (Kahneman-Tversky) |
| Project balance | Markowitz diversification |
| Low-value spending | Deadweight loss |

## ASCII visualization primitives

Use consistently: Bar `████████░░ 58%` | Traffic `[ok]` `[!]` `[!!]` | Sparkline `▁▂▃▅▇█▇▅` | Trend `↑ +3pp` `↓` `→` | Header `━━━━━━━━━━`

---

# PART IV: PRESCRIPTIVE ENGINE

Part II identifies patterns. Part IV **acts on them**. Every Tier 2+ review
ends with prescriptive outputs. Goal: close the loop between insight and action.

---

## Component 1: Skill Auto-Drafting

**Trigger:** Module 4 identifies a repeated multi-step sequence with no existing skill.

Draft a complete skill.md skeleton for the #1 ROI candidate. Present:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRAFT SKILL: /deploy-site
Trigger: "deploy site", "push website", edits .qmd
Steps: 1. Copy → 2. quarto render → 3. git commit/push
Build: 30 min | ROI: 3.2x/month | Based on: 4 manual cycles
[APPROVE & BUILD] [MODIFY] [DEFER]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Rules:** Max 1 draft per review. Must include: name, trigger, steps, build
time, ROI. On approve → write to `~/.claude/skills/{name}/skill.md`. On
defer → log to decision queue.

---

## Component 2: Skill Discovery

**Trigger:** Every Tier 2+ review.

Search online for existing skills matching the top 3 automation candidates:
- GitHub: `awesome-claude-skills`, `ComposioHQ/awesome-claude-skills`,
  `travisvn/awesome-claude-skills`, `alirezarezvani/claude-skills`
- LobeHub: `lobehub.com/skills`
- General: `github.com/topics/claude-skills`

For each match report: name, source, stars, last updated, security assessment,
relevance, vs. custom build trade-off. Options: [INSTALL] [REVIEW] [BUILD CUSTOM].

**Rules:** Max 3 matches per review. Always include security flag. Log to
decision queue. If no matches: "No existing skills found. Custom build recommended."

---

## Component 3: Agent Playbooks

**Trigger:** Module 4 (agent-suitable tasks) or Module 5 (dormant projects).

Pre-built, copy-paste-ready agent invocations tailored to observed patterns.
Present the relevant playbook during review with the exact Agent tool call.

### Library

| Playbook | Trigger | Agent type | Prompt template |
|----------|---------|------------|-----------------|
| **Literature Scout** | Starting/revising a paper | Background, general-purpose | "Search Google Scholar, NBER, SSRN for papers citing [key ref] in last 2 years. Return: title, authors, journal, relevance." |
| **Link Auditor** | After website deploy | Background, general-purpose | "Read all .qmd files in [dir]. Extract every URL. Check each. Report 404/403/timeout with file and line." |
| **Context Refresher** | Project dormant >14 days | Explore, foreground | "Read CLAUDE.md + last 3 modified files in [dir]. Summarise: where left off, next step, pending decisions." |
| **Style Checker** | Before submitting draft | Background, general-purpose | "Read [paper.tex] and /leapstyle skill. Check preamble, colours, citations, register. Report deviations." |
| **Parallel Research** | Idle capacity on 2nd project | Background, general-purpose | "[Specific task for second project, e.g., clean CSV, check references]" |

**Growing the library:** When Kabbo spots a new agent-suitable pattern, draft
a playbook, present during review, and on approval add it permanently.

---

## Component 4: Scope Expander

**Trigger:** Every `/kabbo deep` review (monthly).

The "economies of scope" engine — identifies capabilities the user isn't
using but should be.

### Logic

1. Read `~/.claude/CLAUDE.md` (profile)
2. Read session log (actual usage)
3. Search for skills in **adjacent** domains based on task categories:

| If user does... | Search for... |
|---|---|
| paper-editing | citation checker, LaTeX linter, BibTeX deduplicator |
| data-analysis | R code reviewer, data validation, replication checker |
| website-management | SEO checker, link auditor, accessibility validator |
| teaching | slide generator, exam drafter, rubric builder |

4. Identify **profile gaps** — capabilities mentioned but never used:

| Profile signal | Potential gap |
|---|---|
| "PDF + PNG, 300 dpi" | Figure QA checker (DPI, colour, fonts) |
| "kableExtra/modelsummary" | Table formatting validator |
| "10–20 active projects" | Project triage agent |
| "Blog: ourlongwalk.com" | Blog workflow, podcast show notes |
| "LEAP style guide" | Style compliance checker |

**Output:** Max 3 scope expansions per deep review, ranked by relevance. For
each: what it does, why relevant, existing skill found or custom build needed.
Frame: "You're leaving capability on the table."

---

## Component 5: Decision Queue

**Purpose:** Turn recommendations into tracked, accountable actions.

### Schema (`decisions.jsonl`)

```json
{
  "id": "d001",
  "date_proposed": "2026-03-07",
  "type": "build_skill|install_skill|try_agent|scope_expansion|workflow_change",
  "description": "Build /deploy-site for deployment automation",
  "source_module": "Module 4",
  "estimated_roi": "3.2x/month",
  "status": "proposed|approved|completed|deferred|rejected",
  "date_resolved": null,
  "times_shown": 1
}
```

### Lifecycle

1. **Proposed** → logged when Kabbo generates a recommendation
2. **Shown** → each `/kabbo` shows pending decisions at the end of review
3. **Escalated** → after 3 reviews without action, loss-aversion framing with cumulative cost
4. **Resolved** → approved, completed, deferred (with reason), or rejected

```
PENDING DECISIONS
1. Build /deploy-site [proposed Mar 7, shown 3x] — cumulative loss: ~4,800 tokens
2. Install cite-checker [proposed Mar 7, shown 2x]
Act on any? Or defer/reject?
```

**Rules:** Max 5 pending. Celebrate completions. Track decision velocity.
