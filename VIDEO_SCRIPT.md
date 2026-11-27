# Video script — Baton

Target **3:30** (hard limit is 5:00, so this leaves room for breathing).
Record at 1440×900 or 1920×1080, browser zoom 100%, no personal data on screen.
Two fixtures are used throughout and both are in the repo, so the demo is
reproducible: **PAY-412** (well documented, but a superseded decision) and
**PAY-457** (nothing recorded).

Narration ≈ 480 words ≈ 3:25 at a calm pace.

---

## 0:00 – 0:15 · Cold open

**On screen:** Jira issue PAY-412 open, sidebar empty. Slowly scroll the comment
thread — 20+ comments, one from February, one from September.

**Narration:**

> This is a handoff. Somebody is about to take over a payment retry issue with
> twenty comments, a postmortem, and an architecture decision recorded six months
> ago. The ticket says what to build. It does not say what was already decided, or
> what changed since.

---

## 0:15 – 0:35 · What Baton is

**On screen:** open the Baton issue panel. The brief appears: headline, confidence
ring at **68 / WORKABLE**, three stats (10 signals · 3 sources · 4 people),
fingerprint `ac601892`.

**Narration:**

> Baton is a Forge app that assembles a handoff brief from the context that
> already exists — the issue, its comments, its changelog, its links, and the
> Confluence pages that mention it. No model, no external service. Every line here
> comes from a specific comment or page, and every rank explains itself.

---

## 0:35 – 1:05 · The headline decision

**On screen:** zoom on the headline quote, then open signal 01 "Decision by Marco
Silva (14 Sept)" → "Why it ranks here": *shares 6 specific terms · recorded
decision · authority 100% · 2 months ago*.

**Narration:**

> The headline is the current decision, quoted: they moved to a sliding window
> limiter, and the idempotency key is checked before every attempt. Signal one is
> the comment that said it. Open the reason and you can see why it outranks the
> rest: it shares specific terms with the issue, it *is* a decision, and it is two
> months old. A status change from yesterday does not beat it.

---

## 1:05 – 1:45 · What is no longer true

**On screen:** scroll to Risks. High-severity card: **"2 earlier facts were
superseded by one update"** — expand, show the quoted replacement sentence and the
two retired facts (Priya's February decision, ADR-14).

**Narration:**

> This is the part that costs teams days. In February the plan was a fixed window.
> In September that was replaced. Baton detects the replacement language — *instead
> of* — and checks what the sentence actually negates, so it retires the fixed
> window decision and the ADR that depended on it, and it does *not* retire the
> API contract that merely mentions idempotency. One update, two retired facts,
> one risk, with the receipt.

---

## 1:45 – 2:10 · Gaps, and the honest number

**On screen:** scroll through stale / drift / single-source cards, then the
coverage buckets and Next actions.

**Narration:**

> Below that: a decision last confirmed nine months ago, a handoff whose context
> has drifted, and one piece of reasoning that lives with a single person. The
> confidence score is built from five coverage buckets minus those penalties — so
> 68 means *workable, not clean*, and the reasons are printed rather than hidden
> behind a percentage.

---

## 2:10 – 2:35 · The opposite case

**On screen:** switch to PAY-457. Confidence **48 / THIN**, first risk
"missing-decision", coverage shows decision missing, next action "write a two-line
decision note".

**Narration:**

> Here is an issue where nobody wrote the decision down. Baton does not invent one.
> Confidence drops to 48, the label is thin, and the top risk is the missing
> decision itself, with an action attached. A brief that says "I don't know" is
> more useful than a confident summary that guesses.

---

## 2:35 – 3:05 · From one issue to the team

**On screen:** issue `•••` menu → **Baton - hand off with context** → result card →
*Post brief as comment* (show the ADF comment in the issue) → *Record handoff*.
Then Jira top nav → **Baton handoff health**: 6 handoffs, avg 69%, 1 below 60%,
3 with a high-severity gap, weekly bars, needs-attention list.

**Narration:**

> One click posts the brief as a structured comment and records the handoff in
> Forge storage. That history rolls up into a team page: average confidence, how
> many handoffs went out below sixty, the weekly trend, and the weakest recent
> handoffs first. Handoff quality stops being a feeling and becomes a number you
> can watch.

---

## 3:05 – 3:20 · Rovo and MCP

**On screen:** Rovo chat: *"What do I need to know before I take over PAY-412?"*
→ the agent answers with the same facts. Quick cut to the MCP tool list showing
`baton-handoff-brief` and `baton-handoff-health`.

**Narration:**

> The same engine is a Rovo agent and two MCP tools, so an agent — Atlassian's or a
> third party's — can ask the same question and get the same answer. One brief,
> four surfaces.

---

## 3:20 – 3:30 · Close

**On screen:** back to the panel, slow scroll to the coverage row. Baton logo, repo
URL, "Runs on Atlassian — no egress".

**Narration:**

> Baton. The right context, in front of the next owner, at the moment work changes
> hands — and a record of how good that context actually was.

---

## Production notes

- **Do not** show the preview harness (`?preview=1`) as if it were Jira; record the
  panel inside a real Jira issue. The preview is only for b-roll if the deployed
  app misbehaves.
- Create the supersession story live if possible: comment "We decided fixed window
  because the PSP guarantees 24h", then later "We moved to a sliding window
  limiter instead of the fixed window". Reload → contradiction appears.
- Record at 30 fps, export H.264 1080p, upload **public** to YouTube, title
  "Baton — handoff briefs for Jira (Codegeist 2026)".
- Total narration is ~480 words; if it runs long, cut the MCP beat (3:05–3:20)
  first — it is also covered in text.
- Keep the mouse still while talking; scroll with the keyboard (PgDn) so motion is
  smooth.
