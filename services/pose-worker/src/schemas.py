from pydantic import BaseModel

from src.types import BoundingBox, Keypoint


class ExtractRequest(BaseModel):
    reference_id: str
    signed_image_url: str
    callback_url: str


class CallbackSuccessPayload(BaseModel):
    reference_id: str
    keypoints: list[Keypoint]
    bounding_box: BoundingBox


class CallbackErrorPayload(BaseModel):
    reference_id: str
    error: str
