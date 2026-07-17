import type { FramingDiff } from '@pose-match/pose-math';

export type FramingHint = {
  id: string;
  symbol: string;
  /** e.g. "move right" (front camera) or "camera right" (back camera). */
  label: string;
  size: number;
  /** Higher = more off. Used to rank candidates. */
  severity: number;
};

type FramingOptions = {
  /** True for the selfie camera (the person adjusts themselves). */
  facingFront: boolean;
  /**
   * True when dx/dy are still in raw buffer space and need a selfie flip.
   * False when dx/dy are already in on-screen (preview) space vs the green guide.
   */
  mirrored?: boolean;
  /** Prefers screen-space diffs (no second horizontal flip). */
  displaySpace?: boolean;
};

const IOU_HIDE = 0.85;
const SHIFT_MIN = 0.08;
const SCALE_MIN = 0.25;

/**
 * Ranked framing corrections (worst first). Empty when framing is already good.
 *
 * Front = "move …" (you move). Back = "camera …" (photographer moves the phone).
 * If a single axis reads backwards on device, flip that axis's ternary below.
 */
export function framingHints(
  diff: FramingDiff,
  { facingFront, mirrored = false, displaySpace = false }: FramingOptions,
): FramingHint[] {
  if (diff.iou > IOU_HIDE) return [];

  // Display-space diffs are already what you see; only flip raw buffer dx.
  const perceivedDx = !displaySpace && mirrored ? -diff.dx : diff.dx;
  const absDx = Math.abs(perceivedDx);
  const absDy = Math.abs(diff.dy);
  const scaleOff = Math.abs(Math.log(Math.max(diff.dScale, 0.01)));
  const who = facingFront ? 'move' : 'camera';
  const hints: FramingHint[] = [];

  if (scaleOff > SCALE_MIN) {
    if (diff.dScale < 1) {
      hints.push({
        // Stable axis id so left↔right flicker doesn't reset the 45s timer.
        id: 'frame:scale',
        symbol: '＋',
        label: `${who} closer`,
        size: 28 + scaleOff * 40,
        severity: scaleOff,
      });
    } else {
      hints.push({
        id: 'frame:scale',
        symbol: '－',
        label: facingFront ? 'step back' : 'camera back',
        size: 28 + scaleOff * 40,
        severity: scaleOff,
      });
    }
  }

  if (absDx > SHIFT_MIN) {
    // Live right of guide on screen → move left (front) / pan camera left (back).
    const goRight = facingFront ? perceivedDx < 0 : perceivedDx > 0;
    hints.push({
      id: 'frame:x',
      symbol: goRight ? '→' : '←',
      label: `${who} ${goRight ? 'right' : 'left'}`,
      size: 28 + absDx * 80,
      severity: absDx,
    });
  }

  if (absDy > SHIFT_MIN) {
    const goUp = facingFront ? diff.dy > 0 : diff.dy < 0;
    hints.push({
      id: 'frame:y',
      symbol: goUp ? '↑' : '↓',
      label: `${who} ${goUp ? 'up' : 'down'}`,
      size: 28 + absDy * 80,
      severity: absDy,
    });
  }

  return hints.sort((a, b) => b.severity - a.severity);
}

/** Back-compat single-hint helper used by tests / simple callers. */
export function framingHint(
  diff: FramingDiff,
  options: FramingOptions,
): FramingHint | null {
  return framingHints(diff, options)[0] ?? null;
}
