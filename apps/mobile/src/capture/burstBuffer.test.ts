import { describe, expect, it, beforeEach } from 'vitest';

import {
  __resetBurstBufferForTests,
  bestBurstFrame,
  getBurstBuffer,
  pushBurstFrame,
} from './burstBuffer';

describe('burstBuffer', () => {
  beforeEach(() => {
    __resetBurstBufferForTests();
  });

  it('keeps only the last 30 frames', () => {
    for (let i = 0; i < 40; i++) {
      pushBurstFrame({ timestamp: i, score: i });
    }
    const frames = getBurstBuffer();
    expect(frames).toHaveLength(30);
    expect(frames[0]?.timestamp).toBe(10);
    expect(frames[29]?.timestamp).toBe(39);
  });

  it('returns the highest score as the best frame', () => {
    pushBurstFrame({ timestamp: 1, score: 40 });
    pushBurstFrame({ timestamp: 2, score: 90 });
    pushBurstFrame({ timestamp: 3, score: 70 });
    expect(bestBurstFrame()?.score).toBe(90);
  });
});
