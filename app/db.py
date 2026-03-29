from flask import current_app


def init_db(app):
    if app.config.get("MONGO_MOCK"):
        import mongomock

        app.mongo_client = mongomock.MongoClient()
        app.mongo_available = True
        app.mongo_startup_error = None
    else:
        from pymongo import MongoClient

        app.mongo_client = MongoClient(
            app.config["MONGODB_URI"],
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=20000,
            maxPoolSize=20,
            minPoolSize=0,
            maxIdleTimeMS=300000,
        )
        app.mongo_available = True
        app.mongo_startup_error = None

        try:
            app.mongo_client.admin.command("ping")
            _ensure_indexes(app)
        except Exception as exc:
            app.mongo_available = False
            app.mongo_startup_error = str(exc)
            if app.config.get("MONGO_STRICT_STARTUP"):
                raise

    if app.config.get("MONGO_MOCK"):
        _ensure_indexes(app)


def get_collection(name: str):
    db = current_app.mongo_client[current_app.config["MONGODB_DB_NAME"]]
    return db[name]


def _ensure_indexes(app):
    db = app.mongo_client[app.config["MONGODB_DB_NAME"]]
    db["usuarios"].create_index("user_id", unique=True)
    db["usuarios"].create_index("email", unique=True)
    db["simulacoes"].create_index([("user_id", -1), ("criado_em", -1)])