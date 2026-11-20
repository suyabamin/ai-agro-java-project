# Component Guidelines

## Component design
- Build reusable components around stable responsibilities.
- Keep business logic in hooks/services or backend, not visual components.
- Prefer composition over deeply nested conditional components.
- Define typed props and explicit variants.
- Keep accessibility semantics built in.

## Forms
- Labels must be visible and associated with controls.
- Show validation near the relevant field.
- Preserve user input after recoverable errors.
- Indicate required fields.
- Prevent duplicate submissions.

## Data views
- Provide loading, empty, error, and populated states.
- Paginate large datasets.
- Show units and timestamps.
- Avoid misleading charts or unlabeled metrics.

## Actions
- Confirm destructive actions.
- Explain permission errors.
- Disable controls only when the reason is clear.
