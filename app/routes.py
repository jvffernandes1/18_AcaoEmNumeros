from datetime import UTC, datetime

from bson import ObjectId
from bson.errors import InvalidId
from flask import (
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from pymongo.errors import PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash

from .db import get_collection
from .services import market_data


def register_routes(app):
    def usuario_logado():
        return session.get("usuario")

    def carregar_usuario_sessao(user_id: str):
        usuario = get_collection("usuarios").find_one({"user_id": user_id})
        if not usuario:
            return None

        return {
            "user_id": usuario["user_id"],
            "nome": usuario["nome"],
            "sobrenome": usuario["sobrenome"],
            "email": usuario["email"],
            "alto_contraste": bool(usuario.get("alto_contraste", False)),
        }

    @app.before_request
    def sincronizar_usuario_em_sessao():
        if not request.endpoint or request.endpoint in ["static", "api_primeiro_bloco_backtest", "api_buscar_tickers", "api_carteira_evolucao"]:
            return

        usuario = session.get("usuario")
        if not usuario:
            return

        try:
            atualizado = carregar_usuario_sessao(usuario.get("user_id", ""))
            if atualizado:
                session["usuario"] = atualizado
            else:
                session.pop("usuario", None)
        except Exception:
            return

    @app.get("/")
    def home():
        return render_template("home.html")

    @app.route("/cadastro", methods=["GET", "POST"])
    def cadastro():
        if request.method == "POST":
            user_id = request.form.get("user_id", "").strip()
            nome = request.form.get("nome", "").strip()
            sobrenome = request.form.get("sobrenome", "").strip()
            email = request.form.get("email", "").strip().lower()
            senha = request.form.get("senha", "")

            if not all([user_id, nome, sobrenome, email, senha]):
                flash("Preencha todos os campos obrigatórios.", "error")
                return render_template("register.html")

            usuarios = get_collection("usuarios")

            try:
                if usuarios.find_one({"$or": [{"user_id": user_id}, {"email": email}]}):
                    flash("ID de usuário ou e-mail já cadastrado.", "error")
                    return render_template("register.html")

                usuarios.insert_one(
                    {
                        "user_id": user_id,
                        "nome": nome,
                        "sobrenome": sobrenome,
                        "email": email,
                        "senha_hash": generate_password_hash(senha),
                        "alto_contraste": False,
                    }
                )
            except PyMongoError:
                flash("Falha ao conectar no banco de dados.", "error")
                return render_template("register.html")

            flash("Cadastro realizado com sucesso. Faça seu login.", "success")
            return redirect(url_for("login"))

        return render_template("register.html")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            senha = request.form.get("senha", "")

            if not email or not senha:
                flash("Informe e-mail e senha.", "error")
                return render_template("login.html")

            usuarios = get_collection("usuarios")

            try:
                usuario = usuarios.find_one({"email": email})
            except PyMongoError:
                flash("Falha ao conectar no banco de dados.", "error")
                return render_template("login.html")

            if not usuario or not check_password_hash(usuario["senha_hash"], senha):
                flash("Credenciais inválidas.", "error")
                return render_template("login.html")

            session["usuario"] = carregar_usuario_sessao(usuario["user_id"])
            return redirect(url_for("backtest"))

        return render_template("login.html")

    @app.get("/logout")
    def logout():
        session.pop("usuario", None)
        flash("Sessão encerrada.", "success")
        return redirect(url_for("home"))

    @app.get("/backtest")
    def backtest():
        usuario = usuario_logado()
        if not usuario:
            flash("Faça login para acessar o backtest.", "error")
            return redirect(url_for("login"))

        simulacoes = []
        try:
            simulacoes_cursor = (
                get_collection("simulacoes")
                .find({"user_id": usuario["user_id"]})
                .sort("criado_em", -1)
                .limit(10)
            )
            simulacoes = list(simulacoes_cursor)
        except PyMongoError:
            flash("Não foi possível carregar as simulações salvas.", "error")

        return render_template("backtest.html", usuario=usuario, simulacoes=simulacoes)

    @app.get("/sobre")
    def sobre():
        usuario = usuario_logado()
        if not usuario:
            flash("Faça login para acessar a página Sobre.", "error")
            return redirect(url_for("login"))

        return render_template("sobre.html", usuario=usuario)

    @app.post("/preferencias/contraste")
    def salvar_preferencia_contraste():
        usuario = usuario_logado()
        if not usuario:
            return jsonify({"erro": "Autenticação necessária."}), 401

        payload = request.get_json(silent=True) or {}
        enabled = bool(payload.get("enabled", False))

        try:
            get_collection("usuarios").update_one(
                {"user_id": usuario["user_id"]},
                {"$set": {"alto_contraste": enabled}},
            )
        except PyMongoError:
            return jsonify({"erro": "Falha ao salvar preferência."}), 500

        usuario["alto_contraste"] = enabled
        session["usuario"] = usuario

        return jsonify({"ok": True, "enabled": enabled})

    @app.get("/api/backtest/primeiro-bloco")
    def api_primeiro_bloco_backtest():
        if not usuario_logado():
            return jsonify({"erro": "Autenticação necessária."}), 401

        ticker = request.args.get("ticker", "PETR4.SA").strip().upper()
        period = request.args.get("period", "6mo").strip().lower()
        par_awesome = request.args.get("par", "USDBRL").strip().upper()

        periodos_permitidos = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
        if period not in periodos_permitidos:
            return jsonify({"erro": "Período inválido."}), 400

        try:
            historico = market_data.obter_historico_acao(ticker, period)
            if not historico:
                return jsonify({"erro": "Sem dados para o ticker informado."}), 404
        except Exception:
            return jsonify({"erro": "Falha ao buscar histórico do ativo."}), 502

        cotacoes_awesome = {"coletado_em": None, "dados": {}}
        aviso = None
        try:
            cotacoes_awesome = market_data.obter_cotacoes_awesome(
                par_awesome,
                app.config.get("AWESOME_API_KEY", ""),
            )
        except Exception:
            aviso = "Não foi possível carregar a cotação da Awesome API no momento."

        indicadores = market_data.calcular_indicadores_tecnicos(historico)

        return jsonify(
            {
                "ticker": ticker,
                "period": period,
                "historico": historico,
                "awesome": cotacoes_awesome,
                "indicadores": indicadores,
                "aviso": aviso,
            }
        )

    @app.get("/api/tickers/search")
    def api_buscar_tickers():
        if not usuario_logado():
            return jsonify({"erro": "Autenticação necessária."}), 401

        termo = request.args.get("q", "").strip()
        if len(termo) < 1:
            return jsonify({"items": []})

        try:
            items = market_data.buscar_tickers(
                termo,
                limit=20,
                stocks_dir=app.config.get("STOCKS_DATA_DIR"),
            )
        except Exception:
            return jsonify({"erro": "Falha ao buscar tickers."}), 502

        return jsonify({"items": items})

    @app.post("/backtest/simulacoes")
    def salvar_simulacao():
        usuario = usuario_logado()
        if not usuario:
            flash("Faça login para salvar simulações.", "error")
            return redirect(url_for("login"))

        ticker = request.form.get("ticker", "PETR4.SA").strip().upper()
        period = request.form.get("period", "6mo").strip().lower()

        try:
            aporte_inicial = float(request.form.get("aporte_inicial", "0"))
            aporte_mensal = float(request.form.get("aporte_mensal", "0"))
            meses = int(request.form.get("meses", "0"))
        except ValueError:
            flash("Informe valores numéricos válidos para a simulação.", "error")
            return redirect(url_for("backtest"))

        if aporte_inicial < 0 or aporte_mensal < 0 or meses <= 0:
            flash("Os valores da simulação são inválidos.", "error")
            return redirect(url_for("backtest"))

        try:
            historico = market_data.obter_historico_acao(ticker, period)
            if len(historico) < 2:
                flash("Dados insuficientes para simular este ticker.", "error")
                return redirect(url_for("backtest"))

            retorno_anualizado = market_data.calcular_retorno_anualizado(historico)
            valor_projetado = market_data.projetar_valor_futuro(
                aporte_inicial,
                aporte_mensal,
                meses,
                retorno_anualizado,
            )

            get_collection("simulacoes").insert_one(
                {
                    "user_id": usuario["user_id"],
                    "email": usuario["email"],
                    "ticker": ticker,
                    "period": period,
                    "aporte_inicial": aporte_inicial,
                    "aporte_mensal": aporte_mensal,
                    "meses": meses,
                    "retorno_anualizado": retorno_anualizado,
                    "valor_projetado": valor_projetado,
                    "criado_em": datetime.now(UTC),
                }
            )
        except PyMongoError:
            flash("Erro de persistência ao salvar simulação.", "error")
            return redirect(url_for("backtest"))
        except Exception:
            flash("Falha ao calcular a simulação com dados de mercado.", "error")
            return redirect(url_for("backtest"))

        flash("Simulação salva no banco com sucesso.", "success")
        return redirect(url_for("backtest"))

    @app.post("/backtest/simulacoes/<simulacao_id>/excluir")
    def excluir_simulacao(simulacao_id: str):
        usuario = usuario_logado()
        if not usuario:
            flash("Faça login para excluir simulações.", "error")
            return redirect(url_for("login"))

        try:
            object_id = ObjectId(simulacao_id)
        except InvalidId:
            flash("Simulação inválida para exclusão.", "error")
            return redirect(url_for("backtest"))

        try:
            resultado = get_collection("simulacoes").delete_one(
                {
                    "_id": object_id,
                    "user_id": usuario["user_id"],
                }
            )
        except PyMongoError:
            flash("Erro de persistência ao excluir simulação.", "error")
            return redirect(url_for("backtest"))

        if resultado.deleted_count:
            flash("Simulação removida com sucesso.", "success")
        else:
            flash("Simulação não encontrada.", "error")

        return redirect(url_for("backtest"))

    @app.route("/conta", methods=["GET", "POST"], strict_slashes=False)
    def conta():
        usuario = usuario_logado()
        if not usuario:
            flash("Faça login para acessar sua conta.", "error")
            return redirect(url_for("login"))

        if request.method == "POST":
            nome = request.form.get("nome", "").strip()
            sobrenome = request.form.get("sobrenome", "").strip()
            email = request.form.get("email", "").strip().lower()
            senha = request.form.get("senha", "")
            alto_contraste = request.form.get("alto_contraste") == "on"

            if not all([nome, sobrenome, email]):
                flash("Nome, sobrenome e e-mail são obrigatórios.", "error")
                return render_template("conta.html", usuario=usuario)

            usuarios = get_collection("usuarios")

            try:
                existe_email = usuarios.find_one(
                    {
                        "email": email,
                        "user_id": {"$ne": usuario["user_id"]},
                    }
                )
                if existe_email:
                    flash("Este e-mail já está em uso por outra conta.", "error")
                    return render_template("conta.html", usuario=usuario)

                update_doc = {
                    "nome": nome,
                    "sobrenome": sobrenome,
                    "email": email,
                    "alto_contraste": alto_contraste,
                }
                if senha:
                    update_doc["senha_hash"] = generate_password_hash(senha)

                usuarios.update_one(
                    {"user_id": usuario["user_id"]},
                    {"$set": update_doc},
                )

                atualizado = carregar_usuario_sessao(usuario["user_id"])
                if atualizado:
                    session["usuario"] = atualizado
                    usuario = atualizado
            except PyMongoError:
                flash("Falha ao salvar dados da conta.", "error")
                return render_template("conta.html", usuario=usuario)

            flash("Dados da conta atualizados com sucesso.", "success")
            return redirect(url_for("conta"))

        return render_template("conta.html", usuario=usuario)

    @app.get("/carteira")
    def carteira():
        usuario = usuario_logado()
        if not usuario:
            flash("Faça login para acessar sua carteira.", "error")
            return redirect(url_for("login"))

        transacoes = []
        try:
            transacoes_cursor = get_collection("transacoes_carteira").find(
                {"user_id": usuario["user_id"]}
            ).sort("data", -1)
            transacoes = list(transacoes_cursor)
        except PyMongoError:
            flash("Erro ao carregar histórico da carteira.", "error")

        return render_template("carteira.html", usuario=usuario, transacoes=transacoes)

    @app.post("/api/carteira/transacao")
    def api_carteira_transacao():
        usuario = usuario_logado()
        if not usuario:
            return jsonify({"erro": "Autenticação necessária."}), 401

        payload = request.get_json(silent=True) or {}
        ticker = str(payload.get("ticker", "")).strip().upper()
        quantidade = float(payload.get("quantidade", 0))
        data_str = str(payload.get("data", ""))

        if not ticker or not quantidade or not data_str:
            return jsonify({"erro": "Dados incompletos."}), 400

        try:
            data = datetime.fromisoformat(data_str.replace("Z", ""))
        except ValueError:
            return jsonify({"erro": "Data inválida."}), 400

        if not "." in ticker:
            ticker = f"{ticker}.SA"

        try:
            get_collection("transacoes_carteira").insert_one({
                "user_id": usuario["user_id"],
                "ticker": ticker,
                "quantidade": quantidade,
                "data": data,
                "criado_em": datetime.now(UTC)
            })
        except PyMongoError:
            return jsonify({"erro": "Erro ao salvar transação."}), 500

        return jsonify({"ok": True})

    @app.post("/api/carteira/transacao/excluir")
    def api_carteira_excluir_transacao():
        usuario = usuario_logado()
        if not usuario:
            return jsonify({"erro": "Autenticação necessária."}), 401

        payload = request.get_json(silent=True) or {}
        transacao_id = payload.get("id")

        if not transacao_id:
            return jsonify({"erro": "ID da transação não informado."}), 400

        try:
            res = get_collection("transacoes_carteira").delete_one({
                "_id": ObjectId(transacao_id),
                "user_id": usuario["user_id"]
            })
            if res.deleted_count == 0:
                return jsonify({"erro": "Transação não encontrada."}), 404
        except Exception:
            return jsonify({"erro": "Erro ao excluir transação."}), 500

        return jsonify({"ok": True})

    @app.get("/api/carteira/evolucao")
    def api_carteira_evolucao():
        usuario = usuario_logado()
        if not usuario:
            return jsonify({"erro": "Autenticação necessária."}), 401

        period = request.args.get("period", "30d").lower()
        days_map = {"30d": 30, "3m": 90, "12m": 365, "all": 0}
        days = days_map.get(period, 30)

        try:
            transacoes_cursor = get_collection("transacoes_carteira").find(
                {"user_id": usuario["user_id"]}
            ).sort("data", 1)
            transacoes = list(transacoes_cursor)
            
            if not transacoes:
                return jsonify({"evolucao": []})

            evolucao = market_data.obter_evolucao_patrimonial(transacoes, days)
            return jsonify({"evolucao": evolucao})
        except Exception as e:
            return jsonify({"erro": f"Erro ao calcular evolução: {str(e)}"}), 500
