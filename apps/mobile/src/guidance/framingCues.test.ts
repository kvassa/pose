import type { FramingDiff } from '@pose-match/pose-math';
import { describe, expect, it } from 'vitest';

import { framingHint, framingHints } from './framingCues';

const centered: FramingDiff = { dx: 0, dy: 0, dScale: 1, iou: 1 };

describe('framingHints', () => {
  it('hides when framing already overlaps well', () => {
    expect(framingHint({ ...centered, iou: 0.9 }, { facingFront: false, mirrored: false })).toBeNull();
  });

  it('uses "camera" wording on the back camera', () => {
    const hint = framingHint(
      { dx: 0.2, dy: 0, dScale: 1, iou: 0.4 },
      { facingFront: false, mirrored: false },
    );
    expect(hint?.label).toBe('camera right');
    expect(hint?.symbol).toBe('→');
  });

  it('uses "move" wording and mirrors horizontally on the front camera', () => {
    const hint = framingHint(
      { dx: 0.2, dy: 0, dScale: 1, iou: 0.4 },
      { facingFront: true, mirrored: true },
    );
    expect(hint?.label).toBe('move right');
    expect(hint?.symbol).toBe('→');
  });

  it('suggests moving closer when the subject is too small', () => {
    const hint = framingHint(
      { dx: 0, dy: 0, dScale: 0.5, iou: 0.3 },
      { facingFront: true, mirrored: true },
    );
    expect(hint?.label).toBe('move closer');
    expect(hint?.symbol).toBe('＋');
  });

  it('returns multiple ranked candidates when several axes are off', () => {
    const hints = framingHints(
      { dx: 0.25, dy: 0.2, dScale: 1, iou: 0.2 },
      { facingFront: false, mirrored: false },
    );
    expect(hints.length).toBeGreaterThanOrEqual(2);
    expect(hints[0].severity).toBeGreaterThanOrEqual(hints[1].severity);
  });

  it('in display space, live-right-of-guide means move left on the front camera', () => {
    const hint = framingHint(
      { dx: 0.2, dy: 0, dScale: 1, iou: 0.4 },
      { facingFront: true, displaySpace: true },
    );
    expect(hint?.label).toBe('move left');
    expect(hint?.symbol).toBe('←');
  });
});
