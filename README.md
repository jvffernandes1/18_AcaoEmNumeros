# Ação em Números

Aplicação web em Python para simulação de investimentos e análise estatística de ações.

## Entregável desta etapa

- Tela inicial explicando o projeto
- Tela de cadastro (ID, senha, e-mail, nome e sobrenome)
- Tela de login
- Dashboard protegido por autenticação (com primeiro bloco funcional)
- Integração com MongoDB
- Base de integração com yfinance e Awesome API
- Testes automatizados com pytest
- Pipeline de CI com GitHub Actions

## Evolução implementada

- Primeiro bloco do dashboard com gráfico real em Chart.js
- Dados de preço histórico via yfinance
- KPI de cotação via Awesome API
- Formulário de simulação com persistência no MongoDB
- Listagem das últimas simulações salvas por usuário

## Stack

- Backend: Flask
- Banco: MongoDB (PyMongo)
- Coleta de dados: yfinance e Awesome API
- Testes: pytest + mongomock

## Como rodar localmente

1. Crie e ative o ambiente virtual Python.
2. Instale dependências:

   ```bash
   pip install -r requirements.txt
   ```

3. Crie o arquivo `.env` a partir de `.env.example`.
4. Execute:

   ```bash
   python run.py
   ```

5. Acesse `http://127.0.0.1:5000`.

## Estrutura principal

```
app/
  static/css/style.css
  templates/
  services/market_data.py
  config.py
  db.py
  routes.py
tests/
.github/workflows/ci.yml
run.py
```

## Observações ss

- As funções de consumo e projeção estão em `app/services/market_data.py`.
- Endpoint do bloco inicial: `/api/dashboard/primeiro-bloco`.
- Endpoint de persistência: `/dashboard/simulacoes`.