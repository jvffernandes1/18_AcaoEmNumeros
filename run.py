import os

from app import create_app


app = create_app()


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))

    # O reloader pode encerrar o processo pai em alguns terminais integrados,
    # gerando erros de conexão ao navegar entre páginas.
    app.run(debug=debug, host=host, port=port, use_reloader=False)