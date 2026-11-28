# Deploy — steps that need a human

Everything in this repo builds and verifies offline. The remaining steps need an
Atlassian account, which is why they are written down here instead of being run.

## What is already verified offline

```bash
npm run typecheck      # tsc: server + UI, no errors
npm test               # 23 tests, all passing
npm run build          # server -> build/, UI -> static/baton/
node scripts/verify.mjs
```

`scripts/verify.mjs` runs `@forge/manifest` 13.7 — the same validator `forge lint`
uses — and then checks that every declared handler is exported, that the manifest
declares no external egress, that no source file fetches a non-Atlassian host, that
the Rovo agent and MCP tool references point at declared actions, and that
`static/baton/index.html` exists.

## Why `forge lint` is not in the list

Forge CLI 14.2 runs offline until it validates the app against the developer
console, then fails with `Error: UserNotFoundError` because there is no logged-in
session. Forge CLI 16 refuses Node 26 outright (`Unsupported Node.js version`), and
the sandbox has Node v26.7.0. `scripts/verify.mjs` is the offline substitute; run
real `forge lint` once you are logged in (step 4).

Also: Forge supports Node 22.x / 24.x for the CLI. If your machine has Node 26,
either switch with `nvm use 22` or expect the CLI to warn.

## 1. Log in

```bash
npx forge login          # opens a browser; needs your Atlassian account
```

## 2. Register the app (first time only)

The manifest ships with a fixed app id so the code is reviewable offline. Register
your own app so the id matches your developer console:

```bash
npx forge register       # rewrites app.id in manifest.yml, creates the app
```

Commit the new `manifest.yml` afterwards. Nothing else in the repo depends on the
id.

## 3. Build the Custom UI, then deploy

The built UI (`static/baton`) is generated output and is not committed. Build it
first, or Forge has nothing to serve in the panel:

```bash
npm install
npm run build            # server -> build/, UI -> static/baton/
npx forge deploy         # environment: development
```

This bundles `src/resolvers` (Node 22, 256 MB, arm64) and uploads `static/baton`
as the Custom UI resource.

## 4. Real lint (optional once logged in)

```bash
npx forge lint
```

Expect scope and module checks. If it complains about the `rovo:*` modules, the
app needs the Rovo/MCP features enabled on your site — see the Forge docs for
`rovo:agent`, `rovo:action` and `rovo:mcp`.

## 5. Install on a site

```bash
npx forge install --site <your-site>.atlassian.net --product jira
```

The command prints an install link. That link is what goes into the Devpost
"Try it out" field. Approve the four scopes:

- `read:jira-work`
- `read:jira-user`
- `read:confluence-content.all`
- `storage:app`

No external permissions are requested, so nothing leaves Atlassian.

## 6. Smoke test on the real site

1. Open any issue → right sidebar → **Baton handoff brief** renders.
2. Add two comments that contradict each other ("We decided X because Y", later
   "We now do Z instead of X") → reload → a high-severity contradiction appears
   with the retired fact quoted.
3. `•••` → **Baton - hand off with context** → *Post brief as comment* → the ADF
   comment renders as headings, bullets and a code-free list.
4. Jira top nav → **Baton handoff health** → the recorded handoff appears.
5. Rovo: *"What do I need to know before I take over <KEY>?"* → agent answers from
   the same engine.

## 7. Upgrades

```bash
npx forge deploy --minor    # after changing manifest scopes/modules
npx forge install --upgrade --site <site>.atlassian.net
```

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `UserNotFoundError` from any `forge` command | not logged in (step 1) |
| `Unsupported Node.js version` | CLI 16+ on Node 26; use Node 22/24 |
| Panel renders "Unable to establish a connection with the Custom UI bridge" | opened `static/baton/index.html` directly; use `?preview=1` or run inside Jira |
| `docsUnavailable` in the brief response | app cannot read Confluence on that site; the brief still renders and marks the docs bucket unavailable |
| Rovo agent missing | the site has no Rovo enabled; the issue panel and health page work without it |

`forge tunnel` is not used here: it needs Docker, which the build sandbox does not
have. Deploy-and-open is the loop.
