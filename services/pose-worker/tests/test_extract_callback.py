from __future__ import annotations

import hashlib
import hmac
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from fastapi.testclient import TestClient

from src.callback import SIGNATURE_HEADER
from src.extractor import LANDMARK_COUNT
from src.main import app
from tests.conftest import PERSON_IMAGE_URL, TEST_CALLBACK_SECRET

REFERENCE_ID = "ref-test-123"


class _CallbackHandler(BaseHTTPRequestHandler):
    received: list[dict] = []

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length)
        body = json.loads(raw_body)
        _CallbackHandler.received.append(
            {
                "body": body,
                "raw_body": raw_body,
                "signature": self.headers.get(SIGNATURE_HEADER),
            }
        )
        self.send_response(200)
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        del format, args


def _start_callback_server() -> tuple[HTTPServer, str]:
    _CallbackHandler.received = []
    server = HTTPServer(("127.0.0.1", 0), _CallbackHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, f"http://{host}:{port}/"


def _expected_signature(raw_body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def test_extract_returns_202_and_posts_callback(pose_model_path) -> None:
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

        assert len(_CallbackHandler.received) == 1
        callback = _CallbackHandler.received[0]
        body = callback["body"]
        assert body["reference_id"] == REFERENCE_ID
        assert len(body["keypoints"]) == LANDMARK_COUNT
        assert body["bounding_box"]["w"] > 0.0
        assert body["bounding_box"]["h"] > 0.0

        assert callback["signature"] is not None
        assert callback["signature"] == _expected_signature(
            callback["raw_body"], TEST_CALLBACK_SECRET
        )
    finally:
        server.shutdown()
