# Milestone 5 Performance Report

**Status: NOT TESTED.** No reproducible workload benchmark was run. No latency, percentile, memory, Firestore read-count or concurrency measurement is claimed.

## Environment observed

Windows workspace, Java 21.0.13, Node 26.4.0, Vitest 5.1.0, Python 3.12.13/pytest 8.3.4, Firebase CLI 15.24.0. The Firestore Rules emulator ran locally on port 8085. These are environment details only; they are not benchmark results.

## Workloads

| Workload | Result |
|---|---|
| Farmer dashboard loading | NOT TESTED in browser or with network timing |
| Assignment pagination/history queries | Cursor pagination is implemented with bounded page sizes; latency, read counts and large-list behavior are NOT TESTED |
| Large farm assignment list | NOT TESTED; no reproducible seeded workload |
| Firestore reads | NOT MEASURED |
| Concurrent assignment operations | NOT TESTED against Firestore |
| Backend response percentiles / frontend render | NOT MEASURED |
| Memory usage | NOT MEASURED |

## Bundle warning

`npm.cmd run build` succeeded. Vite produced `frontend/dist/assets/index-cNVNaA1c.js` at 1,009.57 kB minified (290.17 kB gzip) and warned that chunks exceed 500 kB. The app's route structure may allow dynamic imports, but no code splitting was attempted because the task requires measured/necessary remediation and no render benchmark was available.

No warm-up/iterations/dataset apply because no performance benchmark was executed. Pagination and performance acceptance remain open.
