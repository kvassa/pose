import httpx

from src.callback import post_callback_error, post_callback_success
from src.extractor import extract_pose

IMAGE_DOWNLOAD_TIMEOUT_S = 30.0


def run_extraction_job(
    reference_id: str, signed_image_url: str, callback_url: str
) -> None:
    try:
        response = httpx.get(
            signed_image_url,
            follow_redirects=True,
            timeout=IMAGE_DOWNLOAD_TIMEOUT_S,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        post_callback_error(
            callback_url, reference_id, f"Failed to download image: {exc}"
        )
        return

    result = extract_pose(response.content)
    if result is None:
        post_callback_error(callback_url, reference_id, "No person detected")
        return

    keypoints, bounding_box = result
    post_callback_success(callback_url, reference_id, keypoints, bounding_box)
