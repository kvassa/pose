from fastapi import BackgroundTasks, FastAPI, Response

from src.jobs import run_extraction_job
from src.schemas import ExtractRequest

app = FastAPI(title="pose-worker")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/extract", status_code=202)
def extract(request: ExtractRequest, background_tasks: BackgroundTasks) -> Response:
    background_tasks.add_task(
        run_extraction_job,
        request.reference_id,
        request.signed_image_url,
        request.callback_url,
    )
    return Response(status_code=202)
