import type { PoseLandmarks } from '@pose-match/shared-types';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useCallback, useState } from 'react';

import { landmarkToView, type FrameMeta } from './mapCoords';
import { DRAW_JOINTS, POSE_CONNECTIONS } from './poseConnections';

type SkeletonOverlayProps = {
  liveKeypoints: SharedValue<PoseLandmarks | null>;
  frameMeta: SharedValue<FrameMeta | null>;
  /** React-driven; true for selfie camera. */
  facingFront: SharedValue<boolean>;
};

const LIVE_STROKE = 'rgba(255, 255, 255, 0.95)';
const LIVE_GLOW = 'rgba(255, 255, 255, 0.35)';
const MIN_VISIBILITY = 0.3;

/**
 * Front + buffer already mirrored → no extra flip (avoids double-mirror).
 * Front + buffer not mirrored → flip X to match selfie preview.
 * Back → never flip.
 */
function needsFrontMirror(facingFront: boolean, isMirrored: boolean) {
  'worklet';
  return facingFront && !isMirrored;
}

function pointOnView(
  landmarks: PoseLandmarks,
  index: number,
  meta: FrameMeta,
  viewWidth: number,
  viewHeight: number,
  facingFront: boolean,
) {
  'worklet';
  const kp = landmarks[index];
  if (!kp || kp.visibility < MIN_VISIBILITY) return null;
  const p = landmarkToView(kp.x, kp.y, meta, viewWidth, viewHeight);
  if (needsFrontMirror(facingFront, meta.isMirrored)) {
    return { x: viewWidth - p.x, y: p.y };
  }
  return p;
}

function buildBonePath(
  landmarks: PoseLandmarks,
  meta: FrameMeta,
  viewWidth: number,
  viewHeight: number,
  facingFront: boolean,
) {
  'worklet';
  const path = Skia.Path.Make();
  for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
    const pair = POSE_CONNECTIONS[i];
    const p1 = pointOnView(landmarks, pair[0], meta, viewWidth, viewHeight, facingFront);
    const p2 = pointOnView(landmarks, pair[1], meta, viewWidth, viewHeight, facingFront);
    if (!p1 || !p2) continue;
    path.moveTo(p1.x, p1.y);
    path.lineTo(p2.x, p2.y);
  }

  const nose = pointOnView(landmarks, 0, meta, viewWidth, viewHeight, facingFront);
  const ls = pointOnView(landmarks, 11, meta, viewWidth, viewHeight, facingFront);
  const rs = pointOnView(landmarks, 12, meta, viewWidth, viewHeight, facingFront);
  if (nose && ls && rs) {
    path.moveTo((ls.x + rs.x) / 2, (ls.y + rs.y) / 2);
    path.lineTo(nose.x, nose.y);
  }

  return path;
}

export function SkeletonOverlay({
  liveKeypoints,
  frameMeta,
  facingFront,
}: SkeletonOverlayProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const liveBones = useDerivedValue(() => {
    const landmarks = liveKeypoints.value;
    const meta = frameMeta.value;
    if (!landmarks || !meta || size.width === 0) return Skia.Path.Make();
    return buildBonePath(landmarks, meta, size.width, size.height, facingFront.value);
  }, [size.width, size.height]);

  const jointPositions = useDerivedValue(() => {
    const landmarks = liveKeypoints.value;
    const meta = frameMeta.value;
    if (!landmarks || !meta || size.width === 0) return [] as { x: number; y: number }[];
    const joints: { x: number; y: number }[] = [];
    const front = facingFront.value;
    for (let i = 0; i < DRAW_JOINTS.length; i++) {
      const p = pointOnView(landmarks, DRAW_JOINTS[i], meta, size.width, size.height, front);
      if (p) joints.push(p);
    }
    return joints;
  }, [size.width, size.height]);

  const headCx = useDerivedValue(() => {
    const landmarks = liveKeypoints.value;
    const meta = frameMeta.value;
    if (!landmarks || !meta || size.width === 0) return -40;
    const nose = pointOnView(landmarks, 0, meta, size.width, size.height, facingFront.value);
    if (nose) return nose.x;
    const ls = pointOnView(landmarks, 11, meta, size.width, size.height, facingFront.value);
    const rs = pointOnView(landmarks, 12, meta, size.width, size.height, facingFront.value);
    if (!ls || !rs) return -40;
    return (ls.x + rs.x) / 2;
  }, [size.width, size.height]);

  const headCy = useDerivedValue(() => {
    const landmarks = liveKeypoints.value;
    const meta = frameMeta.value;
    if (!landmarks || !meta || size.width === 0) return -40;
    const nose = pointOnView(landmarks, 0, meta, size.width, size.height, facingFront.value);
    if (nose) return nose.y;
    const ls = pointOnView(landmarks, 11, meta, size.width, size.height, facingFront.value);
    const rs = pointOnView(landmarks, 12, meta, size.width, size.height, facingFront.value);
    if (!ls || !rs) return -40;
    return Math.min(ls.y, rs.y) - 24;
  }, [size.width, size.height]);

  const headR = useDerivedValue(() => {
    const landmarks = liveKeypoints.value;
    const meta = frameMeta.value;
    if (!landmarks || !meta || size.width === 0) return 0;
    const ls = pointOnView(landmarks, 11, meta, size.width, size.height, facingFront.value);
    const rs = pointOnView(landmarks, 12, meta, size.width, size.height, facingFront.value);
    if (!ls || !rs) return 18;
    const shoulderW = Math.hypot(rs.x - ls.x, rs.y - ls.y);
    return Math.max(14, shoulderW * 0.28);
  }, [size.width, size.height]);

  const headGlowR = useDerivedValue(() => (headR.value > 0 ? headR.value + 5 : 0), []);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path
            path={liveBones}
            color={LIVE_GLOW}
            style="stroke"
            strokeWidth={12}
            strokeJoin="round"
            strokeCap="round"
          />
          <Path
            path={liveBones}
            color={LIVE_STROKE}
            style="stroke"
            strokeWidth={3.5}
            strokeJoin="round"
            strokeCap="round"
          />
          <Circle cx={headCx} cy={headCy} r={headGlowR} color={LIVE_GLOW} />
          <Circle cx={headCx} cy={headCy} r={headR} color={LIVE_STROKE} style="stroke" strokeWidth={3} />
          {Array.from({ length: DRAW_JOINTS.length }).map((_, i) => (
            <LiveJoint key={i} joints={jointPositions} index={i} />
          ))}
        </Canvas>
      ) : null}
    </View>
  );
}

function LiveJoint({
  joints,
  index,
}: {
  joints: SharedValue<{ x: number; y: number }[]>;
  index: number;
}) {
  const cx = useDerivedValue(() => joints.value[index]?.x ?? -20, [index]);
  const cy = useDerivedValue(() => joints.value[index]?.y ?? -20, [index]);

  return (
    <>
      <Circle cx={cx} cy={cy} r={6} color={LIVE_GLOW} />
      <Circle cx={cx} cy={cy} r={3.5} color={LIVE_STROKE} />
    </>
  );
}
