import type { JointName } from './angles';
import type { FramingDiff } from './framing';

export type Cue = {
  kind: 'subject' | 'camera';
  target: string;
  direction: string;
  magnitude: 'small' | 'medium' | 'large';
};

const MAGNITUDE_RANK: Record<Cue['magnitude'], number> = {
  large: 3,
  medium: 2,
  small: 1,
};

const FRAMING_SHIFT_MEDIUM = 0.1;
const FRAMING_SHIFT_LARGE = 0.2;
const FRAMING_SCALE_BACK = 1.2;
const FRAMING_SCALE_CLOSER = 0.83;

function jointMagnitude(diff: number): Cue['magnitude'] {
  if (diff > 30) {
    return 'large';
  }
  if (diff > 15) {
    return 'medium';
  }
  return 'small';
}

function framingShiftMagnitude(delta: number): Cue['magnitude'] {
  const abs = Math.abs(delta);
  if (abs > FRAMING_SHIFT_LARGE) {
    return 'large';
  }
  if (abs > FRAMING_SHIFT_MEDIUM) {
    return 'medium';
  }
  return 'small';
}

function framingScaleMagnitude(dScale: number): Cue['magnitude'] {
  if (dScale > 1.4 || dScale < 0.7) {
    return 'large';
  }
  if (dScale > FRAMING_SCALE_BACK || dScale < FRAMING_SCALE_CLOSER) {
    return 'medium';
  }
  return 'small';
}

function sortByMagnitude(cues: Cue[]): Cue[] {
  return [...cues].sort(
    (a, b) => MAGNITUDE_RANK[b.magnitude] - MAGNITUDE_RANK[a.magnitude],
  );
}

export function generateCues(
  jointDiffs: Record<JointName, number>,
  framingDiff: FramingDiff,
): Cue[] {
  const cues: Cue[] = [];

  for (const joint of Object.keys(jointDiffs) as JointName[]) {
    const diff = jointDiffs[joint];
    cues.push({
      kind: 'subject',
      target: joint,
      direction: 'adjust',
      magnitude: jointMagnitude(diff),
    });
  }

  if (Math.abs(framingDiff.dx) > FRAMING_SHIFT_MEDIUM) {
    cues.push({
      kind: 'camera',
      target: 'framing',
      direction: framingDiff.dx > 0 ? 'right' : 'left',
      magnitude: framingShiftMagnitude(framingDiff.dx),
    });
  }

  if (Math.abs(framingDiff.dy) > FRAMING_SHIFT_MEDIUM) {
    cues.push({
      kind: 'camera',
      target: 'framing',
      direction: framingDiff.dy > 0 ? 'down' : 'up',
      magnitude: framingShiftMagnitude(framingDiff.dy),
    });
  }

  if (framingDiff.dScale > FRAMING_SCALE_BACK) {
    cues.push({
      kind: 'camera',
      target: 'framing',
      direction: 'back',
      magnitude: framingScaleMagnitude(framingDiff.dScale),
    });
  } else if (framingDiff.dScale < FRAMING_SCALE_CLOSER) {
    cues.push({
      kind: 'camera',
      target: 'framing',
      direction: 'closer',
      magnitude: framingScaleMagnitude(framingDiff.dScale),
    });
  }

  return sortByMagnitude(cues);
}
