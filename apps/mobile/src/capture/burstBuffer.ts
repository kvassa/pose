export type BurstFrame = {
  timestamp: number;
  score: number;
};

const MAX_FRAMES = 30;

/** Rolling history of recent match scores (last 30 samples). */
let buffer: BurstFrame[] = [];

export function pushBurstFrame(frame: BurstFrame): void {
  buffer.push(frame);
  if (buffer.length > MAX_FRAMES) {
    buffer = buffer.slice(buffer.length - MAX_FRAMES);
  }
}

export function getBurstBuffer(): readonly BurstFrame[] {
  return buffer;
}

/** Highest-scoring sample in the current buffer, or null if empty. */
export function bestBurstFrame(): BurstFrame | null {
  if (buffer.length === 0) return null;
  return buffer.reduce((best, frame) => (frame.score > best.score ? frame : best));
}

export function clearBurstBuffer(): void {
  buffer = [];
}

/** Test helper only. */
export function __resetBurstBufferForTests(): void {
  buffer = [];
}
