from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path

import requests
import yfinance as yf
import pandas as pd


def obter_historico_acao(ticker: str, period: str = "6mo") -> list[dict]:
    dados = yf.Ticker(ticker).history(period=period)
    historico = []

    for indice, linha in dados.iterrows():
        historico.append(
            {
                "data": indice.strftime("%Y-%m-%d"),
                "fechamento": float(linha.get("Close", 0.0)),
                "volume": int(linha.get("Volume", 0)),
            }
        )

    return historico


def obter_cotacoes_awesome(pares: str, api_key: str) -> dict:
    par_normalizado = (pares or "USDBRL").strip().upper().replace("-", "")
    if len(par_normalizado) >= 6:
        par_endpoint = f"{par_normalizado[:3]}-{par_normalizado[3:6]}"
    else:
        par_endpoint = "USD-BRL"

    params = {"token": api_key} if api_key else None

    # Endpoint principal validado para cotacoes com token.
    url_primaria = f"https://economia.awesomeapi.com.br/json/last/{par_endpoint}"
    try:
        resposta = requests.get(url_primaria, params=params, timeout=15)
        resposta.raise_for_status()
    except requests.RequestException:
        # Fallback para variacao de host em caso de indisponibilidade temporaria.
        url_fallback = f"https://api.awesomeapi.com.br/json/last/{par_normalizado}"
        resposta = requests.get(url_fallback, params=params, timeout=15)
        resposta.raise_for_status()

    return {
        "coletado_em": datetime.now(UTC).isoformat(),
        "dados": resposta.json(),
    }


def buscar_tickers(query: str, limit: int = 20, stocks_dir: str | None = None) -> list[dict]:
    termo = (query or "").strip().upper()
    if not termo:
        return []

    resultados = []
    vistos = set()

    for local in filtrar_tickers_locais(termo, stocks_dir=stocks_dir, limit=limit):
        simbolo = local["symbol"]
        if simbolo in vistos:
            continue
        vistos.add(simbolo)
        resultados.append(local)

    # Se jÃ¡ atingiu limite com base local, nÃ£o consulta rede externa.
    if len(resultados) >= limit:
        return resultados[:limit]

    url = "https://query2.finance.yahoo.com/v1/finance/search"
    params = {
        "q": termo,
        "quotesCount": max(limit, 10),
        "newsCount": 0,
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
    }

    resposta = requests.get(url, params=params, headers=headers, timeout=12)
    resposta.raise_for_status()
    payload = resposta.json()

    for quote in payload.get("quotes", []):
        simbolo = str(quote.get("symbol", "")).strip().upper()
        if not simbolo:
            continue

        # Priorizamos ativos negociÃ¡veis e removemos duplicatas.
        if simbolo in vistos:
            continue
        vistos.add(simbolo)

        resultados.append(
            {
                "symbol": simbolo,
                "name": quote.get("shortname") or quote.get("longname") or simbolo,
                "exchange": quote.get("exchDisp") or quote.get("exchange") or "",
                "type": quote.get("quoteType") or "",
            }
        )

        if len(resultados) >= limit:
            break

    # Se for um cÃ³digo tÃ­pico B3 digitado sem sufixo, sugerimos tambÃ©m .SA.
    if termo.isalnum() and not termo.endswith(".SA") and any(ch.isdigit() for ch in termo):
        simbolo_b3 = f"{termo}.SA"
        if simbolo_b3 not in vistos:
            resultados.insert(
                0,
                {
                    "symbol": simbolo_b3,
                    "name": "Ativo B3 (sugestÃ£o)",
                    "exchange": "B3",
                    "type": "EQUITY",
                },
            )

    return resultados[:limit]


@lru_cache(maxsize=8)
def get_tickers(stocks_dir: str | None = None) -> list[dict[str, str]]:
    base_dir = Path(stocks_dir) if stocks_dir else Path(__file__).resolve().parents[2] / "data" / "stocks"
    tickers: set[str] = set()

    if base_dir.exists():
        for csv_file in base_dir.glob("*.csv"):
            tickers.add(csv_file.stem.upper())

    sorted_tickers = sorted(tickers)
    return [
        {
            "symbol": symbol,
            "market": "B3" if symbol.endswith(".SA") else "Global",
            "display": symbol,
            "name": symbol,
            "exchange": "B3" if symbol.endswith(".SA") else "",
            "type": "EQUITY",
        }
        for symbol in sorted_tickers
    ]


