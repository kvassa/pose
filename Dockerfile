# Railway: leave Root Directory EMPTY (repo root), Dockerfile path = Dockerfile
# Alternative: Root Directory = services/pose-worker, Dockerfile path = Dockerfile (use that folder's Dockerfile instead)

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/pose-worker/pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir \
    "fastapi==0.115.6" \
    "uvicorn[standard]==0.34.0" \
    "mediapipe==0.10.21" \
    "pillow==11.1.0" \
    "httpx==0.28.1" \
    "pydantic==2.10.6"

COPY services/pose-worker/src ./src

RUN mkdir -p models && python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task', 'models/pose_landmarker_heavy.task')"

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
