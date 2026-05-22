from __future__ import annotations

from pathlib import Path

import httpx
import pytest

TEST_CALLBACK_SECRET = "test-callback-secret"


@pytest.fixture(autouse=True)
def callback_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CALLBACK_SECRET", TEST_CALLBACK_SECRET)

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "pose_landmarker_heavy.task"
PERSON_IMAGE_PATH = ROOT / "tests" / "fixtures" / "person.jpg"

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
)
# Sample image from MediaPipe pose landmarker notebook (Pixabay, person visible).
PERSON_IMAGE_URL = (
    "https://cdn.pixabay.com/photo/2019/03/12/20/39/girl-4051811_960_720.jpg"
)


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    response = httpx.get(url, follow_redirects=True, timeout=120.0)
    response.raise_for_status()
    dest.write_bytes(response.content)


@pytest.fixture(scope="session")
def pose_model_path() -> Path:
    if not MODEL_PATH.is_file():
        _download(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


@pytest.fixture(scope="session")
def person_image_bytes(pose_model_path: Path) -> bytes:
    del pose_model_path
    if not PERSON_IMAGE_PATH.is_file():
        _download(PERSON_IMAGE_URL, PERSON_IMAGE_PATH)
    return PERSON_IMAGE_PATH.read_bytes()
