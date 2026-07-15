import { requireNativeModule } from 'expo-modules-core';
import type { PoseLandmarks } from '@pose-match/shared-types';
import type { CameraDevice, CameraPosition } from 'react-native-vision-camera';
import { Camera, runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Worklets } from 'react-native-worklets-core';

import { detectPoseInFrame } from '../ml/poseFrameProcessor';
import type { FrameMeta } from '../overlay/mapCoords';
import { SkeletonOverlay } from '../overlay/SkeletonOverlay';
import { TargetGuideOverlay } from '../overlay/TargetGuideOverlay';
import { liveFrameMetaSV, liveKeypointCountSV, liveKeypointsSV } from '../state/frameState';

type CameraViewProps = {
  device: CameraDevice;
  isActive: boolean;
  targetKeypoints?: PoseLandmarks | null;
  targetImageUrl?: string | null;
  onFlipCamera?: () => void;
};

type DetectionPayload = {
  landmarks: PoseLandmarks | null;
  meta: FrameMeta;
};

const PoseDetector = requireNativeModule('PoseDetector');

function KeypointDebugOverlay({
  modelReady,
  keypointCount,
}: {
  modelReady: boolean;
  keypointCount: number;
}) {
  let label = 'starting…';
  if (!modelReady) {
    label = 'Keypoints: model missing — rebuild app';
  } else if (keypointCount > 0) {
    label = `Keypoints: ${keypointCount}`;
  } else {
    label = 'Keypoints: — (step into frame)';
  }

  return (
    <View style={styles.debugWrap} pointerEvents="none">
      <Text style={styles.debugText}>{label}</Text>
    </View>
  );
}

export function CameraView({
  device,
  isActive,
  targetKeypoints = null,
  targetImageUrl = null,
  onFlipCamera,
}: CameraViewProps) {
  const [modelReady, setModelReady] = useState(false);
  const [keypointCount, setKeypointCount] = useState(0);
  const facingFrontSV = useSharedValue(device.position === 'front');

  useEffect(() => {
    facingFrontSV.value = device.position === 'front';
  }, [device.position, facingFrontSV]);

  const handleDetection = useCallback(
    (payload: DetectionPayload) => {
      const { landmarks } = payload;
      const isFront = device.position === 'front';
      const meta = {
        ...payload.meta,
        facingFront: isFront,
      };
      const count = landmarks?.length ?? 0;
      setKeypointCount(count);
      liveKeypointCountSV.value = count;
      liveKeypointsSV.value = landmarks;
      liveFrameMetaSV.value = meta;
      facingFrontSV.value = isFront;
    },
    [device.position, facingFrontSV],
  );

  const onDetection = useMemo(
    () => Worklets.createRunOnJS(handleDetection),
    [handleDetection],
  );

  useEffect(() => {
    try {
      setModelReady(Boolean(PoseDetector.isReady()));
    } catch {
      setModelReady(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      liveKeypointsSV.value = null;
      liveKeypointCountSV.value = 0;
      liveFrameMetaSV.value = null;
      setKeypointCount(0);
    }
  }, [isActive]);

  const facingFront = device.position === 'front';

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(10, () => {
        'worklet';
        onDetection({
          landmarks: detectPoseInFrame(frame),
          meta: {
            width: frame.width,
            height: frame.height,
            orientation: String(frame.orientation),
            facingFront,
            isMirrored: Boolean(frame.isMirrored),
          },
        });
      });
    },
    [onDetection, facingFront],
  );

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        pixelFormat="rgb"
        resizeMode="cover"
        frameProcessor={frameProcessor}
      />
      <SkeletonOverlay
        liveKeypoints={liveKeypointsSV}
        frameMeta={liveFrameMetaSV}
        facingFront={facingFrontSV}
      />
      <TargetGuideOverlay imageUrl={targetImageUrl} keypoints={targetKeypoints} />
      <KeypointDebugOverlay modelReady={modelReady} keypointCount={keypointCount} />
      {onFlipCamera ? (
        <Pressable style={styles.flipButton} onPress={onFlipCamera}>
          <Text style={styles.flipText}>Flip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type { CameraPosition };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  debugWrap: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  debugText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
  },
  flipButton: {
    position: 'absolute',
    top: 120,
    left: 16,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  flipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
