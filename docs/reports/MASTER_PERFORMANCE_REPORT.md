# Master Performance Report

Date: 2026-11-18. All measurements are local development measurements and cannot be generalized to production.

## Environment

- Windows 11 build 26300; Python 3.12.13.
- Intel Core i7-8650U @ 1.90 GHz; 8 logical CPUs; 16 GiB installed RAM.
- 512×512 deterministic synthetic RGB PNG, 788,404 bytes; no real user image, disease label or model.
- Harness: OpenCV preprocessing directly, then FastAPI TestClient in-process ASGI. No network, Spring Boot, Firebase, production storage or trained inference involved.
- 5 warm-up preprocessing calls; 100 measured preprocessing calls; 80 API requests at concurrency 8. Script: `ai-service/tools/benchmark_m6.py`.

## Results

| Measurement | N | Failures | Median ms | P95 ms | P99 ms | Maximum ms |
|---|---:|---:|---:|---:|---:|---:|
| Decode/preprocess RGB | 100 | 0 | 1.546 | 2.256 | 2.533 | 2.572 |
| API model-unavailable response, in-process | 80 | 0 | 86.726 | 176.141 | 181.828 | 181.828 |

Tracemalloc peak Python heap: 10,914,133 bytes across process run; RSS was not measured and Python heap excludes OpenCV/native allocations. Local API results measure the no-model path only, not inference latency. No production performance claim is made.

The benchmark now catches per-sample exceptions and invalid/non-JSON responses, includes failed samples in result accounting, and emits failure reasons. No failures occurred in this run. Reproduce from `ai-service`: `.venv/Scripts/python tools/benchmark_m6.py`.
