# Milestone 6 API and Integration Report

Current local API evidence consists of frontend tests (70/70), Spring backend Maven suite (216/216), FastAPI suite (17/17), Firestore Rules emulator tests (26/26 on demo-agroai), and Playwright mock-auth UI workflow (3/3). A no-Firebase production-preview mock-auth guard test passed 1/1. Frontend build passed. Monitoring APIs cover image upload/history, disease availability/analysis, soil telemetry and irrigation plan lifecycle/history. These tests do not establish live Firebase authentication or persistence.

Frontend adds Firebase ID Bearer tokens when configured; development fallback mock tokens are used only by local UI tests. Spring source verifies tokens when configured. FastAPI preserves MODEL_UNAVAILABLE with no model. The emulator tests Rules, not Firebase Admin app persistence. Browser fixtures test UI rendering, not the live integration chain.

NOT TESTED: real Firebase token validation, live Firestore Admin persistence, full authenticated frontend → Spring → FastAPI → Firestore → frontend flow, production storage or real model inference. No live Firebase read/write or deployment occurred.
