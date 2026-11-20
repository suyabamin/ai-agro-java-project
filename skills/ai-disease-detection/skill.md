# Skill: AI Disease Detection

## Trigger
Use for crop image uploads, OpenCV preprocessing, datasets, training, evaluation, and inference.

## Workflow
1. Confirm crop types and disease classes in scope.
2. Research dataset source, license, provenance, and class balance.
3. Define train/validation/test splits and prevent data leakage.
4. Inspect image quality and field-condition differences.
5. Choose preprocessing based on model needs; do not add filters without evaluation.
6. Establish a baseline model before optimization.
7. Evaluate per-class precision, recall, F1, confusion matrix, and relevant robustness.
8. Record model architecture, weights version, dataset version, and metrics.
9. Expose inference through FastAPI with input validation and timeouts.
10. Persist result references and model metadata through Spring Boot.
11. Label untrained/demo models clearly.

## Candidate stack
OpenCV, TensorFlow/Keras, MobileNetV2, NumPy, FastAPI.

## Restrictions
A confidence score is not automatically a calibrated probability. Do not claim medical/agronomic certainty or validated accuracy without evidence.
