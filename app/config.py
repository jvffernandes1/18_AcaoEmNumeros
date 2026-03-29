import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "troque-esta-chave-em-producao")
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "acao_em_numeros")
    AWESOME_API_KEY = os.getenv("AWESOME_API_KEY", "")
    MONGO_MOCK = os.getenv("MONGO_MOCK", "false").lower() == "true"
    MONGO_STRICT_STARTUP = os.getenv("MONGO_STRICT_STARTUP", "false").lower() == "true"
    STOCKS_DATA_DIR = os.getenv(
        "STOCKS_DATA_DIR",
        str(Path(__file__).resolve().parent.parent / "data" / "stocks"),
    )