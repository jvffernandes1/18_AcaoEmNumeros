# Ação em Números

Uma plataforma analítica avançada desenvolvida em Python para auxílio na tomada de decisão de investidores. A ferramenta combina projeções matemáticas de rentabilidade (**Backtest**) com o acompanhamento histórico de evolução patrimonial (**Carteira**).

---

## ✨ Funcionalidades Principais

### 📉 Projeção de Investimentos (Backtest)
Simule o crescimento do seu capital baseado em retornos históricos de ativos da B3.
- Cálculo de **Retorno Anualizado** normalizado para 252 dias úteis.
- Simulação de aportes mensais com visualização de montante final projetado.
- Fórmulas matemáticas profissionais renderizadas via **KaTeX**.

### 💼 Gestão de Carteira (Portfolio)
Acompanhe sua evolução patrimonial real com registro histórico.
- Cadastro e exclusão de ativos com data de transação.
- Gráfico dinâmico de evolução para períodos de 30 dias, 3 meses, 1 ano ou tempo total.
- Persistência segura no **MongoDB Atlas**.

### ♿ Acessibilidade e UX
- Modo de **Alto Contraste** nativo para usuários com baixa visão.
- Design responsivo e ícones modernos (Material Symbols).
- Feedback visual de mensagens de sistema (Flashes).

---

## 🚀 Como Rodar Localmente

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/seu-usuario/acao-em-numeros.git
   ```

2. **Configure o Ambiente**:
   - Crie um arquivo `.env` na raiz baseado no `.env.example`.
   - Preencha com sua `MONGODB_URI` e `AWESOME_API_KEY`.

3. **Instale e Execute**:
   ```bash
   pip install -r requirements.txt
   python run.py
   ```
   Acesse: `http://127.0.0.1:5000`

---

## ☁️ Deploy no Render (Manual do Aluno)

A aplicação está configurada para deploy automático no **Render.com**.

1. **Suba suas alterações**: Use o **GitHub Desktop** para fazer o *Push* das alterações para a branch `main`.
2. **Conecte ao Render**:
   - Vá para o [Dashboard do Render](https://dashboard.render.com/).
   - Clique em **New** > **Web Service**.
   - Conecte seu repositório do GitHub.
3. **Configurações**:
   - O Render lerá automaticamente o arquivo `render.yaml` (Blueprint).
   - **IMPORTANTE**: No painel do Render, vá em **Environment** e adicione as variáveis contidas no seu `.env`.

---

## 👥 Equipe de Desenvolvimento

Projeto desenvolvido pelos alunos:
- **Natan Da Silva Almeida** (RA: 23214130)
- **Josias Fernandes De Aguiar Ribeiro** (RA: 1703014)
- **Kleber Henrique Kiraly** (RA: 23220093)
- **Guilherme Lopes Do Carmo Silva** (RA: 23212622)
- **Sergio Norio Toda** (RA: 23214447)
- **Monique Rinaldi Pottes** (RA: 23205314)
- **João Victor Franco Fernandes** (RA: 23204924)
- **Elizabeth Zaffarani** (RA: 23209684)

---

## 🛠️ Tecnologias
- **Backend:** Flask (Python)
- **Frontend:** HTML5, CSS3, JS (Vanilla), Chart.js, KaTeX
- **Banco de Dados:** MongoDB Atlas
- **Dados:** yfinance & Awesome API
- **Infra:** Render + Gunicorn (WSGI)

---
*Ação em Números - Projeto Acadêmico 2026*