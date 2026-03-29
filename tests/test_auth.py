def test_cadastro_e_login_fluxo(client):
    resposta_cadastro = client.post(
        "/cadastro",
        data={
            "user_id": "joaovf",
            "nome": "Joao",
            "sobrenome": "Fernandes",
            "email": "joao@email.com",
            "senha": "123456",
        },
        follow_redirects=True,
    )

    assert resposta_cadastro.status_code == 200
    assert b"Cadastro realizado com sucesso" in resposta_cadastro.data

    resposta_login = client.post(
        "/login",
        data={"email": "joao@email.com", "senha": "123456"},
        follow_redirects=True,
    )

    assert resposta_login.status_code == 200
    assert b"Dashboard" in resposta_login.data


def test_dashboard_bloqueado_sem_login(client):
    resposta = client.get("/dashboard", follow_redirects=True)

    assert resposta.status_code == 200
    assert b"Faca login para acessar o dashboard" in resposta.data or b"Fa\xc3\xa7a login para acessar o dashboard" in resposta.data


def test_preferencia_alto_contraste_persistida(client, app):
    client.post(
        "/cadastro",
        data={
            "user_id": "contraste1",
            "nome": "Ana",
            "sobrenome": "Teste",
            "email": "ana@teste.com",
            "senha": "123456",
        },
        follow_redirects=True,
    )
    client.post(
        "/login",
        data={"email": "ana@teste.com", "senha": "123456"},
        follow_redirects=True,
    )

    resposta = client.post(
        "/preferencias/contraste",
        json={"enabled": True},
    )

    assert resposta.status_code == 200
    payload = resposta.get_json()
    assert payload["enabled"] is True

    with app.app_context():
        from app.db import get_collection

        usuario = get_collection("usuarios").find_one({"user_id": "contraste1"})

    assert usuario["alto_contraste"] is True

    resposta_home = client.get("/")
    assert resposta_home.status_code == 200
    assert b'data-contrast="high"' in resposta_home.data


def test_atualizar_dados_na_conta(client, app):
    client.post(
        "/cadastro",
        data={
            "user_id": "conta1",
            "nome": "Maria",
            "sobrenome": "Silva",
            "email": "maria@teste.com",
            "senha": "123456",
        },
        follow_redirects=True,
    )
    client.post(
        "/login",
        data={"email": "maria@teste.com", "senha": "123456"},
        follow_redirects=True,
    )

    resposta = client.post(
        "/conta",
        data={
            "nome": "Maria Clara",
            "sobrenome": "Silva",
            "email": "maria.clara@teste.com",
            "senha": "",
            "alto_contraste": "on",
        },
        follow_redirects=True,
    )

    assert resposta.status_code == 200
    assert b"Dados da conta atualizados com sucesso" in resposta.data

    with app.app_context():
        from app.db import get_collection

        usuario = get_collection("usuarios").find_one({"user_id": "conta1"})

    assert usuario["nome"] == "Maria Clara"
    assert usuario["email"] == "maria.clara@teste.com"
    assert usuario["alto_contraste"] is True