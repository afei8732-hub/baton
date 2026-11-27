#!/usr/bin/env node
/**
 * Offline equivalent of `forge lint` for this app.
 *
 * Why this exists: Forge CLI 14 requires an authenticated session for lint
 * (it validates scopes against the developer console), so `npx forge lint`
 * cannot run in a sealed sandbox. This script runs the same manifest
 * validator that `forge lint` uses, plus the checks that matter for the
 * "Runs on Atlassian" claim:
 *
 *   1. manifest schema + handler/resource references  (@forge/manifest)
 *   2. every declared resolver/action handler is exported from the build
 *   3. no external egress permissions and no outbound fetch in the code
 *   4. Rovo agent + MCP tool references point at declared actions
 *
 * Run: npm run verify
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { validate } = require('@forge/manifest');

const root = resolve(import.meta.dirname, '..');
const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const result = await validate();
const errors = (result.errors ?? []).filter((error) => error.level === 'error');
const warnings = (result.errors ?? []).filter((error) => error.level !== 'error');

for (const error of errors) fail(`manifest: ${error.message} (line ${error.line})`);
for (const warning of warnings) notes.push(`manifest warning: ${warning.message}`);

// 2. Handler exports exist in the compiled output.
const buildEntry = join(root, 'build', 'resolvers', 'index.js');
if (!existsSync(buildEntry)) {
  fail('build/resolvers/index.js is missing - run "npm run build:server" first');
} else {
  const resolvers = require(buildEntry);
  for (const name of ['handler', 'handoffBriefAction', 'handoffHealthAction']) {
    if (typeof resolvers[name] !== 'function') fail(`handler "${name}" is not exported from src/resolvers/index.ts`);
  }
}

// 3. No egress: no external permissions, no fetch to anything but Atlassian.
const manifestText = readFileSync(join(root, 'manifest.yml'), 'utf8');
if (/^\s*external:/m.test(manifestText)) fail('manifest declares external (egress) permissions');
if (!/scopes:\s*\n(\s+-\s+\S+\n)+/m.test(manifestText)) fail('manifest declares no scopes');

const sources = [...walk(join(root, 'src')), join(root, 'manifest.yml')];
const allowedHosts = /(atlassian\.net|atlassian\.com|\.atlassian\.com)/;
for (const file of sources) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bfetch\(\s*['"`]([^'"`]+)['"`]/g)) {
    if (!allowedHosts.test(match[1])) fail(`${file.replace(root + '/', '')}: outbound fetch to ${match[1]}`);
  }
  if (/\brequestExternal|invokeRemote\(/.test(text)) {
    fail(`${file.replace(root + '/', '')}: uses a remote/external call`);
  }
}

// 4. Rovo references resolve to declared action keys.
// Collect the keys declared under `modules.action:` only.
const lines = manifestText.split('\n');
const declaredActions = [];
let inActionSection = false;
for (const line of lines) {
  if (/^ {2}action:\s*$/.test(line)) {
    inActionSection = true;
    continue;
  }
  if (inActionSection && /^ {2}\S/.test(line)) {
    inActionSection = false;
  }
  if (inActionSection) {
    const match = line.match(/^ {4}- key: (\S+)/);
    if (match) declaredActions.push(match[1]);
  }
}
const toolsBlock = manifestText.match(/tools:\n((?:\s+- .*\n)+)/);
if (!toolsBlock) {
  fail('rovo:mcp tools list is missing');
} else {
  for (const tool of toolsBlock[1].matchAll(/- (\S+)/g)) {
    if (!declaredActions.includes(tool[1])) fail(`rovo:mcp references undeclared action ${tool[1]}`);
  }
}
const agentActions = manifestText.match(/actions:\n((?:\s+- .*\n)+)/);
if (agentActions) {
  for (const action of agentActions[1].matchAll(/- (\S+)/g)) {
    if (!declaredActions.includes(action[1])) fail(`rovo:agent references undeclared action ${action[1]}`);
  }
}

// 5. The Custom UI bundle Forge will serve actually exists.
if (!existsSync(join(root, 'static', 'baton', 'index.html'))) {
  fail('static/baton/index.html is missing - run "npm run build:ui"');
}

const manifestPkg = JSON.parse(readFileSync(join(root, 'node_modules', '@forge', 'manifest', 'package.json'), 'utf8'));
console.log(`manifest validator: @forge/manifest ${manifestPkg.version}`);
console.log(`declared actions: ${declaredActions.join(', ') || 'none'}`);
console.log(`checks: schema, handler exports, egress, rovo references, UI bundle`);
for (const note of notes) console.log(`note: ${note}`);

if (problems.length > 0) {
  console.error(`\nFAILED (${problems.length})`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log('\nOK: manifest and app pass offline checks');
