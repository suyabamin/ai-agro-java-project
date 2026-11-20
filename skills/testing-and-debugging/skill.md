# Skill: Testing and Debugging

## Trigger
Use for bug fixes, test implementation, regression checks, and acceptance verification.

## Workflow
1. Reproduce the issue and capture exact environment.
2. Identify expected versus actual behavior.
3. Inspect logs and relevant code.
4. Form a testable root-cause hypothesis.
5. Add a regression test where feasible.
6. Make the smallest safe fix.
7. Run focused tests, then broader tests/builds.
8. Test negative/permission/error paths.
9. Record exact commands and outputs.
10. Update bug tracker and memory.

## Reporting
Use PASS, FAIL, BLOCKED, NOT TESTED. Never infer a test passed because no error was noticed.
