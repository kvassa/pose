/**
 * Map MediaPipe buffer-space landmarks onto the Vision Camera cover preview.
 */

export type FrameMeta = {
  width: number;
  height: number;
  orientation: string;
  /** True when using the front (selfie) camera. */
  facingFront: boolean;
  /** True when Vision Camera already mirrored this frame. */
  isMirrored: boolean;
};

export type ViewPoint = { x: number; y: number };

export function bufferToUpright(
  x: number,
  y: number,
  orientation: string,
): ViewPoint {
  'worklet';
  let u = x;
  let v = y;

  switch (orientation) {
    case 'portrait':
      break;
    case 'portrait-upside-down':
      u = 1 - x;
      v = 1 - y;
      break;
    case 'landscape-left':
      u = y;
      v = 1 - x;
      break;
    case 'landscape-right':
      u = 1 - y;
      v = x;
      break;
    default:
      break;
  }

  return { x: u, y: v };
}

export function orientedFrameSize(
  bufferWidth: number,
  bufferHeight: number,
  orientation: string,
): { width: number; height: number } {
  'worklet';
  const swap =
    orientation === 'landscape-left' || orientation === 'landscape-right';
  return swap
    ? { width: bufferHeight, height: bufferWidth }
    : { width: bufferWidth, height: bufferHeight };
}

/**
 * Upright normalized point → pixel on the cover-cropped preview.
 * Front vs back mirroring is applied in SkeletonOverlay (reliable SV).
 */
export function uprightToView(
  upright: ViewPoint,
  meta: FrameMeta,
  viewWidth: number,
  viewHeight: number,
): ViewPoint {
  'worklet';
  if (viewWidth <= 0 || viewHeight <= 0 || meta.width <= 0 || meta.height <= 0) {
    return { x: -1, y: -1 };
  }

  const frame = orientedFrameSize(meta.width, meta.height, meta.orientation);
  const scale = Math.max(viewWidth / frame.width, viewHeight / frame.height);
  const drawnW = frame.width * scale;
  const drawnH = frame.height * scale;
  const offsetX = (drawnW - viewWidth) / 2;
  const offsetY = (drawnH - viewHeight) / 2;

  return {
    x: upright.x * drawnW - offsetX,
    y: upright.y * drawnH - offsetY,
  };
}

export function landmarkToView(
  x: number,
  y: number,
  meta: FrameMeta,
  viewWidth: number,
  viewHeight: number,
): ViewPoint {
  'worklet';
  const upright = bufferToUpright(x, y, meta.orientation);
  return uprightToView(upright, meta, viewWidth, viewHeight);
}
