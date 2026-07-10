import { requireNativeModule } from 'expo-modules-core';
import { VisionCameraProxy } from 'react-native-vision-camera';

export type NativeKeypoint = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

const PoseDetector = requireNativeModule('PoseDetector');

export async function detectNative(imageBytes: Uint8Array): Promise<NativeKeypoint[] | null> {
  const result = await PoseDetector.detect(imageBytes);
  return result ?? null;
}

export function initPoseFrameProcessorPlugin() {
  return VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
}
