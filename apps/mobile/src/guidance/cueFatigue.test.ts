import { describe, expect, it, vi } from 'vitest';

import { createFatigueTracker } from './cueFatigue';

describe('createFatigueTracker', () => {
  it('keeps the top cue until fatigue, then skips to the next', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fatigue = createFatigueTracker(45_000);
    const a = { id: 'a', text: 'A' };
    const b = { id: 'b', text: 'B' };

    expect(fatigue.pick([a, b])?.id).toBe('a');
    vi.setSystemTime(44_000);
    expect(fatigue.pick([a, b])?.id).toBe('a');
    vi.setSystemTime(45_000);
    expect(fatigue.pick([a, b])?.id).toBe('b');

    vi.useRealTimers();
  });

  it('clears a block once that issue is gone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fatigue = createFatigueTracker(1_000);

    expect(fatigue.pick([{ id: 'a' }])?.id).toBe('a');
    vi.setSystemTime(1_000);
    expect(fatigue.pick([{ id: 'a' }])).toBeNull();
    // Issue gone → block clears; if it comes back, it can cue again.
    expect(fatigue.pick([])).toBeNull();
    expect(fatigue.pick([{ id: 'a' }])?.id).toBe('a');

    vi.useRealTimers();
  });
});
