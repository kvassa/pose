import type { PoseLandmarks } from '@pose-match/shared-types';
import { describe, expect, it } from 'vitest';

import { buildBodyCues } from './bodyCues';

function basePose(): PoseLandmarks {
  const pts: PoseLandmarks = [];
  for (let i = 0; i < 33; i++) pts.push({ x: 0.5, y: 0.5, visibility: 1 });
  // Torso so normalize has a non-zero scale.
  pts[11] = { x: 0.4, y: 0.4, visibility: 1 }; // left shoulder
  pts[12] = { x: 0.6, y: 0.4, visibility: 1 }; // right shoulder
  pts[23] = { x: 0.45, y: 0.7, visibility: 1 }; // left hip
  pts[24] = { x: 0.55, y: 0.7, visibility: 1 }; // right hip
  return pts;
}

function setLeftArm(pose: PoseLandmarks, elbow: [number, number], wrist: [number, number]) {
  pose[13] = { x: elbow[0], y: elbow[1], visibility: 1 };
  pose[15] = { x: wrist[0], y: wrist[1], visibility: 1 };
}

describe('buildBodyCues', () => {
  it('returns nothing when poses match', () => {
    expect(buildBodyCues(basePose(), basePose())).toEqual([]);
  });

  it('tells you to straighten a bent arm', () => {
    const target = basePose();
    setLeftArm(target, [0.4, 0.55], [0.4, 0.7]); // straight (~180°)

    const live = basePose();
    setLeftArm(live, [0.4, 0.55], [0.55, 0.55]); // bent (~90°)

    const cues = buildBodyCues(target, live);
    expect(cues[0]).toMatchObject({ id: 'left_elbow', text: 'Straighten your left arm' });
  });

  it('ignores incomplete pose data', () => {
    expect(buildBodyCues(null, basePose())).toEqual([]);
    expect(buildBodyCues(basePose(), [])).toEqual([]);
  });
});
