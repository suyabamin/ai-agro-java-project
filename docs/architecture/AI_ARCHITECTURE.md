# AI Service Architecture

## Implemented model-ready pipeline
1. Authenticated user submits a field image; Spring Boot verifies active account and field access.
2. Image bytes are validated, safely decoded/re-encoded, and written through provider-neutral `ImageStorage`.
3. Firestore stores metadata and private storage key; bytes are not embedded in Firestore.
4. The backend records `PENDING`, then `PROCESSING`, and sends bytes to FastAPI with a backend-only service key.
5. FastAPI validates image signature/size/dimensions and uses OpenCV to decode, convert BGR to RGB, resize and normalize according to registered metadata.
6. `ModelRegistry` checks `active.json`, metadata, input contract, evaluation declaration, model/label SHA-256, label mapping, and model adapter loading.
7. If no valid evaluated model exists, FastAPI returns `MODEL_UNAVAILABLE`; backend persists that state without class or confidence. If available, the configured adapter runs and output shape/probabilities are checked.
8. Backend persists validated status and model version; the field dashboard queries model availability and displays version/status.

No disease weights are included. The TensorFlow/Keras adapter is an optional integration seam, not a trained or validated project model. The model user will supply remains outside this milestone.

## Current adapter contract
- Registered files: `.keras` and `.h5` only.
- RGB 3-channel dimensions and normalization are declared per model version.
- Output activation must be declared `SOFTMAX` or `LOGITS`; output vector must match labels.
- TensorFlow/Keras loads only when installed; NumPy validates output.
- New frameworks/formats require a versioned inference adapter.

## Dataset and evaluation
Before claiming disease detection:
- Select a dataset with appropriate license and provenance.
- Check crop/disease class coverage and class imbalance.
- Split data to avoid leakage.
- Evaluate precision, recall, F1, confusion matrix, and per-class performance.
- Test images from realistic field conditions.
- Record model version and evaluation date.

## Output
Return model name/version, status, prediction only on actual validated inference, limitations, and an explicitly uncalibrated raw score. `MODEL_UNAVAILABLE` responses have null class and confidence. The frontend displays model availability via the backend proxy.

## Safety and integrity
Do not fabricate predictions. Clearly label demonstration outputs. AI output is decision support and should not replace expert agricultural advice.
