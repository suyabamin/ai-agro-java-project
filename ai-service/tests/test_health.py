from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["service"] == "agroai-ai-service"
    assert "version" in data


def test_v1_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["service"] == "agroai-ai-service"


def test_v1_health_diagnostics():
    response = client.get("/api/v1/health/diagnostics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["environment"] == "development"
    assert data["inference_ready"] is False
    assert data["active_model"] is None
    assert "metadata" in data


def test_openapi_schema_available():
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "AgroAI Inference Service"


def test_cors_preflight_allowed_backend():
    headers = {
        "Origin": "http://localhost:8080",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/api/v1/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8080"
