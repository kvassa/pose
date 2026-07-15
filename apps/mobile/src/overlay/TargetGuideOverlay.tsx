import type { PoseLandmarks } from '@pose-match/shared-types';
import { Canvas, Circle, Image as SkiaImage, Path, Skia, useImage } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useEffect, useMemo } from 'react';

import {
  buildNeonLimbPath,
  buildNeonTorsoFill,
  neonHeadCenter,
  neonHeadRadius,
} from './neonSilhouette';

type TargetGuideOverlayProps = {
  imageUrl: string | null;
  keypoints: PoseLandmarks | null;
};

const GUIDE_W = 220;
const GUIDE_H = 320;
const MIN_SCALE = 0.35;
const MAX_SCALE = 3.2;
const NEON_CORE = 'rgba(0, 255, 120, 0.85)';
const NEON_GLOW = 'rgba(0, 255, 120, 0.32)';
const NEON_FILL = 'rgba(0, 255, 120, 0.12)';

export function TargetGuideOverlay({ imageUrl, keypoints }: TargetGuideOverlayProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const skiaImage = useImage(imageUrl);

  const translateX = useSharedValue((screenW - GUIDE_W) / 2);
  const translateY = useSharedValue(screenH * 0.22);
  const scale = useSharedValue(0.85);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const keypointsSV = useSharedValue<PoseLandmarks | null>(null);

  useEffect(() => {
    keypointsSV.value = keypoints;
  }, [keypoints, keypointsSV]);

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
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const limbPath = useDerivedValue(() => {
    const kps = keypointsSV.value;
    if (!kps) return Skia.Path.Make();
    return buildNeonLimbPath(kps, GUIDE_W, GUIDE_H);
  }, []);

  const torsoPath = useDerivedValue(() => {
    const kps = keypointsSV.value;
    if (!kps) return Skia.Path.Make();
    return buildNeonTorsoFill(kps, GUIDE_W, GUIDE_H);
  }, []);

  const headCx = useDerivedValue(() => {
    const kps = keypointsSV.value;
    if (!kps) return -40;
    return neonHeadCenter(kps, GUIDE_W, GUIDE_H)?.x ?? -40;
  }, []);

  const headCy = useDerivedValue(() => {
    const kps = keypointsSV.value;
    if (!kps) return -40;
    return neonHeadCenter(kps, GUIDE_W, GUIDE_H)?.y ?? -40;
  }, []);

  const headR = useDerivedValue(() => {
    const kps = keypointsSV.value;
    if (!kps) return 0;
    return neonHeadRadius(kps, GUIDE_W, GUIDE_H);
  }, []);

  const headGlowR = useDerivedValue(() => headR.value + 6, []);

  if (!imageUrl && !keypoints) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.guide, animatedStyle]}>
        <View style={styles.inner} pointerEvents="box-none">
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {skiaImage ? (
              <SkiaImage
                image={skiaImage}
                x={0}
                y={0}
                width={GUIDE_W}
                height={GUIDE_H}
                fit="contain"
                opacity={0.45}
              />
            ) : null}

            <Path path={torsoPath} color={NEON_FILL} style="fill" />

            <Path
              path={limbPath}
              color={NEON_GLOW}
              style="stroke"
              strokeWidth={22}
              strokeJoin="round"
              strokeCap="round"
            />
            <Path
              path={limbPath}
              color={NEON_CORE}
              style="stroke"
              strokeWidth={10}
              strokeJoin="round"
              strokeCap="round"
            />

            <Circle cx={headCx} cy={headCy} r={headGlowR} color={NEON_GLOW} />
            <Circle cx={headCx} cy={headCy} r={headR} color={NEON_FILL} />
            <Circle cx={headCx} cy={headCy} r={headR} color={NEON_CORE} style="stroke" strokeWidth={5} />
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
    width: GUIDE_W,
    height: GUIDE_H,
    zIndex: 10,
  },
  inner: {
    width: GUIDE_W,
    height: GUIDE_H,
  },
});
