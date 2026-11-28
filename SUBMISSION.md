# Devpost submission — copy/paste fields

Ready for the "Enter a Submission" form on
<https://codegeist2026.devpost.com/>. Video and installation links are live.

## Project name

Baton

## Elevator pitch (≤ 200 chars)

Baton gives the next owner of a Jira issue a short, ranked handoff brief — the
decisions that still hold, what was superseded, what is missing, and how confident
the record really is.

## Category

**Apps for Software Teams**

## Bonus prizes targeted

- **Best Agents** — `rovo:agent` (Baton handoff agent) plus two reusable `action`
  modules it calls.
- **Best app with Atlassian MCP** — `rovo:mcp` exposes the same two actions as MCP
  tools (`baton-handoff-brief`, `baton-handoff-health`).
- *Not targeted:* Best Teamwork Graph integration (no Teamwork Graph API calls),
  Best Marketplace published app (would require a Marketplace listing).

## Description

> Paste from here.

**The problem.** Work changes hands constantly — leave, rotation, an issue
reopened after three months, a new engineer picking up a stale ticket. The ticket
records *what*; the *why* is scattered across a February comment, a postmortem in
Confluence, a changelog entry, and one person's memory. The next owner either
rebuilds the decision from fragments or re-litigates something the team already
settled. Both waste days, and neither shows up in any report.

**What Baton does.** Baton is a Forge app that assembles a handoff brief for a
Jira issue from the context that already exists: the issue, its comments, its
changelog, its links, and the Confluence pages that mention it. It ranks those
facts by how load-bearing they are, names the risks that would burn the next
owner, and puts a confidence number on the whole thing.

The brief answers five questions, in order:

1. **What is the current decision?** The newest un-superseded decision, quoted.
2. **What else carries weight?** Ranked context with a stated reason for each
   rank — which terms it shares with the issue, how authoritative the source is,
   how fresh it is.
3. **What is no longer true?** Supersession detection. "We moved to the sliding
   window limiter *instead of* the fixed window" retires two older facts; Baton
   lists them and quotes the statement that retired them.
4. **What is missing?** Coverage over five buckets (decision, spec, history,
   people, recency), with the gap spelled out — "no recorded decision" is not a
   footnote, it is the top risk.
5. **What should happen next?** Concrete actions, e.g. "Ask Marco Silva to
   re-confirm or retire it", "Read what changed, do not duplicate the old
   reasoning".

**Why it is different.** There is no language model in the loop. Every line in the
brief is traceable to a specific Jira comment, changelog entry or Confluence page,
and every rank prints its reason. That matters for a handoff: a confident-sounding
summary that quietly invents a decision is worse than no summary at all. Baton is
deterministic — the same issue on the same date produces the same brief and the
same fingerprint, which is exactly what makes drift detectable.

**Surfaces.** The same engine powers four surfaces, so the brief does not live in
one tab:

- an **issue panel** that is always there while you read the ticket;
- an **issue action** that builds the brief, posts it as an ADF comment and
  records the handoff;
- a **global handoff-health page** with average confidence, the share of handoffs
  that went out below 60%, a weekly trend, and the weakest recent handoffs first;
- a **Rovo agent** ("What do I need to know before I take over PAY-412?") and two
  **MCP tools**, so the same answers reach an agent or a third-party client.

**Built inside the Atlassian boundary.** Forge only: `asApp()` calls to the host
site's Jira and Confluence REST APIs, Forge storage (`@forge/kvs`) for the last
brief per issue and the handoff index. No external permissions, no third-party
services, no analytics, no egress. Scopes: `read:jira-work`, `read:jira-user`,
`read:confluence-content.all`, `storage:app`.

**Honest limits.** Supersession is lexical, not semantic: it catches explicit
replacement language ("instead of", "no longer", "superseded"), so a decision
reversed with no trace stays invisible — which is why stale and single-source
signals exist separately. Confluence search is best-effort and the brief marks the
docs bucket unavailable rather than pretending.

## "Try it out" / installation link

https://developer.atlassian.com/console/install/d4b8eba7-1a10-41ca-854a-81e813416e32?signature=AYABeBqs%2Bn5GTF3xYzSn3%2BvgKcYAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBdA8MnOwmNim0gXDGk3VeDwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDEe04J8FhNqdTiiB%2BQIBEIA7tIZznat%2FwVdY5jdUcw1LhnfkzQMLo9IAwHbJOBjfXfkc2W0DMrDSm0%2FDGXFPrMbQgez10C0cl6x0j3MAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgHjZ83qJGzBEXtNiYWo3Q6%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMsfaznYQj%2B2iQKi6UAgEQgDv%2B4UNJBwVG%2Bo5zcKhDLN9SsU18kfUGTBV4WprZgoWjraO1U%2Bq4vvpKaXBok26JI2WAv0g2bacyW%2FUY0wAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAQ5hZryAjR62fLhG2GZHfuwAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAw9LHamWqYBOUgpV0ECARCAO4IFtfIa%2BaiHLu0CrZ5LqgnrzeP7sjafcDScPbxxjD2cCk7SXGvuYHktTy1rnI%2FRKKYmBkOQny1tROj0AgAAAAAMAAAQAAAAAAAAAAAAAAAAAHEpadRS93qCeGRLAYiqJFD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKAz8Fb1AJ0hvAw9ORcpSGOCL%2FWvt7Avyk50b%2Fggma4nB%2Fjxk1OBsukVJNYxVtdgyOXYDMhqJScc3KxymrI4W5Sm8E%3D&product=jira

