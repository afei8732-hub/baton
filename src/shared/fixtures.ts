/**
 * A realistic sample workspace (Payments team) used by the local preview
 * harness, the screenshot/demo pipeline and the unit tests.
 *
 * It is deliberately messy: a superseded ADR, a decision owned by someone who
 * has left the project, a reopened issue and a doc that is older than the
 * change it describes. That is the point - Baton has something real to find.
 */
import type { DocSnapshot, HandoffRecord, IssueSnapshot, WorkspaceSnapshot } from './types';

export const DEMO_NOW = '2026-11-27T09:00:00.000Z';

export const paymentsIssue: IssueSnapshot = {
  key: 'PAY-412',
  summary: 'Retry policy for gateway timeouts causes duplicate charges',
  status: 'In Progress',
  statusCategory: 'In Progress',
  issueType: 'Bug',
  assignee: 'Dana Okoye',
  reporter: 'Marco Silva',
  created: '2026-02-10T08:12:00.000Z',
  updated: '2026-11-24T16:40:00.000Z',
  dueDate: '2026-12-05',
  labels: ['payments', 'reliability', 'idempotency'],
  components: ['Payment Gateway'],
  description:
    'Merchants report duplicate charges when the payment gateway times out mid-authorization. We need a retry policy that is idempotent at the gateway boundary and does not hold a database lock across retries. Constraint: authorization calls must stay under 800ms p99, so no more than three attempts inside the request.',
  comments: [
    {
      id: 'c1',
      author: 'Priya Raman',
      body: 'Decision: we keep a fixed window of 3 retries per authorization with 250ms backoff and rely on the gateway idempotency key. Because the PSP only guarantees idempotency for 24h we never queue a retry beyond that window. This keeps the p99 inside the 800ms budget.',
      created: '2026-02-11T10:04:00.000Z',
    },
    {
      id: 'c2',
      author: 'Marco Silva',
      body: 'Agreed to add a per-merchant circuit breaker so one noisy merchant cannot exhaust the retry budget for everyone else. Threshold is 5% error rate over 60s.',
      created: '2026-03-02T14:22:00.000Z',
    },
    {
      id: 'c3',
      author: 'Ken Ito',
      body: 'The API contract v3 still documents the old timeout error code path. I will update the contract once the retry policy stops moving.',
      created: '2026-06-18T09:31:00.000Z',
    },
    {
      id: 'c4',
      author: 'Priya Raman',
      body: 'Rollout plan: token bucket at 120 rps per merchant with a 20% burst buffer, canary in eu-west first, then us-east.',
      created: '2026-06-18T11:02:00.000Z',
    },
    {
      id: 'c5',
      author: 'Marco Silva',
      body: 'Postmortem for the 2026-09-11 incident: duplicate charges came back because retries ignored the idempotency window under load. Root cause was the fixed window limiter letting a burst through after failover. We moved to the sliding window limiter instead of the fixed window from the February decision, and the idempotency key is now checked before every attempt.',
      created: '2026-09-14T07:45:00.000Z',
    },
    {
      id: 'c6',
      author: 'Dana Okoye',
      body: 'Blocked on finance sign-off for the refund path. Lena has the controls checklist; without it we cannot enable automatic refunds for duplicated authorizations.',
      created: '2026-10-30T15:10:00.000Z',
    },
  ],
  changelog: [
    { id: 'e1', author: 'Priya Raman', field: 'assignee', from: 'Priya Raman', to: 'Dana Okoye', at: '2026-09-28T09:00:00.000Z' },
    { id: 'e2', author: 'Marco Silva', field: 'status', from: 'In Progress', to: 'Done', at: '2026-08-30T17:20:00.000Z' },
    { id: 'e3', author: 'Marco Silva', field: 'status', from: 'Done', to: 'In Progress', at: '2026-09-12T08:15:00.000Z' },
    { id: 'e4', author: 'Dana Okoye', field: 'duedate', from: '2026-10-15', to: '2026-12-05', at: '2026-10-02T12:00:00.000Z' },
    { id: 'e5', author: 'Dana Okoye', field: 'labels', from: 'payments, reliability', to: 'payments, reliability, idempotency', at: '2026-11-24T16:40:00.000Z' },
  ],
  links: [
    { key: 'PAY-388', type: 'relates to', summary: 'Duplicate charge detection job misses refunds', status: 'Done' },
    { key: 'INC-231', type: 'causes', summary: 'Incident: duplicate charges after gateway failover', status: 'Resolved' },
  ],
  reopened: true,
};

