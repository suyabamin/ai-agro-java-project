# Coding Standards

## General
- Use clear names and consistent formatting.
- Keep functions focused.
- Avoid duplicated business rules.
- Validate untrusted input.
- Handle errors explicitly.
- Add comments for reasoning, not obvious syntax.
- Keep secrets out of source control.

## TypeScript
- Enable strict type checking.
- Avoid `any` unless justified and isolated.
- Keep API types centralized.
- Separate components, hooks, and services.

## Java
- Use package-by-feature or a consistent layered structure.
- Encapsulate domain state.
- Use interfaces where they provide meaningful boundaries.
- Keep controllers thin.
- Use DTOs for API contracts.
- Validate request data.
- Avoid exposing persistence models directly.

## Python
- Use type hints.
- Use Pydantic for request/response validation.
- Keep inference logic separate from route handlers.
- Pin dependencies in a reproducible manner.
- Add tests for preprocessing and API behavior.
