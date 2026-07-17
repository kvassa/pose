import type { PoseLandmarks } from '@pose-match/shared-types';
import {
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect, useMemo, useState } from 'react';

import { liveFrameMetaSV } from '../state/frameState';
import { guideTransformSV } from '../state/guideState';
import {
  buildNeonLimbPath,
  buildNeonTorsoFill,
  neonHeadCenter,
  neonHeadRadius,
} from './neonSilhouette';

type TargetGuideOverlayProps = {
  imageUrl: string | null;
  keypoints: PoseLandmarks | null;
  /** True for selfie camera — guide flips to match the mirrored preview. */
  facingFront: SharedValue<boolean>;
};

const MIN_SCALE = 0.35;
const MAX_SCALE = 3.2;
const NEON_CORE = 'rgba(0, 255, 120, 0.85)';
const NEON_GLOW = 'rgba(0, 255, 120, 0.32)';
const NEON_FILL = 'rgba(0, 255, 120, 0.12)';

/** Largest rect that fits the whole image inside the camera (letterbox / pillarbox). */
function containRect(
  imageW: number,
  imageH: number,
  screenW: number,
  screenH: number,
): { x: number; y: number; w: number; h: number } {
  if (imageW <= 0 || imageH <= 0 || screenW <= 0 || screenH <= 0) {
    return { x: 0, y: 0, w: screenW, h: screenH };
  }
  const s = Math.min(screenW / imageW, screenH / imageH);
  const w = imageW * s;
  const h = imageH * s;
  return {
    x: (screenW - w) / 2,
    y: (screenH - h) / 2,
    w,
    h,
  };
}

/** Same rule as the live skeleton: flip only when selfie preview isn't already mirrored. */
function needsFrontMirror(facingFront: boolean, isMirrored: boolean) {
  'worklet';
  return facingFront && !isMirrored;
}

function mirrorLandmarks(landmarks: PoseLandmarks): PoseLandmarks {
  'worklet';
  const out: PoseLandmarks = [];
  for (let i = 0; i < landmarks.length; i++) {
    const kp = landmarks[i];
    out.push({ ...kp, x: 1 - kp.x });
  }
  return out;
}

export function TargetGuideOverlay({
  imageUrl,
  keypoints,
  facingFront,
}: TargetGuideOverlayProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const skiaImage = useImage(imageUrl);

  const layout = useMemo(() => {
    if (!skiaImage) {
      return { x: 0, y: 0, w: screenW, h: screenH };
    }
    return containRect(skiaImage.width(), skiaImage.height(), screenW, screenH);
  }, [skiaImage, screenW, screenH]);

  const translateX = useSharedValue(layout.x);
  const translateY = useSharedValue(layout.y);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const keypointsSV = useSharedValue<PoseLandmarks | null>(null);
  const guideWSV = useSharedValue(layout.w);
  const guideHSV = useSharedValue(layout.h);
  const mirrorXSV = useSharedValue(false);

  const [mirrorX, setMirrorX] = useState(false);

  useEffect(() => {
    keypointsSV.value = keypoints;
  }, [keypoints, keypointsSV]);

  useEffect(() => {
    translateX.value = layout.x;
    translateY.value = layout.y;
    scale.value = 1;
    guideWSV.value = layout.w;
    guideHSV.value = layout.h;
  }, [layout.h, layout.w, layout.x, layout.y, guideHSV, guideWSV, scale, translateX, translateY]);

  useAnimatedReaction(
    () => {
      const meta = liveFrameMetaSV.value;
      return needsFrontMirror(facingFront.value, Boolean(meta?.isMirrored));
    },
    (mirror) => {
      mirrorXSV.value = mirror;
      runOnJS(setMirrorX)(mirror);
    },
    [],
  );

  // Publish guide pose so framing arrows can follow the outline you dragged.
  useDerivedValue(() => {
    guideTransformSV.value = {
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
      w: guideWSV.value,
      h: guideHSV.value,
      mirrorX: mirrorXSV.value,
    };
  });

  useEffect(() => {
    return () => {
      guideTransformSV.value = null;
    };
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan()
          .onBegin(() => {
            startX.value = translateX.value;
            startY.value = translateY.value;
          })
          .onUpdate((e) => {
            translateX.value = startX.value + e.translationX;
            translateY.value = startY.value + e.translationY;
          }),
        Gesture.Pinch()
          .onBegin(() => {
            startScale.value = scale.value;
          })
          .onUpdate((e) => {
            const next = startScale.value * e.scale;
            scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
          }),
      ),
    [scale, startScale, startX, startY, translateX, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    width: guideWSV.value,
    height: guideHSV.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const drawKeypoints = useDerivedValue(() => {
    const kps = keypointsSV.value;
    if (!kps) return null;
    return mirrorXSV.value ? mirrorLandmarks(kps) : kps;
  }, []);

  const limbPath = useDerivedValue(() => {
    const kps = drawKeypoints.value;
    if (!kps) return Skia.Path.Make();
    return buildNeonLimbPath(kps, guideWSV.value, guideHSV.value);
  }, []);

  const torsoPath = useDerivedValue(() => {
    const kps = drawKeypoints.value;
    if (!kps) return Skia.Path.Make();
    return buildNeonTorsoFill(kps, guideWSV.value, guideHSV.value);
  }, []);

  const headCx = useDerivedValue(() => {
    const kps = drawKeypoints.value;
    if (!kps) return -40;
    return neonHeadCenter(kps, guideWSV.value, guideHSV.value)?.x ?? -40;
  }, []);

  const headCy = useDerivedValue(() => {
    const kps = drawKeypoints.value;
    if (!kps) return -40;
    return neonHeadCenter(kps, guideWSV.value, guideHSV.value)?.y ?? -40;
  }, []);

  const headR = useDerivedValue(() => {
    const kps = drawKeypoints.value;
    if (!kps) return 0;
    return neonHeadRadius(kps, guideWSV.value, guideHSV.value);
  }, []);

  const headGlowR = useDerivedValue(() => headR.value + 6, []);

  // Flip the photo horizontally for selfie so it lines up with the live skeleton.
  if (!imageUrl && !keypoints) return null;

  const photo = skiaImage ? (
    <SkiaImage
      image={skiaImage}
      x={0}
      y={0}
      width={layout.w}
      height={layout.h}
      fit="fill"
      opacity={0.36}
    />
  ) : null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.guide, animatedStyle]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {photo ? (
              mirrorX ? (
                <Group transform={[{ translateX: layout.w }, { scaleX: -1 }]}>{photo}</Group>
              ) : (
                photo
              )
            ) : null}

            <Path path={torsoPath} color={NEON_FILL} style="fill" />

            <Path
              path={limbPath}
              color={NEON_GLOW}
              style="stroke"
              strokeWidth={18}
              strokeJoin="round"
              strokeCap="round"
            />
            <Path
              path={limbPath}
              color={NEON_CORE}
              style="stroke"
              strokeWidth={8}
              strokeJoin="round"
              strokeCap="round"
            />

            <Circle cx={headCx} cy={headCy} r={headGlowR} color={NEON_GLOW} />
            <Circle cx={headCx} cy={headCy} r={headR} color={NEON_FILL} />
            <Circle cx={headCx} cy={headCy} r={headR} color={NEON_CORE} style="stroke" strokeWidth={4} />
          </Canvas>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  guide: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 5,
  },
});
