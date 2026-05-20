import { describe, expect, it } from 'vitest';
import type { JointName } from './angles';
import type { FramingDiff } from './framing';
import { generateCues } from './cues';

function zeroJointDiffs(): Record<JointName, number> {
  return {
    left_shoulder: 0,
    right_shoulder: 0,
    left_elbow: 0,
    right_elbow: 0,
    left_hip: 0,
    right_hip: 0,
    left_knee: 0,
    right_knee: 0,
  };
}

describe('generateCues', () => {
  it('puts pan-right camera cue first when dx is large', () => {
    const framingDiff: FramingDiff = {
      dx: 0.3,
      dy: 0,
      dScale: 1,
      iou: 0.8,
    };

    const cues = generateCues(zeroJointDiffs(), framingDiff);

    expect(cues[0]).toMatchObject({
      kind: 'camera',
      target: 'framing',
      direction: 'right',
      magnitude: 'large',
    });
  });

  it('puts move-back camera cue first when live framing is much larger', () => {
    const framingDiff: FramingDiff = {
      dx: 0,
      dy: 0,
      dScale: 1.5,
      iou: 0.6,
    };

    const cues = generateCues(zeroJointDiffs(), framingDiff);

    expect(cues[0]).toMatchObject({
      kind: 'camera',
      target: 'framing',
      direction: 'back',
      magnitude: 'large',
    });
  });

  it('puts subject joint cue first when a joint diff is largest', () => {
    const jointDiffs = zeroJointDiffs();
    jointDiffs.left_elbow = 40;

    const cues = generateCues(jointDiffs, {
      dx: 0,
      dy: 0,
      dScale: 1,
      iou: 1,
    });

    expect(cues[0]).toMatchObject({
      kind: 'subject',
      target: 'left_elbow',
      direction: 'adjust',
      magnitude: 'large',
    });
  });
});
