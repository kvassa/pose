import type { BoundingBox, PoseLandmarks } from './pose';

export type ReferenceStatus = 'processing' | 'ready' | 'failed';

export type Reference = {
  id: string;
  user_id: string;
  image_path: string;
  thumbnail_path: string | null;
  status: ReferenceStatus;
  keypoints: PoseLandmarks | null;
  bounding_box: BoundingBox | null;
  created_at: string;
};

export type Capture = {
  id: string;
  user_id: string;
  reference_id: string | null;
  match_score: number | null;
  image_path: string | null;
  created_at: string;
};