This is the Forge distribution link (distribution status: *sharing with anyone*).
It installs the production deployment onto a Jira Cloud site. The app asks for
six scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`,
`read:confluence-content.all`, `search:confluence`, `storage:app`.

## Judges: how to test in 3 minutes

1. Open the install link, choose a Jira Cloud site, approve the six read/storage
   scopes.
2. Open any Jira issue. If the **Baton handoff brief** panel is not already in the
   issue view, open the app actions menu (the grid icon next to *Share*) and pick
   **Baton handoff brief** once; Jira remembers it for that issue's view. A brief
   renders for the real issue (thin or workable depending on what is recorded).
3. Open an issue with history: comment "We decided X because Y", then change it
   later with "We now do Z instead of X". Reload the panel — Baton reports a
   high-severity contradiction, lists the retired fact, and quotes the update.
4. `•••` menu → **Baton - hand off with context** → *Post brief as comment* and
   *Record handoff*.
5. Jira top nav → **Baton handoff health** — the handoff you just recorded appears
   in the KPIs, the weekly trend and (if it is thin) the needs-attention list.
6. Optional: ask Rovo *"What do I need to know before I take over <KEY>?"*, or call
   the MCP tools `baton-handoff-brief` / `baton-handoff-health`.

The repo also ships an offline preview of the exact bundle Forge serves:
`npm run dev` → `http://127.0.0.1:5173/index.html?preview=1&view=panel&issue=PAY-412`.

## Video

<https://youtu.be/TtHQTOHIqNo> — 2:07, public on YouTube, English narration and
burned-in captions. It is a real screen recording of the deployed app on Jira
Cloud (issues PAY-1 and PAY-5 on the demo site). Narration and shot list:
[VIDEO_SCRIPT.md](VIDEO_SCRIPT.md). `demo.mp4` in this repo is the same cut.

## Built with (Devpost tags)

Atlassian Forge · Atlassian Jira · Atlassian Confluence · Rovo · Atlassian MCP ·
Forge Storage (`@forge/kvs`) · `@forge/api` · `@forge/bridge` · `@forge/manifest` ·
React 19 · TypeScript · Vite · Vitest · Node.js 22 · ADF (Atlassian Document
Format) · Playwright · ffmpeg

## Links

- Code / repo: <https://github.com/afei8732-hub/baton> (public, MIT)
- Install link: https://developer.atlassian.com/console/install/d4b8eba7-1a10-41ca-854a-81e813416e32?signature=AYABeBqs%2Bn5GTF3xYzSn3%2BvgKcYAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBdA8MnOwmNim0gXDGk3VeDwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDEe04J8FhNqdTiiB%2BQIBEIA7tIZznat%2FwVdY5jdUcw1LhnfkzQMLo9IAwHbJOBjfXfkc2W0DMrDSm0%2FDGXFPrMbQgez10C0cl6x0j3MAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgHjZ83qJGzBEXtNiYWo3Q6%2FAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMsfaznYQj%2B2iQKi6UAgEQgDv%2B4UNJBwVG%2Bo5zcKhDLN9SsU18kfUGTBV4WprZgoWjraO1U%2Bq4vvpKaXBok26JI2WAv0g2bacyW%2FUY0wAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAQ5hZryAjR62fLhG2GZHfuwAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAw9LHamWqYBOUgpV0ECARCAO4IFtfIa%2BaiHLu0CrZ5LqgnrzeP7sjafcDScPbxxjD2cCk7SXGvuYHktTy1rnI%2FRKKYmBkOQny1tROj0AgAAAAAMAAAQAAAAAAAAAAAAAAAAAHEpadRS93qCeGRLAYiqJFD%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKAz8Fb1AJ0hvAw9ORcpSGOCL%2FWvt7Avyk50b%2Fggma4nB%2Fjxk1OBsukVJNYxVtdgyOXYDMhqJScc3KxymrI4W5Sm8E%3D&product=jira
- Video: <https://youtu.be/TtHQTOHIqNo>
- Screenshots: `screenshots/01…05` in the repo

## Checklist before submitting

- [x] `forge deploy -e production` + distribution link (sharing with anyone)
- [x] Video recorded from the deployed app (not the preview), 2:07, public
- [x] Devpost project created, category = Apps for Software Teams
- [ ] Built-with tags added, install link + setup instructions pasted
- [x] Repo public: <https://github.com/afei8732-hub/baton>
- [x] Screenshots in `screenshots/`
- [ ] Submitted before **Dec 22, 2026 12:00pm PT**