def filtrar_tickers_locais(query: str, stocks_dir: str | None = None, limit: int = 20) -> list[dict[str, str]]:
    termo = (query or "").strip().upper()
    if not termo:
        return []

    base = get_tickers(stocks_dir)

    def score(symbol: str) -> tuple[int, int, str]:
        if symbol.startswith(termo):
            return (0, len(symbol), symbol)
        if termo in symbol:
            return (1, len(symbol), symbol)
        if symbol.endswith(".SA") and symbol.startswith(f"{termo}."):
            return (2, len(symbol), symbol)
        return (9, len(symbol), symbol)

    filtrados = [item for item in base if termo in item["symbol"] or item["symbol"].startswith(termo)]
    filtrados.sort(key=lambda item: score(item["symbol"]))
    return filtrados[:limit]


def calcular_retorno_anualizado(historico: list[dict]) -> float:
    if len(historico) < 2:
        return 0.0

    preco_inicial = historico[0]["fechamento"]
    preco_final = historico[-1]["fechamento"]

    if preco_inicial <= 0:
        return 0.0

    variacao_periodo = (preco_final / preco_inicial) - 1
    quantidade_pontos = max(len(historico), 2)

    # Aproxima trading days para anualizar com base no histÃ³rico retornado.
    retorno_anualizado = (1 + variacao_periodo) ** (252 / quantidade_pontos) - 1
    return float(retorno_anualizado)


def projetar_valor_futuro(
    aporte_inicial: float,
    aporte_mensal: float,
    meses: int,
    retorno_anualizado: float,
) -> float:
    taxa_mensal = (1 + retorno_anualizado) ** (1 / 12) - 1

    if abs(taxa_mensal) < 1e-9:
        return aporte_inicial + (aporte_mensal * meses)

    acumulado_inicial = aporte_inicial * ((1 + taxa_mensal) ** meses)
    acumulado_aportes = aporte_mensal * ((((1 + taxa_mensal) ** meses) - 1) / taxa_mensal)
    return float(acumulado_inicial + acumulado_aportes)
def obter_evolucao_patrimonial(transacoes: list[dict], period_days: int) -> list[dict]:
    if not transacoes:
        return []

    if period_days > 0:
        data_inicio = datetime.now() - timedelta(days=period_days)
    else:
        datas = [t["data"] for t in transacoes]
        datas_dt = []
        for d in datas:
            if isinstance(d, datetime):
                datas_dt.append(d)
            else:
                datas_dt.append(datetime.fromisoformat(str(d).replace("Z", "")))
        data_inicio = min(datas_dt)

    hoje = datetime.now()
    range_datas = pd.date_range(start=data_inicio, end=hoje, freq='B')
    if range_datas.empty:
        return []

    tickers = list(set(t["ticker"] for t in transacoes))
    start_str = data_inicio.strftime("%Y-%m-%d")
    try:
        data_precos = yf.download(tickers, start=start_str, progress=False)["Close"]
        if isinstance(data_precos, pd.Series):
            data_precos = data_precos.to_frame()
            data_precos.columns = tickers
    except Exception:
        return []

    data_precos = data_precos.reindex(range_datas).ffill().fillna(0)
    evolucao = []
    for data in range_datas:
        total_dia = 0.0
        transacoes_ate_hoje = []
        for t in transacoes:
            t_data = t["data"]
            if not isinstance(t_data, datetime):
                t_data = datetime.fromisoformat(str(t_data).replace("Z", ""))
            if t_data.replace(tzinfo=None) <= data.to_pydatetime().replace(tzinfo=None):
                transacoes_ate_hoje.append(t)
        
        composicao = {}
        for t in transacoes_ate_hoje:
            tick = t["ticker"]
            composicao[tick] = composicao.get(tick, 0) + t["quantidade"]
        
        for tick, qtd in composicao.items():
            if qtd > 0:
                preco = 0.0
                if tick in data_precos.columns:
                    try:
                        preco = data_precos.loc[data, tick]
                    except KeyError:
                        preco = 0.0
                total_dia += qtd * float(preco)
        
        evolucao.append({
            "data": data.strftime("%Y-%m-%d"),
            "valor": round(total_dia, 2)
        })
    return evolucao
