from __future__ import annotations

import io
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
from PIL import Image

from src.types import BoundingBox, Keypoint

if TYPE_CHECKING:
    from mediapipe.tasks.python.vision.pose_landmarker import PoseLandmarker

MODEL_PATH = (
    Path(__file__).resolve().parent.parent / "models" / "pose_landmarker_heavy.task"
)
VISIBILITY_THRESHOLD = 0.5
LANDMARK_COUNT = 33

_landmarker: PoseLandmarker | None = None


def _get_landmarker() -> PoseLandmarker:
    global _landmarker
    if _landmarker is None:
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions, vision
        from mediapipe.tasks.python.vision.pose_landmarker import (
            PoseLandmarker,
            PoseLandmarkerOptions,
        )

        if not MODEL_PATH.is_file():
            raise FileNotFoundError(
                f"Pose landmarker model not found at {MODEL_PATH}. "
                "Download pose_landmarker_heavy.task into services/pose-worker/models/."
            )
        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
        )
        _landmarker = PoseLandmarker.create_from_options(options)
    return _landmarker


def _landmarks_to_keypoints(landmarks: Any) -> list[Keypoint]:
    keypoints: list[Keypoint] = []
    for landmark in landmarks:
        visibility = (
            landmark.visibility
            if landmark.visibility is not None
            else landmark.presence
            if landmark.presence is not None
            else 1.0
        )
        z = landmark.z if landmark.z is not None else None
        keypoints.append(
            Keypoint(x=landmark.x, y=landmark.y, z=z, visibility=float(visibility))
        )
    return keypoints


def _bbox_from_keypoints(keypoints: list[Keypoint]) -> BoundingBox | None:
    visible = [k for k in keypoints if k.visibility >= VISIBILITY_THRESHOLD]
    if not visible:
        return None
    xs = [k.x for k in visible]
    ys = [k.y for k in visible]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max_x - min_x
    h = max_y - min_y
    if w <= 0.0 or h <= 0.0:
        return None
    return BoundingBox(x=min_x, y=min_y, w=w, h=h)


def extract_pose(image_bytes: bytes) -> tuple[list[Keypoint], BoundingBox] | None:
    """Run MediaPipe Pose Landmarker (heavy) on image bytes; return 33 keypoints + bbox."""
    import mediapipe as mp

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    frame = np.asarray(image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)

    result = _get_landmarker().detect(mp_image)
    if not result.pose_landmarks:
        return None

    keypoints = _landmarks_to_keypoints(result.pose_landmarks[0])
    if len(keypoints) != LANDMARK_COUNT:
        return None

    bbox = _bbox_from_keypoints(keypoints)
    if bbox is None:
        return None

    return keypoints, bbox
