import type { PoseLandmarks } from '@pose-match/shared-types';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { buildBodyCues, type BodyCue } from '../guidance/bodyCues';
import { createFatigueTracker } from '../guidance/cueFatigue';
import { liveFrameMetaSV, liveKeypointsSV, matchScoreSV } from '../state/frameState';

type CueBannerProps = {
  targetKeypoints: PoseLandmarks | null;
};

/**
 * Top banner with the most important body correction (arm/leg/head).
 * Hidden at score ≥ 85. Same cue for 45s → skip to the next body issue.
 */
export function CueBanner({ targetKeypoints }: CueBannerProps) {
  const [cue, setCue] = useState<BodyCue | null>(null);
  const previousId = useRef<string | null>(null);
  const fatigue = useRef(createFatigueTracker()).current;

  const updateCue = useCallback(() => {
    if (matchScoreSV.value >= 85 || !targetKeypoints) {
      setCue(null);
      return;
    }
    const mirrored =
      Boolean(liveFrameMetaSV.value?.facingFront) && !liveFrameMetaSV.value?.isMirrored;
    const cues = buildBodyCues(targetKeypoints, liveKeypointsSV.value, { mirrored });
    setCue(fatigue.pick(cues));
  }, [fatigue, targetKeypoints]);

  useEffect(() => {
    updateCue();
    const interval = setInterval(updateCue, 500);
    return () => clearInterval(interval);
  }, [updateCue]);

  useEffect(() => {
    if (!cue) {
      previousId.current = null;
      return;
    }
    if (cue.id !== previousId.current) {
      previousId.current = cue.id;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  }, [cue]);

  if (!cue) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>{cue.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 64,
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 30,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
