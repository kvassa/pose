from fastapi.testclient import TestClient

from src.main import app
from tests.conftest import PERSON_IMAGE_URL
from tests.test_extract_callback import REFERENCE_ID, _start_callback_server


def test_post_extract_returns_202(pose_model_path) -> None:
    del pose_model_path
    server, callback_url = _start_callback_server()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/extract",
                json={
                    "reference_id": REFERENCE_ID,
                    "signed_image_url": PERSON_IMAGE_URL,
                    "callback_url": callback_url,
                },
            )
            assert response.status_code == 202
    finally:
        server.shutdown()
