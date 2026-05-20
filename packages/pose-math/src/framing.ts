import type { BoundingBox } from '@pose-match/shared-types';

export type FramingDiff = {
  dx: number;
  dy: number;
  dScale: number;
  iou: number;
};

function boxCenter(box: BoundingBox): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function boxArea(box: BoundingBox): number {
  return box.w * box.h;
}

function boxIntersection(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  return w * h;
}

export function compareFraming(
  target: BoundingBox,
  live: BoundingBox,
): FramingDiff {
  const targetCenter = boxCenter(target);
  const liveCenter = boxCenter(live);
  const targetArea = boxArea(target);
  const liveArea = boxArea(live);
  const intersection = boxIntersection(target, live);
  const union = targetArea + liveArea - intersection;

  return {
    dx: liveCenter.x - targetCenter.x,
    dy: liveCenter.y - targetCenter.y,
    dScale: targetArea === 0 ? 1 : liveArea / targetArea,
    iou: union === 0 ? 0 : intersection / union,
  };
}
