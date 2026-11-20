import math

from app.core.image_preprocessing import decode_and_preprocess
from app.core.model_registry import ModelRegistry
from app.schemas.inference import AlternativePrediction, InferenceResponse


LIMITATIONS = [
    "Decision-support output only; not a verified agricultural diagnosis.",
    "Model evaluation and field-condition limitations must be reviewed before operational use.",
]


def unavailable_response(registry: ModelRegistry) -> InferenceResponse:
    return InferenceResponse(
        status="MODEL_UNAVAILABLE",
        error_code=registry.error_code or "MODEL_UNAVAILABLE",
        message="Disease inference is unavailable until a trained, evaluated model and its metadata are supplied.",
        limitations=LIMITATIONS,
    )


def run_inference(registry: ModelRegistry, image_bytes: bytes, content_type: str) -> InferenceResponse:
    if not registry.available or registry.metadata is None or registry.adapter is None:
        return unavailable_response(registry)

    decoded = decode_and_preprocess(image_bytes, content_type, registry.metadata)
    tensor = decoded.tensor[None, ...]
    raw_output = registry.adapter.predict(tensor)
    try:
        import numpy as np
        output = np.asarray(raw_output, dtype=np.float64)
        if output.ndim == 2 and output.shape[0] == 1:
            output = output[0]
        if output.ndim != 1 or output.size != len(registry.labels) or not np.isfinite(output).all():
            raise ValueError("Model output does not match registered label mapping")
        if registry.metadata.output_activation == "LOGITS":
            shifted = output - output.max()
            scores = np.exp(shifted) / np.exp(shifted).sum()
        else:
            if (output < 0).any() or (output > 1).any() or not math.isclose(float(output.sum()), 1.0, abs_tol=0.02):
                raise ValueError("Softmax model output must be finite probabilities summing to one")
            scores = output
    except ImportError as exc:
        raise RuntimeError("NumPy is required to validate model output") from exc

    ranked = sorted(enumerate(scores.tolist()), key=lambda row: row[1], reverse=True)
    top_index, top_score = ranked[0]
    top = registry.labels[top_index]
    alternatives = [
        AlternativePrediction(class_id=registry.labels[index]["classId"],
                              label=registry.labels[index]["displayName"], score=score)
        for index, score in ranked[1:3]
    ]
    return InferenceResponse(
        status="COMPLETED",
        model_name=registry.metadata.model_name,
        model_version=registry.metadata.model_version,
        predicted_class=top["displayName"],
        predicted_class_id=top["classId"],
        confidence_score=float(top_score),
        confidence_semantics="Uncalibrated model output score; not a probability of correctness.",
        alternatives=alternatives,
        message="Inference completed using the registered model.",
        limitations=LIMITATIONS + registry.metadata.evaluation.limitations,
    )
