# Guia de Contribuição (Equipe de Desenvolvimento)

Projeto acadêmico para acompanhamento e análise de ações.

## 🤝 Fluxo de Trabalho (GitHub Desktop)

1. **Sempre puxe as últimas alterações** antes de começar: Clique em **Fetch origin**.
2. **Commit Incremental**: Faça commits curtos e descritivos (ex: `feat: adiciona gráfico de evolução`).
3. **Padrão de Código**: Mantenha o estilo de codificação limpo e legível.

## 🧪 Testes

Antes de enviar qualquer alteração, garanta que os testes locais estão passando:
```bash
pytest
```

## 🧱 Estrutura de Pastas

- `/app`: Código principal da aplicação.
- `/app/services`: Lógica de coleta de dados e cálculos.
- `/app/templates`: Front-end (Jinja Templates).
- `/tests`: Suíte de testes automatizados.
- `run.py`: Script de inicialização.

## 🚢 Deploy

O deploy é acionado automaticamente pelo **Render.com** quando detecta novos códigos na branch `main`.

---
*Time Ação em Números - Projeto PI3*
