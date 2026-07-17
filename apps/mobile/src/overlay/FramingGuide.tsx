import type { BoundingBox } from '@pose-match/shared-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { createFatigueTracker } from '../guidance/cueFatigue';
import { framingHints } from '../guidance/framingCues';
import { compareToGuide } from '../guidance/guideFraming';
import type { FrameMeta } from './mapCoords';
import { liveBboxSV, liveFrameMetaSV, matchScoreSV } from '../state/frameState';
import { guideTransformSV, type GuideTransform } from '../state/guideState';

type FramingGuideProps = {
  targetBbox: BoundingBox | null;
  /** True for the selfie camera. */
  facingFront: boolean;
};

/**
 * Arrow that tells you how to shift to line up with the movable green guide.
 * Hidden at score ≥ 85. Same arrow for 45s → skip to next framing issue or hide.
 */
export function FramingGuide({ targetBbox, facingFront }: FramingGuideProps) {
  const { width: viewW, height: viewH } = useWindowDimensions();
  const [liveBbox, setLiveBbox] = useState<BoundingBox | null>(null);
  const [meta, setMeta] = useState<FrameMeta | null>(null);
  const [guide, setGuide] = useState<GuideTransform | null>(null);
  const [score, setScore] = useState(0);
  const [tick, setTick] = useState(0);
  const fatigue = useRef(createFatigueTracker()).current;

  useAnimatedReaction(
    () => liveBboxSV.value,
    (next) => {
      runOnJS(setLiveBbox)(next);
    },
    [],
  );

  useAnimatedReaction(
    () => liveFrameMetaSV.value,
    (next) => {
      runOnJS(setMeta)(next);
    },
    [],
  );

  useAnimatedReaction(
    () => guideTransformSV.value,
    (next) => {
      runOnJS(setGuide)(next);
    },
    [],
  );

  useAnimatedReaction(
    () => Math.round(matchScoreSV.value),
    (next) => {
      runOnJS(setScore)(next);
    },
    [],
  );

  useEffect(() => {
    setLiveBbox(liveBboxSV.value);
    setMeta(liveFrameMetaSV.value);
    setGuide(guideTransformSV.value);
    setScore(Math.round(matchScoreSV.value));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fatigue.reset();
  }, [facingFront, fatigue]);

  const hint = useMemo(() => {
    if (score >= 85 || !targetBbox || !liveBbox || !guide || !meta || viewW <= 0) {
      return null;
    }
    // Compare to the green guide you see — not the original photo box.
    const diff = compareToGuide({
      liveBbox,
      targetBbox,
      guide,
      meta,
      viewW,
      viewH,
      facingFront,
    });
    const candidates = framingHints(diff, {
      facingFront,
      displaySpace: true,
    });
    return fatigue.pick(candidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBbox, liveBbox, guide, meta, facingFront, score, tick, fatigue, viewW, viewH]);

  if (!hint) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.pill}>
        <Text style={[styles.symbol, { fontSize: Math.min(hint.size, 48) }]}>{hint.symbol}</Text>
        <Text style={styles.label}>{hint.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 25,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 72,
  },
  symbol: {
    color: '#fff',
    fontWeight: '700',
    lineHeight: 52,
  },
  label: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
