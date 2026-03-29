import pytest

from app import create_app


@pytest.fixture
def app():
    flask_app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "MONGO_MOCK": True,
            "MONGODB_DB_NAME": "acao_em_numeros_test",
        }
    )
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()