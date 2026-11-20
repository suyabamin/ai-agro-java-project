from dataclasses import dataclass

from app.core.config import settings


class ImageValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class PreprocessorUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class DecodedImage:
    tensor: object
    width: int
    height: int
    content_type: str


def _sniff_format(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    raise ImageValidationError("UNSUPPORTED_IMAGE", "Only valid PNG and JPEG images are accepted")


def decode_and_preprocess(data: bytes, declared_content_type: str, metadata=None) -> DecodedImage:
    if not data:
        raise ImageValidationError("EMPTY_IMAGE", "Image file is empty")
    if len(data) > settings.MAX_IMAGE_BYTES:
        raise ImageValidationError("IMAGE_TOO_LARGE", "Image exceeds the configured size limit")

    actual_type = _sniff_format(data)
    declared = (declared_content_type or "").split(";")[0].strip().lower()
    if declared and declared != actual_type:
        raise ImageValidationError("CONTENT_TYPE_MISMATCH", "Declared content type does not match image bytes")

    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise PreprocessorUnavailable("OpenCV preprocessing dependency is not installed") from exc

    encoded = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise ImageValidationError("CORRUPTED_IMAGE", "Image bytes could not be decoded")
    height, width = image.shape[:2]
    if (min(width, height) < settings.MIN_IMAGE_SIDE or
            max(width, height) > settings.MAX_IMAGE_SIDE or
            width * height > settings.MAX_IMAGE_PIXELS):
        raise ImageValidationError("INVALID_IMAGE_DIMENSIONS", "Image dimensions are outside configured limits")

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    if metadata is not None:
        image = cv2.resize(image, (metadata.input.width, metadata.input.height), interpolation=cv2.INTER_AREA)
        tensor = image.astype(np.float32)
        if metadata.input.normalization == "ZERO_ONE":
            tensor = tensor / 255.0
        elif metadata.input.normalization == "MINUS_ONE_TO_ONE":
            tensor = (tensor / 127.5) - 1.0
        elif metadata.input.normalization == "MEAN_STD":
            mean = np.asarray(metadata.input.mean, dtype=np.float32).reshape((1, 1, 3))
            std = np.asarray(metadata.input.std, dtype=np.float32).reshape((1, 1, 3))
            tensor = (tensor - mean) / std
    else:
        tensor = image
    return DecodedImage(tensor=tensor, width=width, height=height, content_type=actual_type)
