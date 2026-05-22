from src.extractor import LANDMARK_COUNT, extract_pose


def test_extract_pose_returns_33_keypoints_and_nonzero_bbox(person_image_bytes: bytes) -> None:
    result = extract_pose(person_image_bytes)
    assert result is not None
    keypoints, bbox = result
    assert len(keypoints) == LANDMARK_COUNT
    assert bbox.w > 0.0
    assert bbox.h > 0.0
    assert 0.0 <= bbox.x <= 1.0
    assert 0.0 <= bbox.y <= 1.0
