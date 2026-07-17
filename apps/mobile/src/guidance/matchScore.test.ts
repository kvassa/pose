import { describe, expect, it } from 'vitest';

import { combineMatchScore, framingMatchScore } from './matchScore';

describe('matchScore', () => {
  it('pulls a high pose score down when the person is far off to the side', () => {
    const framing = framingMatchScore({
      dx: 0.25,
      dy: 0,
      dScale: 1,
      iou: 0, // absolute overlap can be 0 — must not zero the badge
    });
    expect(framing).toBeLessThan(50);
    expect(framing).toBeGreaterThan(0);
    const combined = combineMatchScore(95, framing);
    expect(combined).toBeLessThan(70);
    expect(combined).toBeGreaterThan(20);
  });

  it('keeps a high score when framing is roughly centered', () => {
    const framing = framingMatchScore({
      dx: 0.01,
      dy: 0.01,
      dScale: 1.02,
      iou: 0,
    });
    expect(framing).toBeGreaterThan(85);
    const combined = combineMatchScore(92, framing);
    expect(combined).toBeGreaterThan(85);
  });
});
