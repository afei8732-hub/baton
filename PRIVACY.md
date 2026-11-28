# Privacy

Baton is a Forge app. It runs inside the customer's own Atlassian cloud and has no
external egress: the manifest declares no external permissions, and no source file
calls a non-Atlassian host.

## What Baton reads

When someone opens the Baton panel on a Jira issue, Baton reads that issue through
the Forge app context: its summary, description, status, assignee, reporter,
labels, components, links, comments and changelog entries. It also runs a
Confluence full-text search for pages that share terms with the issue and reads the
matching page bodies. All of this stays in the customer's Atlassian cloud and is
processed in memory to build the brief.

## What Baton stores

Baton keeps a small amount of state in Atlassian Forge storage (key-value store):

- per issue: the brief fingerprint, confidence score, generation time and the ids
  of the top five signals, so the next brief can show what changed;
- when a user records a handoff: the issue key and summary, the time, the
  display names the user enters for "from" and "to", the confidence, gap and risk
  counts, the fingerprint, and an optional note.

That state is stored in the Atlassian cloud under the customer's tenant. It is not
copied to any system operated by the app author, and it is not shared with third
parties. Removing the app (or clearing its Forge storage) deletes it.

## What Baton does not do

- No LLM or external model is called.
- No analytics, telemetry or advertising identifiers are collected.
- No data leaves Atlassian.

## Contact

Open an issue at <https://github.com/afei8732-hub/baton/issues>.
