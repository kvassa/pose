/** MediaPipe BlazePose body connections — torso + limbs only (cleaner stick figure). */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // torso
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  // left arm
  [11, 13],
  [13, 15],
  // right arm
  [12, 14],
  [14, 16],
  // left leg
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  // right leg
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
];

/** Joint indices drawn as dots (skip most face points). */
export const DRAW_JOINTS: ReadonlyArray<number> = [
  0, // nose
  11, 12, // shoulders
  13, 14, // elbows
  15, 16, // wrists
  23, 24, // hips
  25, 26, // knees
  27, 28, // ankles
];
