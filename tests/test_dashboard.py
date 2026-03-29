from app.db import get_collection


def _login(client):
    client.post(
        "/cadastro",
        data={
            "user_id": "dashuser",
            "nome": "Dash",
            "sobrenome": "User",
            "email": "dash@email.com",
            "senha": "123456",
        },
        follow_redirects=True,
    )
    client.post(
        "/login",
        data={"email": "dash@email.com", "senha": "123456"},
        follow_redirects=True,
    )


def test_api_primeiro_bloco_retorna_dados(client, app, monkeypatch):
    _login(client)

    def fake_historico(ticker, period):
        return [
            {"data": "2026-01-01", "fechamento": 10.0, "volume": 1000},
            {"data": "2026-01-02", "fechamento": 10.5, "volume": 1200},
        ]

    def fake_awesome(par, api_key):
        return {
            "coletado_em": "2026-01-02T00:00:00Z",
            "dados": {"USDBRL": {"code": "USD", "codein": "BRL", "bid": "5.22", "pctChange": "0.50"}},
        }

    monkeypatch.setattr("app.routes.market_data.obter_historico_acao", fake_historico)
    monkeypatch.setattr("app.routes.market_data.obter_cotacoes_awesome", fake_awesome)

    resposta = client.get("/api/dashboard/primeiro-bloco?ticker=PETR4.SA&period=6mo&par=USDBRL")

    assert resposta.status_code == 200
    payload = resposta.get_json()
    assert payload["ticker"] == "PETR4.SA"
    assert len(payload["historico"]) == 2
    assert payload["awesome"]["dados"]["USDBRL"]["bid"] == "5.22"


def test_api_buscar_tickers_retorna_itens(client, monkeypatch):
    _login(client)

    monkeypatch.setattr(
        "app.routes.market_data.buscar_tickers",
        lambda query, limit=20, stocks_dir=None: [
            {"symbol": "ITSA4.SA", "name": "Itausa PN", "exchange": "B3", "type": "EQUITY"},
            {"symbol": "ITSA3.SA", "name": "Itausa ON", "exchange": "B3", "type": "EQUITY"},
        ],
    )

    resposta = client.get("/api/tickers/search?q=ITSA4")
    assert resposta.status_code == 200

    payload = resposta.get_json()
    assert payload["items"][0]["symbol"] == "ITSA4.SA"
    assert len(payload["items"]) == 2


def test_api_primeiro_bloco_sem_awesome_ainda_retorna_historico(client, monkeypatch):
    _login(client)

    monkeypatch.setattr(
        "app.routes.market_data.obter_historico_acao",
        lambda ticker, period: [
            {"data": "2026-01-01", "fechamento": 10.0, "volume": 1000},
            {"data": "2026-01-02", "fechamento": 10.3, "volume": 1100},
        ],
    )

    def awesome_falha(par, api_key):
        raise RuntimeError("awesome indisponivel")

    monkeypatch.setattr("app.routes.market_data.obter_cotacoes_awesome", awesome_falha)

    resposta = client.get("/api/dashboard/primeiro-bloco?ticker=PETR4.SA&period=6mo&par=USDBRL")
    assert resposta.status_code == 200

    payload = resposta.get_json()
    assert len(payload["historico"]) == 2
    assert payload["awesome"]["dados"] == {}
    assert payload["aviso"] is not None


def test_simulacao_persistida_no_mongo(client, app, monkeypatch):
    _login(client)

    monkeypatch.setattr(
        "app.routes.market_data.obter_historico_acao",
        lambda ticker, period: [
            {"data": "2026-01-01", "fechamento": 10.0, "volume": 1000},
            {"data": "2026-01-02", "fechamento": 11.0, "volume": 1000},
        ],
    )

    resposta = client.post(
        "/dashboard/simulacoes",
        data={
            "ticker": "PETR4.SA",
            "period": "6mo",
            "aporte_inicial": "1000",
            "aporte_mensal": "200",
            "meses": "12",
        },
        follow_redirects=True,
    )

    assert resposta.status_code == 200
    assert b"Simulacao salva no banco com sucesso" in resposta.data or b"Simula\xc3\xa7\xc3\xa3o salva no banco com sucesso" in resposta.data

    with app.app_context():
        simulacoes = list(get_collection("simulacoes").find({"user_id": "dashuser"}))

    assert len(simulacoes) == 1
    assert simulacoes[0]["ticker"] == "PETR4.SA"
    assert simulacoes[0]["valor_projetado"] > 0


def test_excluir_simulacao_salva(client, app, monkeypatch):
    _login(client)

    monkeypatch.setattr(
        "app.routes.market_data.obter_historico_acao",
        lambda ticker, period: [
            {"data": "2026-01-01", "fechamento": 10.0, "volume": 1000},
            {"data": "2026-01-02", "fechamento": 11.0, "volume": 1000},
        ],
    )

    client.post(
        "/dashboard/simulacoes",
        data={
            "ticker": "PETR4.SA",
            "period": "6mo",
            "aporte_inicial": "1000",
            "aporte_mensal": "200",
            "meses": "12",
        },
        follow_redirects=True,
    )

    with app.app_context():
        simulacao = get_collection("simulacoes").find_one({"user_id": "dashuser"})

    resposta = client.post(
        f"/dashboard/simulacoes/{simulacao['_id']}/excluir",
        follow_redirects=True,
    )

    assert resposta.status_code == 200
    assert b"Simulacao removida com sucesso" in resposta.data or b"Simula\xc3\xa7\xc3\xa3o removida com sucesso" in resposta.data

    with app.app_context():
        restantes = list(get_collection("simulacoes").find({"user_id": "dashuser"}))

    assert len(restantes) == 0