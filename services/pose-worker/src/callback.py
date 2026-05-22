from __future__ import annotations

import hashlib
import hmac
import json
import os

import httpx

from src.types import BoundingBox, Keypoint

CALLBACK_TIMEOUT_S = 30.0
SIGNATURE_HEADER = "X-Signature"


def _callback_secret() -> str:
    secret = os.environ.get("CALLBACK_SECRET")
    if not secret:
        raise RuntimeError("CALLBACK_SECRET environment variable is required")
    return secret


def sign_payload(payload: dict) -> tuple[bytes, str]:
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    digest = hmac.new(
        _callback_secret().encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return body, digest


def _post_callback(callback_url: str, payload: dict) -> None:
    body, signature = sign_payload(payload)
    httpx.post(
        callback_url,
        content=body,
        headers={
            "Content-Type": "application/json",
            SIGNATURE_HEADER: signature,
        },
        timeout=CALLBACK_TIMEOUT_S,
    )


def post_callback_success(
    callback_url: str,
    reference_id: str,
    keypoints: list[Keypoint],
    bounding_box: BoundingBox,
) -> None:
    payload = {
        "reference_id": reference_id,
        "keypoints": [k.model_dump() for k in keypoints],
        "bounding_box": bounding_box.model_dump(),
    }
    _post_callback(callback_url, payload)


def post_callback_error(
    callback_url: str, reference_id: str, error: str
) -> None:
    payload = {"reference_id": reference_id, "error": error}
    _post_callback(callback_url, payload)
