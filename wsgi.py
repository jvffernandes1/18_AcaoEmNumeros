import os
from dotenv import load_dotenv
from app import create_app

# Carregar variáveis de ambiente explicitamente se necessário (opcional no Render)
load_dotenv()

app = create_app()

if __name__ == "__main__":
    app.run()
