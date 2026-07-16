import type { BoundingBox, PoseLandmarks } from '@pose-match/shared-types';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

import type { FrameMeta } from '../overlay/mapCoords';

export const liveKeypointsSV: SharedValue<PoseLandmarks | null> = makeMutable<PoseLandmarks | null>(null);
export const liveKeypointCountSV: SharedValue<number> = makeMutable(0);

/** Raw buffer size + orientation for cover-mapping onto the preview. */
export const liveFrameMetaSV: SharedValue<FrameMeta | null> = makeMutable<FrameMeta | null>(null);

/** 0–100 how closely live pose matches the reference. */
export const matchScoreSV: SharedValue<number> = makeMutable(0);

/** Bounding box of the live person (normalized 0–1). */
export const liveBboxSV: SharedValue<BoundingBox | null> = makeMutable<BoundingBox | null>(null);
