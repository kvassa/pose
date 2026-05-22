from pydantic import BaseModel


class Keypoint(BaseModel):
    x: float
    y: float
    z: float | None = None
    visibility: float


class BoundingBox(BaseModel):
    x: float
    y: float
    w: float
    h: float
