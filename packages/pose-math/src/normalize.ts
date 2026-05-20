import type { PoseLandmarks } from '@pose-match/shared-types';

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

function hipMidpoint(landmarks: PoseLandmarks): { x: number; y: number } {
  const left = landmarks[LEFT_HIP];
  const right = landmarks[RIGHT_HIP];
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function shoulderMidpoint(landmarks: PoseLandmarks): { x: number; y: number } {
  const left = landmarks[LEFT_SHOULDER];
  const right = landmarks[RIGHT_SHOULDER];
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

export function centerOnHip(landmarks: PoseLandmarks): PoseLandmarks {
  const { x: midX, y: midY } = hipMidpoint(landmarks);

  return landmarks.map((kp) => ({
    ...kp,
    x: kp.x - midX,
    y: kp.y - midY,
  }));
}

export function normalize(landmarks: PoseLandmarks): PoseLandmarks {
  const centered = centerOnHip(landmarks);
  const shoulders = shoulderMidpoint(centered);
  const scale = Math.hypot(shoulders.x, shoulders.y);

  return centered.map((kp) => ({
    ...kp,
    x: kp.x / scale,
    y: kp.y / scale,
  }));
}
