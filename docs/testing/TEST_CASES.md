# Initial Test Case Catalogue

| ID | Scenario | Expected result |
|---|---|---|
| T-001 | Frontend starts | Dev server starts without fatal errors |
| T-002 | Backend health | Returns healthy application status |
| T-003 | AI health | Returns accurate service status |
| T-004 | Missing Firebase credentials | Safe diagnostic; no secret leakage |
| T-005 | Invalid Firebase token | Protected endpoint returns 401 |
| T-006 | Valid user, wrong farm | Access denied |
| T-007 | Farmer opens unassigned field | Access denied |
| T-008 | Job approved | No automatic field assignment |
| T-009 | Multiple assignments | Supported and independently traceable |
| T-010 | AI inference failure | Submission becomes FAILED |
| T-011 | AI result persistence | Result references source submission and field |
| T-012 | Public farm disabled | Farm absent from public discovery |

Add detailed preconditions, test data, steps, and evidence as features are implemented.
