import type { PoseLandmarks } from '@pose-match/shared-types';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

import type { FrameMeta } from '../overlay/mapCoords';

export const liveKeypointsSV: SharedValue<PoseLandmarks | null> = makeMutable<PoseLandmarks | null>(null);
export const liveKeypointCountSV: SharedValue<number> = makeMutable(0);

/** Raw buffer size + orientation for cover-mapping onto the preview. */
export const liveFrameMetaSV: SharedValue<FrameMeta | null> = makeMutable<FrameMeta | null>(null);
