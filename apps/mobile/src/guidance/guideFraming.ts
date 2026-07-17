import type { FramingDiff } from '@pose-match/pose-math';
import type { BoundingBox } from '@pose-match/shared-types';

import { bufferToUpright, uprightToView, type FrameMeta } from '../overlay/mapCoords';
import type { GuideTransform } from '../state/guideState';

function needsFrontMirror(facingFront: boolean, isMirrored: boolean) {
  return facingFront && !isMirrored;
}

/** Live body center in preview pixels (matches what you see, including selfie flip). */
export function liveCenterOnScreen(
  liveBbox: BoundingBox,
  meta: FrameMeta,
  viewW: number,
  viewH: number,
  facingFront: boolean,
): { x: number; y: number } {
  const upright = bufferToUpright(
    liveBbox.x + liveBbox.w / 2,
    liveBbox.y + liveBbox.h / 2,
    meta.orientation,
  );
  const p = uprightToView(upright, meta, viewW, viewH);
  if (needsFrontMirror(facingFront, meta.isMirrored)) {
    return { x: viewW - p.x, y: p.y };
  }
  return p;
}

/** Approximate live body size in preview pixels. */
export function liveSizeOnScreen(
  liveBbox: BoundingBox,
  meta: FrameMeta,
  viewW: number,
  viewH: number,
): { w: number; h: number } {
  const frame = {
    width: meta.width,
    height: meta.height,
  };
  const orientation = meta.orientation;
  const swap = orientation === 'landscape-left' || orientation === 'landscape-right';
  const fw = swap ? frame.height : frame.width;
  const fh = swap ? frame.width : frame.height;
  const scale = Math.max(viewW / fw, viewH / fh);
  return { w: liveBbox.w * fw * scale, h: liveBbox.h * fh * scale };
}

/** Guide pose center in preview pixels (follows drag / pinch / selfie flip). */
export function guideCenterOnScreen(
  targetBbox: BoundingBox,
  guide: GuideTransform,
): { x: number; y: number } {
  let nx = targetBbox.x + targetBbox.w / 2;
  let ny = targetBbox.y + targetBbox.h / 2;
  if (guide.mirrorX) nx = 1 - nx;
  const localX = nx * guide.w;
  const localY = ny * guide.h;
  const cx = guide.w / 2;
  const cy = guide.h / 2;
  return {
    x: guide.x + cx + (localX - cx) * guide.scale,
    y: guide.y + cy + (localY - cy) * guide.scale,
  };
}

export function guideSizeOnScreen(
  targetBbox: BoundingBox,
  guide: GuideTransform,
): { w: number; h: number } {
  return {
    w: targetBbox.w * guide.w * guide.scale,
    h: targetBbox.h * guide.h * guide.scale,
  };
}

/**
 * Framing vs the movable green guide (what you actually line up with),
 * not the original photo's raw bounding box.
 */
export function compareToGuide(options: {
  liveBbox: BoundingBox;
  targetBbox: BoundingBox;
  guide: GuideTransform;
  meta: FrameMeta;
  viewW: number;
  viewH: number;
  facingFront: boolean;
}): FramingDiff {
  const { liveBbox, targetBbox, guide, meta, viewW, viewH, facingFront } = options;
  const live = liveCenterOnScreen(liveBbox, meta, viewW, viewH, facingFront);
  const target = guideCenterOnScreen(targetBbox, guide);
  const liveSize = liveSizeOnScreen(liveBbox, meta, viewW, viewH);
  const guideSize = guideSizeOnScreen(targetBbox, guide);

  const dx = viewW > 0 ? (live.x - target.x) / viewW : 0;
  const dy = viewH > 0 ? (live.y - target.y) / viewH : 0;
  const liveArea = Math.max(liveSize.w * liveSize.h, 1);
  const guideArea = Math.max(guideSize.w * guideSize.h, 1);
  const dScale = liveArea / guideArea;

  // Soft overlap proxy from center distance + size — enough to hide when lined up.
  const shift = Math.hypot(dx, dy);
  const scaleOff = Math.abs(Math.log(Math.max(dScale, 0.01)));
  const iou = Math.max(0, 1 - shift * 2.2 - scaleOff * 0.6);

  return { dx, dy, dScale, iou };
}
