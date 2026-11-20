# AgroAI – AI Model Integration Guide

> [!NOTE]
> This guide is intended for the project owner or machine learning engineer who will connect a trained agricultural disease classification model to the AgroAI platform.

---

## 1. Architectural Design for Model Decoupling

AgroAI adheres to strict architectural isolation between the business logic backend and the machine learning model:
- **Spring Boot Backend:** Manages crop image upload lifecycle, image storage metadata, tenancy security, authorization, analysis history, and status polling (`PENDING → PROCESSING → COMPLETED / FAILED`).
- **FastAPI AI Service (`ai-service/`):** Acts as the model server. It receives image bytes or paths, runs validation and preprocessing, invokes the inference pipeline, and returns a strictly typed prediction payload.
- **Fail-Closed Fallback:** When no model is configured or loaded, the AI service returns HTTP 200 with `status: "MODEL_UNAVAILABLE"` and `available: false`. The frontend displays an honest indicator to farmers and owners. Non-AI workflows remain fully functional.

---

## 2. Model Contract & Interface

The Python AI service defines the inference boundary in `ai-service/app/services/disease_detector.py` and `ai-service/app/schemas/analysis.py`.

### 2.1 Standard Analysis Output Schema
When an inference is performed, the response must conform to:
```json
{
  "disease_name": "Late Blight",
  "confidence": 0.942,
  "status": "COMPLETED",
  "recommendations": [
    "Apply copper-based fungicide immediately.",
    "Ensure adequate spacing to reduce canopy humidity."
  ],
  "model_metadata": {
    "model_name": "AgroAI-CropDisease-ResNet50",
    "model_version": "1.0.0",
    "trained_dataset": "Bangladesh-Crop-Pathology-v2",
    "inference_latency_ms": 142
  }
}
```

### 2.2 Model Unavailable State (Current Baseline)
When `is_model_loaded()` evaluates to `False`:
```json
{
  "disease_name": null,
  "confidence": null,
  "status": "MODEL_UNAVAILABLE",
  "message": "A trained model must be supplied before disease inference is available.",
  "recommendations": []
}
```

---

## 3. How to Connect a Genuine Model

### Step 1: Place Model Weights / Artifacts
Place your model weights (e.g., PyTorch `.pt`, TensorFlow `.onnx`, or HuggingFace checkpoint) into:
```
ai-service/app/models/weights/
```
*(Ensure large binary weight files are downloaded via secure cloud storage or Git LFS, never committed to standard Git history).*

### Step 2: Implement Inference in `disease_detector.py`
In `ai-service/app/services/disease_detector.py`:
1. Update `load_model()`:
   ```python
   def load_model():
       # Load model weights onto PyTorch or ONNX Runtime session
       # Set model to eval mode
   ```
2. Update `predict(image_bytes: bytes) -> DiseasePrediction`:
   - Preprocess input image using OpenCV/Torchvision (resize, normalize, tensor conversion).
   - Run forward pass.
   - Calculate softmax probabilities and map top class index to target pathogen name.
   - Return populated `DiseasePrediction` with genuine confidence scores.

### Step 3: Configure Environment Variables
Set the model configuration in `.env`:
```env
MODEL_WEIGHTS_PATH=/app/models/weights/best_crop_model.onnx
MODEL_MIN_CONFIDENCE_THRESHOLD=0.65
```

### Step 4: Verification
1. Run AI service unit tests:
   ```bash
   cd ai-service
   pytest
   ```
2. Check readiness endpoint:
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8000/api/v1/availability
   ```
   Availability should return `available: true`.

3. Execute end-to-end image upload test from frontend or via Spring Boot integration tests.