export const paymentsDocs: DocSnapshot[] = [
  {
    id: '14021',
    title: 'ADR-14 Payment retry and idempotency',
    space: 'PAY',
    author: 'Priya Raman',
    updated: '2026-03-04T10:00:00.000Z',
    labels: ['decision', 'adr', 'payments', 'idempotency'],
    excerpt:
      'Decision record. We use a fixed window of three retries per authorization, 250ms backoff, and the gateway idempotency key. The PSP guarantees idempotency for 24h, so retries are never queued past that. Circuit breaker threshold is 5% error rate over 60 seconds. Rationale: keeps p99 under the 800ms authorization budget.',
    url: 'https://example.atlassian.net/wiki/spaces/PAY/pages/14021',
  },
  {
    id: '14877',
    title: 'Gateway timeout postmortem - 2026-09-11',
    space: 'PAY',
    author: 'Marco Silva',
    updated: '2026-09-20T18:30:00.000Z',
    labels: ['incident', 'postmortem', 'payments'],
    excerpt:
      'Root cause: retries ignored the idempotency window after a gateway failover, producing duplicate charges for 41 merchants. The fixed window limiter allowed a burst through during failover. Action: sliding window limiter at 120 rps per merchant, idempotency key checked before every attempt.',
    url: 'https://example.atlassian.net/wiki/spaces/PAY/pages/14877',
  },
  {
    id: '12904',
    title: 'Payments API contract v3',
    space: 'PAY',
    author: 'Ken Ito',
    updated: '2025-12-01T09:00:00.000Z',
    labels: ['spec', 'api', 'payments'],
    excerpt:
      'Authorize endpoint contract. Timeout error code 504 is returned when the gateway does not answer within 800ms. Retry behaviour is owned by the client library; the contract documents the idempotency key header and the 24h window.',
    url: 'https://example.atlassian.net/wiki/spaces/PAY/pages/12904',
  },
  {
    id: '15330',
    title: 'Refund path finance controls',
    space: 'FIN',
    author: 'Lena Fischer',
    updated: '2026-10-29T11:15:00.000Z',
    labels: ['policy', 'finance'],
    excerpt:
      'Automatic refunds for duplicated authorizations require the two-person control checklist and a monthly reconciliation export. Sign-off owner: Lena Fischer. This blocks any automatic refund rollout until the checklist is attached.',
    url: 'https://example.atlassian.net/wiki/spaces/FIN/pages/15330',
  },
];

export const paymentsPreviousHandoffs: HandoffRecord[] = [
  {
    id: 'h-3',
    issueKey: 'PAY-412',
    issueSummary: paymentsIssue.summary,
    at: '2026-09-28T09:05:00.000Z',
    from: 'Priya Raman',
    to: 'Dana Okoye',
    confidence: 81,
    gaps: 0,
    highRisks: 0,
    fingerprint: 'f30a91bc',
    note: 'Ownership handover after the incident fix.',
  },
];

export const primaryWorkspace: WorkspaceSnapshot = {
  issue: paymentsIssue,
  docs: paymentsDocs,
  previousFingerprints: paymentsPreviousHandoffs.map((h) => ({
    at: h.at,
    fingerprint: h.fingerprint,
    confidence: h.confidence,
  })),
};

