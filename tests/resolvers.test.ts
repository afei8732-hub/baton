import { describe, expect, it } from 'vitest';
import { handler } from '../src/resolvers/index';

describe('resolver entry point', () => {
  it('accepts a direct payload shape', async () => {
    const result = await handler({ action: 'getBrief', issueKey: 'not-a-key' });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain('issue key');
  });

  it('accepts the wrapped { payload, context } shape Forge uses', async () => {
    const result = await handler({ payload: { action: 'getBrief', issueKey: '123' }, context: {} });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown actions instead of guessing', async () => {
    const result = await handler({ payload: { action: 'deleteEverything' } });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain('Unknown action');
  });
});
