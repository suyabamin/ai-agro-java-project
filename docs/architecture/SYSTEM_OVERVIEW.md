# System Overview

```text
Browser
  |
  v
React + TypeScript
  |
  | HTTPS + Firebase ID token
  v
Spring Boot API
  |             \
  |              \ REST (protected service call)
  v               v
Firebase         FastAPI AI Service
Auth +           |
Firestore        v
                 OpenCV preprocessing
                 ML model inference
  |
  v
External image bucket (through controlled upload/access workflow)
```

## Trust model
The browser is an untrusted client. The backend derives identity from a verified Firebase token and checks permissions against trusted data. AI output is treated as data requiring validation and traceability, not as authorization.
