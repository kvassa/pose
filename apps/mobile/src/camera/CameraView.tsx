import { requireNativeModule } from 'expo-modules-core';
import type { CameraDevice, CameraPosition } from 'react-native-vision-camera';
import { Camera, runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Worklets } from 'react-native-worklets-core';

import { detectPoseInFrame } from '../ml/poseFrameProcessor';
import { liveKeypointCountSV } from '../state/frameState';

type CameraViewProps = {
  device: CameraDevice;
  isActive: boolean;
  onFlipCamera?: () => void;
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

export function CameraView({ device, isActive, onFlipCamera }: CameraViewProps) {
  const [modelReady, setModelReady] = useState(false);
  const [keypointCount, setKeypointCount] = useState(0);

  const handleDetection = useCallback((count: number) => {
    setKeypointCount(count);
    liveKeypointCountSV.value = count;
  }, []);

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

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(10, () => {
        'worklet';
        const count = detectPoseInFrame(frame)?.length ?? 0;
        onDetection(count);
      });
    },
    [onDetection],
  );

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        pixelFormat="rgb"
        frameProcessor={frameProcessor}
      />
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
