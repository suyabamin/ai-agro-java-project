# Milestone 6 Performance and Reliability Report

Current run date: 2026-11-18. Exact environment and measurements are in `MASTER_PERFORMANCE_REPORT.md`.

Command from `ai-service`: `.venv/Scripts/python tools/benchmark_m6.py` — exit 0.

| Measurement | Samples | Median | P95 | P99 | Maximum | Failures |
|---|---:|---:|---:|---:|---:|---:|
| Decode/preprocess deterministic synthetic 512×512 RGB PNG (788,404 bytes) | 100 | 1.546 ms | 2.256 ms | 2.533 ms | 2.572 ms | 0 |
| FastAPI MODEL_UNAVAILABLE through TestClient/in-process ASGI, concurrency 8 | 80 | 86.726 ms | 176.141 ms | 181.828 ms | 181.828 ms | 0 |

Environment: Python 3.12.13; Windows 11 build 26300; Intel Core i7-8650U @ 1.90 GHz; 8 logical CPUs; 16 GiB RAM. Deterministic synthetic pixels with seed 20261118; no disease labels/model. Peak traced Python heap 10,914,133 bytes. RSS not measured.

Script warms preprocessing with 5 calls, measures 100 runs and sends 80 no-model API requests with 8 workers. It validates HTTP 200, MODEL_UNAVAILABLE and null prediction/confidence. Per-request exceptions, non-JSON responses and unexpected responses count as failed samples with reasons; none occurred. These local synthetic/in-process measurements are not production capacity or inference performance. No network, Spring, Firebase, trained model, real image, SLO or large-file stress test was measured.