/** A thinner issue, used to show the opposite outcome: a brief with holes. */
export const thinIssue: IssueSnapshot = {
  key: 'PAY-457',
  summary: 'Add 3DS challenge retry budget to checkout service',
  status: 'To Do',
  statusCategory: 'To Do',
  issueType: 'Story',
  assignee: 'Dana Okoye',
  reporter: 'Lena Fischer',
  created: '2026-11-18T13:00:00.000Z',
  updated: '2026-11-19T09:10:00.000Z',
  labels: ['payments', 'checkout'],
  components: ['Checkout'],
  description:
    'Checkout needs a retry budget for 3DS challenges so a flaky challenge does not fail the whole payment. Scope is still being figured out.',
  comments: [
    {
      id: 'c1',
      author: 'Lena Fischer',
      body: 'Can someone confirm what the challenge timeout is supposed to be? I could not find it.',
      created: '2026-11-18T15:00:00.000Z',
    },
  ],
  changelog: [
    { id: 'e1', author: 'Lena Fischer', field: 'status', from: 'Backlog', to: 'To Do', at: '2026-11-19T09:10:00.000Z' },
  ],
  links: [],
};

export const thinDocs: DocSnapshot[] = [
  {
    id: '15901',
    title: 'Checkout service overview',
    space: 'PAY',
    author: 'Ken Ito',
    updated: '2026-11-02T10:00:00.000Z',
    labels: ['spec'],
    excerpt:
      'The checkout service orchestrates 3DS challenges, authorization and capture. Challenge timeouts are inherited from the acquirer configuration.',
    url: 'https://example.atlassian.net/wiki/spaces/PAY/pages/15901',
  },
];

export const thinWorkspace: WorkspaceSnapshot = {
  issue: thinIssue,
  docs: thinDocs,
};

/** Handoff history for the dashboard. */
export const demoHandoffs: HandoffRecord[] = [
  ...paymentsPreviousHandoffs,
  {
    id: 'h-4',
    issueKey: 'PAY-431',
    issueSummary: 'Settlement report drops refunded transactions',
    at: '2026-11-04T10:20:00.000Z',
    from: 'Ken Ito',
    to: 'Dana Okoye',
    confidence: 74,
    gaps: 1,
    highRisks: 1,
    fingerprint: 'b71c22de',
    note: 'Month-end crunch, handed off with a known gap.',
  },
  {
    id: 'h-5',
    issueKey: 'PAY-396',
    issueSummary: 'Webhook signature rotation for merchant endpoints',
    at: '2026-11-12T08:40:00.000Z',
    from: 'Marco Silva',
    to: 'Sara Lindqvist',
    confidence: 62,
    gaps: 2,
    highRisks: 1,
    fingerprint: '0c9e51aa',
  },
  {
    id: 'h-6',
    issueKey: 'PAY-457',
    issueSummary: thinIssue.summary,
    at: '2026-11-19T09:30:00.000Z',
    from: 'Lena Fischer',
    to: 'Dana Okoye',
    confidence: 38,
    gaps: 3,
    highRisks: 1,
    fingerprint: '5a0b7c31',
    note: 'Scope unclear, brief is thin on purpose.',
  },
  {
    id: 'h-7',
    issueKey: 'PAY-402',
    issueSummary: 'Gateway failover rehearsals in staging',
    at: '2026-11-21T16:05:00.000Z',
    from: 'Dana Okoye',
    to: 'Marco Silva',
    confidence: 88,
    gaps: 0,
    highRisks: 0,
    fingerprint: 'ee4210b7',
  },
  {
    id: 'h-8',
    issueKey: 'PAY-418',
    issueSummary: 'Idempotency key collision in batch payouts',
    at: '2026-11-25T11:45:00.000Z',
    from: 'Sara Lindqvist',
    to: 'Dana Okoye',
    confidence: 69,
    gaps: 1,
    highRisks: 0,
    fingerprint: '3d7f80c4',
  },
];
