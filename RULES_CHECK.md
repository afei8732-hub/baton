# Codegeist 2026 — submission checklist

Checked against the live rules at <https://codegeist2026.devpost.com/rules> on
2026-11-28 (the `codegeist.devpost.com` host serves the 2024 edition; the 2026
edition is `codegeist2026.devpost.com`). Deadline on the page: **2026-12-23
04:00 Beijing time** (2026-12-22 12:00 PT).

## Required on the Devpost form

| Requirement | Rule | Baton |
| --- | --- | --- |
| Forge app | Built on Forge, at least one Forge module | `manifest.yml`, Jira issue panel, issue action, global page, Rovo agent, actions, MCP tools |
| Atlassian integration | At least one of Jira / Confluence / JSM / Bitbucket / Teamwork Graph / Rovo | Jira reads + Confluence search + Rovo agent |
| Category | Exactly one | **Apps for Software Teams** |
| Demo video | **< 5 minutes**, footage showing the project functioning, uploaded publicly to YouTube, link on the form, no third-party trademarks or copyrighted music | 2:07, real Jira recording, public YouTube, original narration, no music |
| Installation link | Required, from Forge distribution sharing | Forge distribution link (see SUBMISSION.md) |
| Setup instructions | All configuration steps and integrations | SUBMISSION.md + README; no external config, scopes approved on install |
| Text description | Features and functionality | Devpost description |
| Technology explanation | How the project meets the main technology requirement | Devpost "Built with" + description |
| Bonus write-up | Only if entering a bonus prize | Best Agents and Best app with Atlassian MCP |
| Language | English materials | English UI, video, description |
| Original work | Owned by entrant, no IP violation | MIT, original code, no third-party assets |

## Not required

- Confluence installation for the core Jira panel: the panel works on Jira alone;
  Confluence search is best-effort and degrades gracefully (`docsUnavailable`).
  The app is nevertheless installed in Confluence on the demo site so docs appear
  in the recording.
- Marketplace listing: only needed for the "Best Marketplace published app" bonus,
  which Baton does not enter.
- A public website: the installation link and the video are the access path.

## Judging criteria (equal weight)

1. Impact on the Atlassian ecosystem / usefulness.
2. Quality of the idea.
3. Technological implementation / use of Forge.
4. Quality of the submission (video, description, instructions).
