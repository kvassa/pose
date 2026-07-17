import { requireNativeModule } from 'expo-modules-core';
import { comparePoses } from '@pose-match/pose-math';
import type { BoundingBox, PoseLandmarks } from '@pose-match/shared-types';
import type { CameraDevice, CameraPosition } from 'react-native-vision-camera';
import { Camera, runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Worklets } from 'react-native-worklets-core';

import { pushBurstFrame } from '../capture/burstBuffer';
import { toFileUri } from '../capture/saveCapture';
import { useSustainedMatch } from '../capture/useSustainedMatch';
import { CueBanner } from '../overlay/CueBanner';
import { CountdownOverlay } from '../overlay/CountdownOverlay';
import { detectPoseInFrame } from '../ml/poseFrameProcessor';
import type { FrameMeta } from '../overlay/mapCoords';
import { FramingGuide } from '../overlay/FramingGuide';
import { MatchIndicator } from '../overlay/MatchIndicator';
import { ShutterButton } from '../overlay/ShutterButton';
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

export type CapturedPhoto = {
  uri: string;
  score: number;
};

type CameraViewProps = {
  device: CameraDevice;
  isActive: boolean;
  targetKeypoints?: PoseLandmarks | null;
  targetBbox?: BoundingBox | null;
  targetImageUrl?: string | null;
  onFlipCamera?: () => void;
  /** Called after a manual or auto photo is taken. */
  onCaptured?: (photo: CapturedPhoto) => void;
};

type DetectionPayload = {
  landmarks: PoseLandmarks | null;
  meta: FrameMeta;
};

const PoseDetector = requireNativeModule('PoseDetector');
const MATCH_THRESHOLD = 85;
const COOLDOWN_MS = 5_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

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
  onCaptured,
}: CameraViewProps) {
  const cameraRef = useRef<Camera>(null);
  const [modelReady, setModelReady] = useState(false);
  const [keypointCount, setKeypointCount] = useState(0);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const facingFrontSV = useSharedValue(device.position === 'front');
  const cooldownUntil = useRef(0);
  const countdownRunning = useRef(false);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  const sustainedMatch = useSustainedMatch(MATCH_THRESHOLD, 800);

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

      const bbox = landmarks ? landmarksBBox(landmarks) : null;
      liveBboxSV.value = bbox;

      if (landmarks && targetKeypoints && landmarks.length === 33 && targetKeypoints.length === 33) {
        try {
          const { score: poseScore } = comparePoses(targetKeypoints, landmarks);
          const rounded = Math.round(poseScore);
          matchScoreSV.value = rounded;
          setScore(rounded);
          pushBurstFrame({ timestamp: Date.now(), score: rounded });
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
      setCountdown(null);
      countdownRunning.current = false;
    }
  }, [isActive]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: true,
      });
      const uri = toFileUri(photo.path);
      const capturedScore = Math.round(matchScoreSV.value);
      console.log('photo captured:', uri, 'score:', capturedScore);
      cooldownUntil.current = Date.now() + COOLDOWN_MS;
      onCapturedRef.current?.({ uri, score: capturedScore });
    } catch (error) {
      console.log('takePhoto failed:', error);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const runCountdownThenCapture = useCallback(async () => {
    if (countdownRunning.current || busy) return;
    if (Date.now() < cooldownUntil.current) return;
    countdownRunning.current = true;

    try {
      for (const step of [3, 2, 1]) {
        if (Math.round(matchScoreSV.value) < MATCH_THRESHOLD) {
          setCountdown(null);
          return;
        }
        setCountdown(step);
        await sleep(1000);
      }
      setCountdown(null);
      if (Math.round(matchScoreSV.value) >= MATCH_THRESHOLD) {
        await takePhoto();
      }
    } finally {
      countdownRunning.current = false;
      setCountdown(null);
    }
  }, [busy, takePhoto]);

  useEffect(() => {
    if (!isActive || !sustainedMatch) return;
    void runCountdownThenCapture();
  }, [isActive, sustainedMatch, runCountdownThenCapture]);

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
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        photo
        pixelFormat="rgb"
        resizeMode="cover"
        frameProcessor={frameProcessor}
      />
      <SkeletonOverlay
        liveKeypoints={liveKeypointsSV}
        frameMeta={liveFrameMetaSV}
        facingFront={facingFrontSV}
      />
      <TargetGuideOverlay
        imageUrl={targetImageUrl}
        keypoints={targetKeypoints}
        facingFront={facingFrontSV}
      />
      <CueBanner targetKeypoints={targetKeypoints} />
      <FramingGuide targetBbox={resolvedTargetBbox} facingFront={facingFront} />
      <MatchIndicator />
      <CountdownOverlay value={countdown} />
      <KeypointDebugOverlay modelReady={modelReady} keypointCount={keypointCount} score={score} />
      <ShutterButton onPress={() => void takePhoto()} disabled={busy || countdown != null} />
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
    bottom: 130,
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
