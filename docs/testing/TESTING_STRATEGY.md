# Testing Strategy

## Test levels
- Unit tests: isolated functions, services, validators, and domain logic.
- Integration tests: Firestore adapters, API clients, and service boundaries.
- API tests: status codes, payload validation, auth, and authorization.
- End-to-end tests: complete user workflows.
- Security tests: unauthorized cross-farm/field access and private resource exposure.
- UI tests: responsive behavior, form states, and accessibility basics.
- ML evaluation: held-out data, per-class metrics, leakage checks, and field-condition validation.

## Quality gates
- Tests must be executed, not merely generated.
- Record command, environment, result, and limitations.
- A passing unit test suite does not prove production readiness.
- External services may require emulator/test projects or explicit test credentials.
