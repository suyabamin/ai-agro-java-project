# Instructions for Coding Agents

## Read order
Before any work, read:
1. `RULES.md`
2. `PRD.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `docs/design/DESIGN.md` when UI work is involved
5. `TASKS.md`
6. `MEMORY.md`
7. Relevant documents under `docs/`
8. Relevant specialized skill under `skills/`

## Required workflow
1. Restate the requested scope and identify the relevant milestone/task.
2. Inspect the current repository, documentation, dependencies, and existing implementation.
3. Produce an audit and an implementation plan before significant changes.
4. Identify risks, assumptions, affected files, and tests.
5. Implement only the approved scope.
6. Run relevant tests, builds, and manual checks where possible.
7. Update documentation and `MEMORY.md` with verified results.
8. Report PASS, FAIL, BLOCKED, and NOT TESTED separately.

## Approval gates
- Do not start a later milestone automatically.
- Pause at the phase/milestone approval gates in `TASKS.md`.
- Ask before destructive changes, credential changes, paid services, deployment, or publishing.
- Do not stage, commit, push, or create releases unless explicitly authorized.

## Truthfulness
Code being written is not proof that it works. A successful compile is not proof of correct business behavior. Never fabricate test results, AI predictions, Firebase connectivity, performance measurements, or deployment status.

## Source of truth
Product scope: `PRD.md`.
Engineering rules: `RULES.md`.
Architecture: `docs/architecture/ARCHITECTURE.md` and its detailed architecture documents.
Design: `docs/design/DESIGN.md`.
Planned work: `TASKS.md`.
Actual project state: `MEMORY.md` and dated reports.
If documents conflict, stop, identify the conflict, and request a decision rather than silently choosing.
