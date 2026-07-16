import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { matchScoreSV } from '../state/frameState';

function colorForScore(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

/**
 * Big circular badge: how close your pose is to the reference (0–100).
 * Green = great, yellow = okay, red = keep adjusting.
 */
export function MatchIndicator() {
  const [score, setScore] = useState(0);

  useAnimatedReaction(
    () => Math.round(matchScoreSV.value),
    (next) => {
      runOnJS(setScore)(next);
    },
    [],
  );

  useEffect(() => {
    setScore(Math.round(matchScoreSV.value));
  }, []);

  const backgroundColor = colorForScore(score);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.label}>match</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  score: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  label: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
