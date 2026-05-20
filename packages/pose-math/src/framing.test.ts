import type { BoundingBox } from '@pose-match/shared-types';
import { describe, expect, it } from 'vitest';
import { compareFraming } from './framing';

describe('compareFraming', () => {
  it('returns zero offset, unit scale, and full IoU for identical boxes', () => {
    const box: BoundingBox = { x: 0.2, y: 0.3, w: 0.4, h: 0.5 };
    const result = compareFraming(box, box);

    expect(result.dx).toBeCloseTo(0, 6);
    expect(result.dy).toBeCloseTo(0, 6);
    expect(result.dScale).toBeCloseTo(1, 6);
    expect(result.iou).toBeCloseTo(1, 6);
  });

  it('returns zero IoU for non-overlapping boxes side by side', () => {
    const target: BoundingBox = { x: 0, y: 0, w: 0.2, h: 0.2 };
    const live: BoundingBox = { x: 0.5, y: 0, w: 0.2, h: 0.2 };
    const result = compareFraming(target, live);

    expect(result.iou).toBeCloseTo(0, 6);
  });
});
