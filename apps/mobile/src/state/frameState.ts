import type { PoseLandmarks } from '@pose-match/shared-types';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

export const liveKeypointsSV: SharedValue<PoseLandmarks | null> = makeMutable<PoseLandmarks | null>(null);
export const liveKeypointCountSV: SharedValue<number> = makeMutable(0);
