import type { PoseLandmarks } from '@pose-match/shared-types';
import type { Frame, FrameProcessorPlugin } from 'react-native-vision-camera';
import { VisionCameraProxy } from 'react-native-vision-camera';

type NativeKeypointObject = {
  x: number;
  y: number;
  z?: number;
  visibility: number;
};

let plugin: FrameProcessorPlugin | undefined;

function getPlugin(): FrameProcessorPlugin | undefined {
  'worklet';
  if (plugin == null) {
    plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
  }
  return plugin;
}

function toPoseLandmarks(result: unknown): PoseLandmarks | null {
  'worklet';
  if (!Array.isArray(result)) return null;

  if (result.length === 132) {
    const points: PoseLandmarks = [];
    for (let i = 0; i < 33; i++) {
      const base = i * 4;
      points.push({
        x: Number(result[base]),
        y: Number(result[base + 1]),
        z: Number(result[base + 2]),
        visibility: Number(result[base + 3]),
      });
    }
    return points;
  }

  if (result.length !== 33) return null;

  const points: PoseLandmarks = [];
  for (let i = 0; i < result.length; i++) {
    const point = result[i];
    if (Array.isArray(point) && point.length >= 4) {
      points.push({
        x: Number(point[0]),
        y: Number(point[1]),
        z: Number(point[2]),
        visibility: Number(point[3]),
      });
      continue;
    }

    const obj = point as NativeKeypointObject;
    if (typeof obj?.x !== 'number' || typeof obj?.y !== 'number') return null;
    points.push({
      x: obj.x,
      y: obj.y,
      z: typeof obj.z === 'number' ? obj.z : 0,
      visibility: typeof obj.visibility === 'number' ? obj.visibility : 1,
    });
  }

  return points.length === 33 ? points : null;
}

export function detectPoseInFrame(frame: Frame): PoseLandmarks | null {
  'worklet';
  const activePlugin = getPlugin();
  if (activePlugin == null) return null;
  const result = activePlugin.call(frame);
  return toPoseLandmarks(result);
}

export function isPosePluginAvailable(): boolean {
  'worklet';
  return getPlugin() != null;
}
