# Demo video — Baton (final cut 2:07)

**Format:** a real screen recording of Jira Cloud in Chromium at 1600×900, driven
through the actual Baton Forge app. English voice-over (edge-tts
`en-US-GuyNeural`), burned-in English captions, no music, no third-party marks.
The recording is 127 s, under the 5-minute limit.

**Recorded on:** <https://loubaton.atlassian.net>, project `PAY`.
Two issues carry the demo:

- **PAY-1** — retry policy for gateway timeouts. Six comments, two linked work
  items, and three Confluence pages (ADR-14, the September postmortem, the API
  contract). Confidence **75 / strong**, 8 signals, 3 sources.
- **PAY-5** — saved-card wallet for checkout. One comment, no decision.
  Confidence **8 / thin**, no signals, one high gap.

The fixture keys in `src/shared/fixtures.ts` (`PAY-412`, `PAY-457`) are the
offline preview/test data; the recording uses the live site's own keys.

---

## 0:00 – 0:18 · Cold open

**On screen:** PAY-1 activity, scrolling the comment thread.
**Narration:**
> Work changes hands all the time. Someone goes on leave. An issue is reopened
> after three months. A new engineer picks up a stale ticket. The ticket says
> what to build. It rarely says what was already decided.

## 0:19 – 0:40 · The panel

**On screen:** cut to the Baton panel on PAY-1: header, headline decision,
confidence ring 75, `8 signals · 3 sources · 1 person`.
**Narration:**
> This is PAY-1: a payment retry issue with six comments, two linked incidents,
> and three Confluence pages. Baton is a Forge app that turns that history into a
> handoff brief, right inside Jira. No model. No external service. Just the
> context that already exists.

## 0:41 – 1:00 · The headline and the score

**On screen:** the quoted decision, then the ranked signal with "Why it ranks
here".
**Narration:**
> At the top is the current decision, quoted: move to a sliding window limiter,
> and check the idempotency key before every attempt. Baton scores its own
> confidence: seventy-five out of a hundred. Strong. Built from eight ranked
> signals across three sources.

## 1:00 – 1:18 · Why each signal ranks

**On screen:** signal 01 (decision), signal 02 (postmortem), then the ADR and API
contract entries.
**Narration:**
> Every signal explains why it ranks where it does. This decision shares seven
> specific terms with the issue, it is a recorded decision, and it is current.
> The September postmortem ranks next, because it explains why the old fixed
> window was retired.

## 1:18 – 1:35 · Superseded, gaps, coverage

**On screen:** the amber "3 earlier facts were superseded" card, the gap list,
the coverage panel and the next actions.
**Narration:**
> Baton also marks what is no longer true, quotes the statement that retired it,
> and names the gaps. The confidence number is not a black box. It comes from
> coverage, and the coverage is listed: decision, spec, history, people, recency.

## 1:36 – 1:52 · The honest thin brief

**On screen:** cut to PAY-5; the panel shows confidence 8 / thin, `NO DECISION`,
red coverage, and "write the decision down".
**Narration:**
> Open a thin ticket and the brief is honest. PAY-5 has one comment and no
> recorded decision. Confidence drops to eight, the label is thin, and the first
> suggested action is to write the decision down.

## 1:52 – 2:07 · End card

**On screen:** Baton / Handoff briefs for Jira / Codegeist 2026 · Built on
Atlassian Forge.
**Narration:**
> Baton. The reasoning behind the work, in front of the next person, at the
> moment of handoff. Built on Forge, for Codegeist twenty twenty-six.

---

## Reproducing the recording

1. Install the app on a Jira site (see `SUBMISSION.md`).
2. Create a project with two issues of the same shape as PAY-1 and PAY-5, or use
   the preview harness (`npm run dev`, `?preview=1&issue=PAY-412`) for the
   fixtures.
3. Add the **Baton handoff brief** panel to the issue view once per issue
   (*Apps* menu → *Baton handoff brief*).
4. Record the panel and the issue activity; the app itself needs no other setup.
