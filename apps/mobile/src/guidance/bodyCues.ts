import { getHeadRoll, getJointAngles, normalize, type JointName } from '@pose-match/pose-math';
import type { PoseLandmarks } from '@pose-match/shared-types';

export type BodyCue = {
  /** Stable id per body target — used to trigger a haptic only when it changes. */
  id: string;
  text: string;
  /** 0..1+, higher = more off. Used to pick the single most important cue. */
  severity: number;
};

type Action = 'bend' | 'straighten' | 'raise' | 'lower';
type JointSpec = {
  part: 'arm' | 'leg';
  side: 'left' | 'right';
  /** Action to suggest when the target angle is larger than the live angle. */
  targetLarger: Action;
  /** Action to suggest when the target angle is smaller than the live angle. */
  targetSmaller: Action;
};

// Joint angle grows as the joint opens (straightens) or the limb lifts away
// from the torso, so each joint maps to an intuitive body instruction.
const JOINT_SPECS: Record<JointName, JointSpec> = {
  left_elbow: { part: 'arm', side: 'left', targetLarger: 'straighten', targetSmaller: 'bend' },
  right_elbow: { part: 'arm', side: 'right', targetLarger: 'straighten', targetSmaller: 'bend' },
  left_knee: { part: 'leg', side: 'left', targetLarger: 'straighten', targetSmaller: 'bend' },
  right_knee: { part: 'leg', side: 'right', targetLarger: 'straighten', targetSmaller: 'bend' },
  left_shoulder: { part: 'arm', side: 'left', targetLarger: 'raise', targetSmaller: 'lower' },
  right_shoulder: { part: 'arm', side: 'right', targetLarger: 'raise', targetSmaller: 'lower' },
  left_hip: { part: 'leg', side: 'left', targetLarger: 'lower', targetSmaller: 'raise' },
  right_hip: { part: 'leg', side: 'right', targetLarger: 'lower', targetSmaller: 'raise' },
};

// Posing does not have to be perfect — only cue when clearly off.
const MIN_JOINT_DEG = 25;
const MIN_HEAD_DEG = 18;
const JOINT_FULL_SCALE_DEG = 60;
const HEAD_FULL_SCALE_DEG = 30;
/** Head is noisier than limbs; keep it from drowning out a real arm/leg fix. */
const HEAD_SEVERITY_SCALE = 0.55;
const MIN_SHOW_SEVERITY = 0.4;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Wrap a degree difference into [-180, 180] so ear-line readings don't jump. */
function wrapDegrees(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

type BuildOptions = {
  /** True when the preview is horizontally mirrored (selfie view). */
  mirrored?: boolean;
};

/**
 * Directional corrections for arms, legs, and head tilt, sorted worst-first.
 * Left/right always refer to the person's own body, which is correct on either camera.
 */
export function buildBodyCues(
  target: PoseLandmarks | null,
  live: PoseLandmarks | null,
  options: BuildOptions = {},
): BodyCue[] {
  if (!target || !live || target.length !== 33 || live.length !== 33) return [];

  const targetAngles = getJointAngles(normalize(target));
  const liveAngles = getJointAngles(normalize(live));
  const cues: BodyCue[] = [];

  for (const joint of Object.keys(JOINT_SPECS) as JointName[]) {
    const diff = targetAngles[joint] - liveAngles[joint];
    if (Math.abs(diff) < MIN_JOINT_DEG) continue;
    const spec = JOINT_SPECS[joint];
    const action = diff > 0 ? spec.targetLarger : spec.targetSmaller;
    cues.push({
      id: joint,
      text: `${capitalize(action)} your ${spec.side} ${spec.part}`,
      severity: Math.abs(diff) / JOINT_FULL_SCALE_DEG,
    });
  }

  const targetRoll = getHeadRoll(target);
  const liveRoll = getHeadRoll(live);
  if (targetRoll != null && liveRoll != null) {
    const diff = wrapDegrees(targetRoll - liveRoll);
    if (Math.abs(diff) >= MIN_HEAD_DEG) {
      // Sign convention for mirrored selfie; flip if tilt reads backwards on device.
      const tiltRight = options.mirrored ? diff < 0 : diff > 0;
      cues.push({
        id: 'head',
        text: `Tilt your head ${tiltRight ? 'right' : 'left'}`,
        severity: (Math.abs(diff) / HEAD_FULL_SCALE_DEG) * HEAD_SEVERITY_SCALE,
      });
    }
  }

  return cues
    .filter((c) => c.severity >= MIN_SHOW_SEVERITY)
    .sort((a, b) => b.severity - a.severity);
}
