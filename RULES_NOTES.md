# Codegeist 2026 — rules notes

Read from the official pages before writing any code. The page most people land on,
`codegeist.devpost.com`, is the **2024** edition — the live 2026 page is
<https://codegeist2026.devpost.com/>. Snapshots of what was read are in
`.research/` (`ov2026.html`, `rules2026.html` plus text extracts, and the Forge
docs for `rovo:agent`, `rovo:action`, `rovo:mcp`, `modules`).

## Edition check

| Item | Value |
| --- | --- |
| Title | Codegeist 2026: Build with context. Ship with confidence. |
| Host | Atlassian, managed by Devpost |
| Page | <https://codegeist2026.devpost.com/> (2026, not the 2024 page) |
| Registration / submission window | Oct 27, 2026 9:00am PT → **Dec 22, 2026 12:00pm PT** |
| Judging | Jan 5, 2027 1:00pm PT → Feb 3, 2027 5:00pm PT |
| Winners announced | on or around Feb 15, 2027 |
| Prize pool | $120,000 cash |
| Participants at time of reading | 5,713 |
| Tags | Machine Learning/AI, Enterprise, Productivity |

## Theme

> AI can think. But knowing what to do — really knowing — takes context.
> Atlassian's Teamwork Graph connects goals, work, people, decisions, and
> outcomes … Build an app on Forge that uses that context to help teams ship
> with confidence — surfacing the right knowledge at the right moment,
> connecting work across silos, or turning organizational data into a decision
> that actually moves work forward.

Baton is built directly against that sentence: it puts the *reasoning* behind a
piece of work in front of the next person at the moment of handoff.

## What must be built

1. A **Forge** app (serverless, `manifest.yml`, at least one Forge module).
2. Integration with **at least one** Atlassian product or platform capability:
   Jira, Confluence, Jira Service Management, Bitbucket, Teamwork Graph, Rovo.
3. Entered into exactly one **category**:
   - **Apps for Software Teams** — dev teams shipping with confidence.
   - Apps for Business Teams — marketing, sales, HR, finance, support, legal.
   - Apps for Specialized Industries — healthcare, finance, manufacturing,
     automotive.
4. Project must be **new** (or rebuilt on Forge during the submission window),
   include a Forge manifest, and at least one Forge module.
5. Must be **installable in a judge's environment via an installation link**,
   run consistently, and function as depicted in the video/description.
6. Must be the **original work** of the entrant, own the IP, no third-party
   trademarks/music without permission, no conflicting SDK/API licences.

## Submission fields (Devpost "Enter a Submission")

- Project name, tagline, category
- Description of the project and what it does
- **Video** (see below)
- **Installation / testing link** and setup instructions for judges
- Built-with tags (technologies)
- Optional: extra links, screenshots, Try-it-out URL
- Repo or code access is not mandatory, but the app must be testable by judges

## Video

- Public YouTube (or Devpost-hosted) video, **under 5 minutes**.
- Must show the project **working end to end**, explain features and
  functionality, and cover: what problem, who it is for, why it matters.

## Judging

**Stage 1 — pass/fail.** Does the project reasonably fit the theme, and does it
reasonably apply the required APIs/SDKs?

**Stage 2 — five criteria, equally weighted:**

1. **Technological Implementation** — genuine working, non-trivial
   implementation, not a shallow wrapper or one hardcoded demo path.
2. **Design** — complete, coherent product experience, not a proof of concept.
3. **Potential Impact** — credible, specific case for a real problem for a real
   audience; the demo actually addresses it.
4. **Innovation / Idea** — creative, novel, differs from existing concepts.
5. **Presentation** — video demonstrates it working end to end; pitch is clear
   about problem, audience, and why it matters.

## Prizes

Per category: 1st **$15,000**, 2nd **$8,000**, 3rd **$5,000**.
First-place winners also get 2 tickets to Team 2027 (AMER, travel not included).

Bonus prizes, **$1,500 each**, six of them:

| Bonus | Requirement |
| --- | --- |
| Best Agents | Forge app with `rovo:agent`, `rovo:agentConnector`, or reusable `rovo:skill` / `rovo:action` modules other agents can invoke |
| Best app with Atlassian MCP | Forge app exposing tools through the Atlassian MCP server via `rovo:mcp` |
| Best Teamwork Graph integration | Connects data into and/or consumes data from the Teamwork Graph API |
| Best Marketplace published app | Published, or submitted for listing (link to listing or review ticket) |

Prizes are per-submission and can stack with the category prize.

## How Baton maps to the judges

| Criterion | Where it is answered |
| --- | --- |
| Technological Implementation | Deterministic analysis engine in `src/shared` (tokenising, IDF weighting, supersession detection, confidence model), Forge resolvers with real Jira/Confluence reads, storage-backed handoff history, 23 unit tests |
| Design | Issue panel, global handoff-health page, issue action, Rovo agent: one brief rendered consistently across all four surfaces |
| Potential Impact | Handoff is where context loss costs the most; the brief names the missing decision, the stale fact, and who to ask |
| Innovation | No LLM: every line of the brief is traceable to a Jira comment or a Confluence page, with a stated reason for its rank |
| Presentation | `VIDEO_SCRIPT.md` + real screenshots of the shipped bundle |

**Category:** Apps for Software Teams.
**Bonus targets:** Best Agents (`rovo:agent` + two `action` modules) and Best app
with Atlassian MCP (`rovo:mcp` exposing the same two actions).

## Hard constraints this repo keeps

- No external egress: only `asApp()` calls to the Jira/Confluence REST APIs of
  the host site, and Forge storage for state. No third-party services, no LLM
  calls, no analytics.
- No secrets in the repo, no credentials, no `.env`.
- Deterministic output: same issue + same date ⇒ same brief, same fingerprint.
