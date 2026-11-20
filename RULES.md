# Project Rules

These rules apply to developers and coding agents.

## Scope and preservation
1. Read the relevant documentation before coding.
2. Audit existing files and behavior before modifying them.
3. Preserve working features unless an approved requirement says otherwise.
4. Do not replace the project with a new scaffold when a working implementation exists.
5. Implement only the approved task and its necessary dependencies.
6. Do not silently change product requirements or architectural decisions.

## Engineering quality
7. Keep controllers thin; put business logic in services/domain components.
8. Validate all external input.
9. Use clear names, small cohesive methods, and meaningful abstractions.
10. Avoid unnecessary dependencies and premature abstractions.
11. Keep frontend presentation separate from API and business logic.
12. Use Firestore-aware document design; do not assume SQL joins or transactions across arbitrary documents.
13. Handle pagination, retries, timeouts, and external service failures deliberately.
14. Add tests for new behavior and regression tests for bug fixes.

## Security and privacy
15. Never commit secrets, `.env` files, service-account keys, private keys, or tokens.
16. Never expose Firebase Admin credentials in frontend code.
17. Verify Firebase ID tokens on trusted backend routes.
18. Enforce farm membership and field assignment permissions server-side.
19. Never trust a client-supplied owner ID, farmer ID, or permission claim without verification.
20. Do not log passwords, tokens, private messages, or sensitive credentials.
21. Use least-privilege access and review Firestore Security Rules.
22. Do not expose private farms, applications, or conversations publicly.

## AI integrity
23. Never fabricate model outputs or confidence scores.
24. Clearly label mock/demo outputs.
25. Do not claim accuracy without evaluation evidence.
26. Store model name/version and source submission references with results.
27. Treat AI output as decision support, not a guaranteed diagnosis.

## Workflow and reporting
28. Work in meaningful milestone phases with approval gates.
29. Run tests and builds after changes.
30. Report exact commands and actual results.
31. Distinguish PASS, FAIL, BLOCKED, and NOT TESTED.
32. Update relevant docs, `TASKS.md`, and `MEMORY.md`.
33. Do not claim deployment, integration, or manual testing unless performed.
34. Do not stage, commit, push, publish, or deploy without explicit approval.
35. Ask before destructive changes, paid subscriptions, or irreversible actions.
