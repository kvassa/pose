import type { BoundingBox } from '@pose-match/shared-types';
import { compareFraming } from '@pose-match/pose-math';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { liveBboxSV } from '../state/frameState';

type FramingGuideProps = {
  targetBbox: BoundingBox | null;
};

type ArrowHint = {
  symbol: string;
  label: string;
  size: number;
};

const IOU_HIDE = 0.85;

/**
 * Arrows that tell you how to shift so you fill the same space as the reference.
 * Hidden when you're already lined up well.
 */
export function FramingGuide({ targetBbox }: FramingGuideProps) {
  const [liveBbox, setLiveBbox] = useState<BoundingBox | null>(null);

  useAnimatedReaction(
    () => liveBboxSV.value,
    (next) => {
      runOnJS(setLiveBbox)(next);
    },
    [],
  );

  useEffect(() => {
    setLiveBbox(liveBboxSV.value);
  }, []);

  const hint = useMemo((): ArrowHint | null => {
    if (!targetBbox || !liveBbox) return null;

    const diff = compareFraming(targetBbox, liveBbox);
    if (diff.iou > IOU_HIDE) return null;

    const absDx = Math.abs(diff.dx);
    const absDy = Math.abs(diff.dy);
    const scaleOff = Math.abs(Math.log(Math.max(diff.dScale, 0.01)));

    // Prefer the biggest problem: position vs size.
    if (scaleOff > 0.25 && scaleOff >= absDx && scaleOff >= absDy) {
      if (diff.dScale < 1) {
        return { symbol: '＋', label: 'closer', size: 28 + scaleOff * 40 };
      }
      return { symbol: '－', label: 'back', size: 28 + scaleOff * 40 };
    }

    if (absDx >= absDy) {
      if (diff.dx > 0) {
        // Live is right of target → move left
        return { symbol: '←', label: 'left', size: 28 + absDx * 80 };
      }
      return { symbol: '→', label: 'right', size: 28 + absDx * 80 };
    }

    if (diff.dy > 0) {
      // Live is below target → move up
      return { symbol: '↑', label: 'up', size: 28 + absDy * 80 };
    }
    return { symbol: '↓', label: 'down', size: 28 + absDy * 80 };
  }, [targetBbox, liveBbox]);

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
