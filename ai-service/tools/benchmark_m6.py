"""Reproducible local benchmark for preprocessing and the no-model API path.

Run from ai-service with: .venv/Scripts/python tools/benchmark_m6.py
This measures TestClient/ASGI latency, not deployed network or Firebase latency.
"""

from concurrent.futures import ThreadPoolExecutor
import json
import os
import platform
import statistics
import sys
import tracemalloc
import time
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.image_preprocessing import decode_and_preprocess
from app.main import app
from app.api.v1.endpoints import inference


def percentile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, int(np.ceil(pct * len(ordered))) - 1))]


def summary(values: list[float], failures: int = 0) -> dict[str, float | int]:
    return {
        "requests": len(values),
        "failures": failures,
        "failure_rate_percent": round(100 * failures / max(1, len(values)), 2),
        "median_ms": round(statistics.median(values), 3),
        "p95_ms": round(percentile(values, 0.95), 3),
        "p99_ms": round(percentile(values, 0.99), 3),
        "max_ms": round(max(values), 3),
    }


def main() -> None:
    tracemalloc.start()
    settings.AI_SERVICE_KEY = "local-benchmark-key"
    inference.get_model_registry.cache_clear()

    rng = np.random.default_rng(20261118)
    image = rng.integers(0, 256, (512, 512, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise RuntimeError("Could not encode synthetic benchmark image")
    image_bytes = encoded.tobytes()

    for _ in range(5):
        decode_and_preprocess(image_bytes, "image/png")
    preprocess_times = []
    for _ in range(100):
        started = time.perf_counter()
        decode_and_preprocess(image_bytes, "image/png")
        preprocess_times.append((time.perf_counter() - started) * 1000)

    def request_once(_: int) -> tuple[float, bool, str | None]:
        started = time.perf_counter()
        try:
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/inference/disease",
                    content=image_bytes,
                    headers={"X-AI-Service-Key": settings.AI_SERVICE_KEY, "Content-Type": "image/png"},
                )
            elapsed = (time.perf_counter() - started) * 1000
            try:
                body = response.json()
            except ValueError:
                return elapsed, False, f"non-JSON response (HTTP {response.status_code})"
            valid = (response.status_code == 200 and body.get("status") == "MODEL_UNAVAILABLE"
                     and body.get("predicted_class") is None and body.get("confidence_score") is None)
            reason = None if valid else f"unexpected response (HTTP {response.status_code}, status={body.get('status')!r})"
            return elapsed, valid, reason
        except Exception as exc:  # keep a failed sample in the measured result instead of aborting the run
            elapsed = (time.perf_counter() - started) * 1000
            return elapsed, False, f"{type(exc).__name__}: {exc}"

    request_samples = 80
    concurrency = 8
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(request_once, range(request_samples)))
    api_times = [elapsed for elapsed, _, _ in results]
    failures = sum(not valid for _, valid, _ in results)
    failure_reasons = [reason for _, valid, reason in results if not valid]

    _, peak_python_heap_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    report = {
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "logical_cpus": os.cpu_count(),
            "dataset": "one deterministic synthetic 512x512 RGB PNG; no disease labels or model",
            "model_status": "MODEL_UNAVAILABLE",
            "api_harness": "FastAPI TestClient, in-process ASGI; no network/Firebase/backend",
        },
        "image_bytes": len(image_bytes),
        "preprocessing_decode_rgb_100_samples": summary(preprocess_times),
        "model_unavailable_api_80_requests_concurrency_8": summary(api_times, failures),
        "failure_reasons": failure_reasons,
        "peak_python_traced_heap_bytes": peak_python_heap_bytes,
        "process_rss": "NOT MEASURED (Python heap excludes OpenCV/native allocations)",
    }
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
