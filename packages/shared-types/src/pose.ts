export type Keypoint = {
  x: number;
  y: number;
  z?: number;
  visibility: number;
};

export type PoseLandmarks = Keypoint[];

export type BoundingBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};
