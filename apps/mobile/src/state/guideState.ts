import { makeMutable, type SharedValue } from 'react-native-reanimated';

/** Where the movable green guide sits on the camera preview. */
export type GuideTransform = {
  x: number;
  y: number;
  scale: number;
  w: number;
  h: number;
  /** True when the guide is flipped to match a mirrored selfie preview. */
  mirrorX: boolean;
};

export const guideTransformSV: SharedValue<GuideTransform | null> =
  makeMutable<GuideTransform | null>(null);
