import { useCallback, useEffect, useRef, useState } from 'react';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { matchScoreSV } from '../state/frameState';

const DEFAULT_THRESHOLD = 85;
const DEFAULT_DURATION_MS = 800;

/**
 * Becomes true once the match score stays at/above the threshold
 * for a continuous stretch of time (default: 85 for 800ms).
 */
export function useSustainedMatch(
  threshold = DEFAULT_THRESHOLD,
  durationMs = DEFAULT_DURATION_MS,
): boolean {
  const [sustained, setSustained] = useState(false);
  const aboveSince = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thresholdRef = useRef(threshold);
  const durationRef = useRef(durationMs);
  thresholdRef.current = threshold;
  durationRef.current = durationMs;

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onScore = useCallback(
    (score: number) => {
      const need = thresholdRef.current;
      const holdMs = durationRef.current;

      if (score >= need) {
        if (aboveSince.current == null) {
          aboveSince.current = Date.now();
          clearTimer();
          timer.current = setTimeout(() => {
            if (
              aboveSince.current != null &&
              Date.now() - aboveSince.current >= holdMs
            ) {
              setSustained(true);
            }
          }, holdMs);
        } else if (Date.now() - aboveSince.current >= holdMs) {
          setSustained(true);
        }
      } else {
        aboveSince.current = null;
        clearTimer();
        setSustained(false);
      }
    },
    [clearTimer],
  );

  useAnimatedReaction(
    () => Math.round(matchScoreSV.value),
    (score) => {
      runOnJS(onScore)(score);
    },
    [onScore],
  );

  useEffect(() => {
    onScore(Math.round(matchScoreSV.value));
    return clearTimer;
  }, [onScore, clearTimer]);

  return sustained;
}
