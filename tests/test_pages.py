def test_home_renderiza(client):
    resposta = client.get("/")

    assert resposta.status_code == 200
    assert b"A\xc3\xa7\xc3\xa3o em N\xc3\xbameros" in resposta.data


def test_login_renderiza(client):
    resposta = client.get("/login")

    assert resposta.status_code == 200
    assert b"Entrar na plataforma" in resposta.data


def test_sobre_redireciona_sem_login(client):
    resposta = client.get("/sobre", follow_redirects=False)

    assert resposta.status_code == 302
    assert "/login" in resposta.headers["Location"]


def test_sobre_renderiza_com_login(client):
    client.post(
        "/cadastro",
        data={
            "user_id": "sobre1",
            "nome": "Teste",
            "sobrenome": "Usuario",
            "email": "sobre@example.com",
            "senha": "123456",
        },
        follow_redirects=False,
    )
    client.post(
        "/login",
        data={
            "email": "sobre@example.com",
            "senha": "123456",
        },
        follow_redirects=False,
    )

    resposta = client.get("/sobre")

    assert resposta.status_code == 200
    assert b"Sobre a plataforma" in resposta.data