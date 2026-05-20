import type { Keypoint, PoseLandmarks } from '@pose-match/shared-types';

export type JointName =
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee';

export const JOINT_TRIPLETS: Record<JointName, [number, number, number]> = {
  left_elbow: [11, 13, 15],
  right_elbow: [12, 14, 16],
  left_shoulder: [23, 11, 13],
  right_shoulder: [24, 12, 14],
  left_hip: [11, 23, 25],
  right_hip: [12, 24, 26],
  left_knee: [23, 25, 27],
  right_knee: [24, 26, 28],
};

function angleAtVertex(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const radians = Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
  return Math.abs(radians * (180 / Math.PI));
}

export function getJointAngles(
  landmarks: PoseLandmarks,
): Record<JointName, number> {
  const angles = {} as Record<JointName, number>;

  for (const joint of Object.keys(JOINT_TRIPLETS) as JointName[]) {
    const [i, j, k] = JOINT_TRIPLETS[joint];
    angles[joint] = angleAtVertex(landmarks[i], landmarks[j], landmarks[k]);
  }

  return angles;
}
