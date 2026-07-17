import type { FramingDiff } from '@pose-match/pose-math';

/**
 * How well the live person matches the reference place/size (0–100).
 * Uses center offset + scale only — not IoU. Absolute box overlap is often 0
 * even when the person is roughly in the right spot, which used to zero the badge.
 */
export function framingMatchScore(diff: FramingDiff): number {
  const shift = Math.hypot(diff.dx, diff.dy);
  // ~0.05 off → mild; ~0.20 off → major.
  const shiftScore = 100 * (1 - Math.min(1, shift / 0.28));
  const scaleOff = Math.abs(Math.log(Math.max(diff.dScale, 0.01)));
  const scaleScore = 100 * (1 - Math.min(1, scaleOff / 0.65));
  const score = Math.min(shiftScore, scaleScore);
  return Number.isFinite(score) ? Math.max(0, score) : 100;
}

/**
 * Blend pose angles with framing. Off-center pulls the badge down without
 * wiping out a real pose score.
 */
export function combineMatchScore(poseScore: number, framingScore: number): number {
  if (!Number.isFinite(poseScore)) return 0;
  if (!Number.isFinite(framingScore)) return poseScore;
  return 0.6 * poseScore + 0.4 * framingScore;
}
