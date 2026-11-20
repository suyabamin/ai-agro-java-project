# Skill: Frontend Development

## Trigger
Use for React, TypeScript, Vite, Tailwind, routing, forms, dashboards, or UI changes.

## Workflow
1. Read `docs/design/DESIGN.md`, `docs/design/DESIGN_SYSTEM.md`, `docs/design/COMPONENT_GUIDELINES.md`, and relevant PRD flows.
2. Inspect current components, routes, state management, and API services.
3. Preserve existing behavior.
4. Use strict TypeScript and typed API contracts.
5. Separate UI, hooks, and service calls.
6. Include loading, empty, error, and success states.
7. Implement responsive and keyboard-accessible behavior.
8. Never treat frontend role checks as security.
9. Add/update tests and run lint/build/test commands.
10. Report actual results and update docs if contracts changed.

## Restrictions
Do not put Firebase Admin credentials or privileged Firestore operations in frontend code. Do not invent API endpoints.
