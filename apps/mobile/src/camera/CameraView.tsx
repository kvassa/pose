import { requireNativeModule } from 'expo-modules-core';
import { comparePoses } from '@pose-match/pose-math';
import type { BoundingBox, PoseLandmarks } from '@pose-match/shared-types';
import type { CameraDevice, CameraPosition } from 'react-native-vision-camera';
import { Camera, runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Worklets } from 'react-native-worklets-core';

import { detectPoseInFrame } from '../ml/poseFrameProcessor';
import type { FrameMeta } from '../overlay/mapCoords';
import { FramingGuide } from '../overlay/FramingGuide';
import { MatchIndicator } from '../overlay/MatchIndicator';
import { landmarksBBox } from '../overlay/projectPose';
import { SkeletonOverlay } from '../overlay/SkeletonOverlay';
import { TargetGuideOverlay } from '../overlay/TargetGuideOverlay';
import {
  liveBboxSV,
  liveFrameMetaSV,
  liveKeypointCountSV,
  liveKeypointsSV,
  matchScoreSV,
} from '../state/frameState';

type CameraViewProps = {
  device: CameraDevice;
  isActive: boolean;
  targetKeypoints?: PoseLandmarks | null;
  targetBbox?: BoundingBox | null;
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
  score,
}: {
  modelReady: boolean;
  keypointCount: number;
  score: number;
}) {
  let label = 'starting…';
  if (!modelReady) {
    label = 'Keypoints: model missing — rebuild app';
  } else if (keypointCount > 0) {
    label = `Keypoints: ${keypointCount} · score ${score}`;
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
  targetBbox = null,
  targetImageUrl = null,
  onFlipCamera,
}: CameraViewProps) {
  const [modelReady, setModelReady] = useState(false);
  const [keypointCount, setKeypointCount] = useState(0);
  const [score, setScore] = useState(0);
  const facingFrontSV = useSharedValue(device.position === 'front');

  // Prefer stored bbox; otherwise compute from reference keypoints.
  const resolvedTargetBbox = useMemo(() => {
    if (targetBbox) return targetBbox;
    if (targetKeypoints) return landmarksBBox(targetKeypoints);
    return null;
  }, [targetBbox, targetKeypoints]);

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

      // Live body box for framing arrows (Task 11.3).
      const bbox = landmarks ? landmarksBBox(landmarks) : null;
      liveBboxSV.value = bbox;

      // Match score vs reference pose (Task 11.1) — on JS thread (not worklet).
      if (landmarks && targetKeypoints && landmarks.length === 33 && targetKeypoints.length === 33) {
        try {
          const { score: nextScore } = comparePoses(targetKeypoints, landmarks);
          const rounded = Math.round(nextScore);
          matchScoreSV.value = rounded;
          setScore(rounded);
        } catch {
          matchScoreSV.value = 0;
          setScore(0);
        }
      } else {
        matchScoreSV.value = 0;
        setScore(0);
      }
    },
    [device.position, facingFrontSV, targetKeypoints],
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
      liveBboxSV.value = null;
      matchScoreSV.value = 0;
      setKeypointCount(0);
      setScore(0);
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
      <FramingGuide targetBbox={resolvedTargetBbox} />
      <MatchIndicator />
      <KeypointDebugOverlay modelReady={modelReady} keypointCount={keypointCount} score={score} />
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
    zIndex: 30,
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
