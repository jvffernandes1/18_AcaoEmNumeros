(function () {
    const form = document.getElementById("market-form");
    const canvas = document.getElementById("priceChart");
    const ddCanvas = document.getElementById("drawdownChart");
    const statusBox = document.getElementById("market-status");

    if (!form || !canvas || !statusBox) {
        return;
    }

    const tickerInput = document.getElementById("ticker");
    const simTickerInput = document.getElementById("sim_ticker");
    const tickerDropdown = document.getElementById("ticker-dropdown");
    const simTickerDropdown = document.getElementById("sim-ticker-dropdown");
    const periodInput = document.getElementById("period");
    const kpiPar = document.getElementById("kpi-par");
    const kpiCotacao = document.getElementById("kpi-cotacao");
    const kpiVariacao = document.getElementById("kpi-variacao");
    const kpiVolatilidade = document.getElementById("kpi-volatilidade");
    const kpiMaxDd = document.getElementById("kpi-maxdd");
    const kpiSharpe = document.getElementById("kpi-sharpe");
    const tooltip = document.getElementById("chart-tooltip");
    const ddTooltip = document.getElementById("dd-tooltip");
    const chartStage = canvas.closest(".chart-stage");
    const ddChartStage = ddCanvas ? ddCanvas.closest(".chart-stage-drawdown") : null;

    let chartState = null;
    const tickerCache = new Map();

    function setStatus(message, isError) {
        statusBox.textContent = message;
        statusBox.classList.toggle("market-error", Boolean(isError));
    }

    function normalizeTickerInput(inputElement) {
        if (!inputElement) {
            return;
        }

        inputElement.addEventListener("input", function () {
            const cursorStart = inputElement.selectionStart;
            const cursorEnd = inputElement.selectionEnd;
            inputElement.value = inputElement.value.toUpperCase();
            if (cursorStart !== null && cursorEnd !== null) {
                inputElement.setSelectionRange(cursorStart, cursorEnd);
            }
        });
    }

    function setupTickerAutocomplete(inputElement, dropdownElement) {
        if (!inputElement || !dropdownElement) {
            return;
        }

        let activeIndex = -1;
        let filtered = [];
        let debounceId = null;
        let requestToken = 0;

        function closeDropdown() {
            dropdownElement.classList.remove("visible");
            dropdownElement.innerHTML = "";
            activeIndex = -1;
            filtered = [];
        }

        function selectOption(value) {
            inputElement.value = value;
            closeDropdown();
            inputElement.dispatchEvent(new Event("change", { bubbles: true }));
        }

        function renderDropdown() {
            dropdownElement.innerHTML = "";

            if (!filtered.length) {
                const empty = document.createElement("div");
                empty.className = "ticker-empty";
                empty.textContent = "Nenhum ticker encontrado.";
                dropdownElement.appendChild(empty);
                dropdownElement.classList.add("visible");
                return;
            }

            filtered.forEach((item, index) => {
                const option = document.createElement("button");
                option.type = "button";
                option.className = "ticker-option";
                const symbol = item.symbol || "";
                const name = item.name || symbol;
                const exchange = item.exchange || "";
                option.innerHTML = `<strong>${symbol}</strong><span>${name}${exchange ? ` • ${exchange}` : ""}</span>`;
                option.setAttribute("role", "option");
                if (index === activeIndex) {
                    option.classList.add("active");
                }

                option.addEventListener("mousedown", function (event) {
                    event.preventDefault();
                    selectOption(symbol);
                });

                dropdownElement.appendChild(option);
            });

            dropdownElement.classList.add("visible");
        }

        function normalizeItems(rawItems) {
            return (rawItems || []).map((item) => ({
                symbol: String(item.symbol || "").toUpperCase(),
                name: item.name || item.symbol || "",
                exchange: item.exchange || "",
            })).filter((item) => item.symbol);
        }

        async function fetchTickerOptions(query) {
            const termo = query.trim().toUpperCase();
            if (!termo) {
                return [];
            }

            if (tickerCache.has(termo)) {
                return tickerCache.get(termo);
            }

            const response = await fetch(`/api/tickers/search?q=${encodeURIComponent(termo)}`);
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.erro || "Falha ao buscar tickers.");
            }

            const normalized = normalizeItems(payload.items);
            tickerCache.set(termo, normalized);
            return normalized;
        }

        function filterOptions() {
            const query = inputElement.value.trim().toUpperCase();
            if (!query) {
                closeDropdown();
                return;
            }

            if (debounceId) {
                clearTimeout(debounceId);
            }

            debounceId = setTimeout(async function () {
                const token = ++requestToken;
                try {
                    const items = await fetchTickerOptions(query);
                    if (token !== requestToken) {
                        return;
                    }

                    filtered = items;
                    activeIndex = filtered.length ? 0 : -1;
                    renderDropdown();
                } catch (_error) {
                    if (token !== requestToken) {
                        return;
                    }

                    filtered = [];
                    activeIndex = -1;
                    renderDropdown();
                }
            }, 180);
        }

        inputElement.addEventListener("focus", filterOptions);
        inputElement.addEventListener("input", filterOptions);

        inputElement.addEventListener("keydown", function (event) {
            if (!dropdownElement.classList.contains("visible") || !filtered.length) {
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                activeIndex = (activeIndex + 1) % filtered.length;
                renderDropdown();
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
                renderDropdown();
            } else if (event.key === "Enter") {
                event.preventDefault();
                if (activeIndex >= 0 && filtered[activeIndex]) {
                    selectOption(filtered[activeIndex].symbol);
                }
            } else if (event.key === "Escape") {
                closeDropdown();
            }
        });

        document.addEventListener("click", function (event) {
            if (!dropdownElement.contains(event.target) && event.target !== inputElement) {
                closeDropdown();
            }
        });
    }

    function drawLineChart(labels, values, mm20, mm50, title, hoverIndex) {
        const ctx = canvas.getContext("2d");
        const width = canvas.clientWidth || 700;
        const height = canvas.clientHeight || 420;
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (!values.length) {
            return;
        }

        const padding = { top: 28, right: 24, bottom: 40, left: 52 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        
        const minVal = Math.min(...values.filter(v => v !== null));
        const maxVal = Math.max(...values.filter(v => v !== null));
        // Recalculate min/max considering MMs
        let overallMin = minVal;
        let overallMax = maxVal;
        if(mm20 && mm20.length) {
            const mm20Vals = mm20.filter(v => v !== null);
            if(mm20Vals.length) {
                overallMin = Math.min(overallMin, ...mm20Vals);
                overallMax = Math.max(overallMax, ...mm20Vals);
            }
        }
        if(mm50 && mm50.length) {
            const mm50Vals = mm50.filter(v => v !== null);
            if(mm50Vals.length) {
                overallMin = Math.min(overallMin, ...mm50Vals);
                overallMax = Math.max(overallMax, ...mm50Vals);
            }
        }
        
        const min = overallMin;
        const max = overallMax;
        const range = max - min || 1;

        
        const mapPoint = (val, idx) => {
            if (val === null || val === undefined) return null;
            const x = padding.left + (idx / Math.max(labels.length - 1, 1)) * chartWidth;
            const y = padding.top + ((max - val) / range) * chartHeight;
            return { x, y, value: val, label: labels[idx] || "" };
        };
        const points = values.map(mapPoint);
        const mm20Points = (mm20 || []).map(mapPoint);
        const mm50Points = (mm50 || []).map(mapPoint);


        ctx.fillStyle = "#1a2440";
        ctx.font = "600 14px Inter, Arial, sans-serif";
        ctx.fillText(title, padding.left, 18);

        ctx.strokeStyle = "#dbe2f1";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, "rgba(39, 93, 255, 0.32)");
        gradient.addColorStop(1, "rgba(39, 93, 255, 0.02)");

        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
        ctx.lineTo(points[0].x, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = "#275dff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });

        ctx.stroke();

        // Draw MM50 (purple)
        if (mm50Points && mm50Points.some(p => p !== null)) {
            ctx.strokeStyle = "#8b5cf6";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let started = false;
            mm50Points.forEach((point) => {
                if (point === null) return;
                if (!started) { ctx.moveTo(point.x, point.y); started = true; }
                else { ctx.lineTo(point.x, point.y); }
            });
            ctx.stroke();
        }

        // Draw MM20 (orange)
        if (mm20Points && mm20Points.some(p => p !== null)) {
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let started = false;
            mm20Points.forEach((point) => {
                if (point === null) return;
                if (!started) { ctx.moveTo(point.x, point.y); started = true; }
                else { ctx.lineTo(point.x, point.y); }
            });
            ctx.stroke();
        }

        ctx.fillStyle = "#5f6b8a";
        ctx.font = "12px Inter, Arial, sans-serif";
        ctx.fillText(`Max: R$ ${max.toFixed(2)}`, width - padding.right - 120, padding.top + 4);
        ctx.fillText(`Min: R$ ${min.toFixed(2)}`, width - padding.right - 120, padding.top + 20);

        const lastLabel = labels[labels.length - 1] || "";
        const firstLabel = labels[0] || "";
        ctx.fillText(firstLabel, padding.left, height - 12);
        ctx.fillText(lastLabel, width - padding.right - 70, height - 12);

        if (typeof hoverIndex === "number" && points[hoverIndex]) {
            const point = points[hoverIndex];
            ctx.strokeStyle = "rgba(26, 36, 64, 0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(point.x, padding.top);
            ctx.lineTo(point.x, height - padding.bottom);
            ctx.stroke();

            ctx.fillStyle = "#275dff";
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        chartState = {
            title,
            points,
            labels,
            values,
            mm20,
            mm50,
            drawdown: chartState ? chartState.drawdown : []
        };
    }

    
    function drawDrawdownChart(labels, drawdownValues, hoverIndex) {
        if (!ddCanvas) return;
        const ctx = ddCanvas.getContext("2d");
        const width = ddCanvas.clientWidth || 700;
        const height = ddCanvas.clientHeight || 180;
        ddCanvas.width = width;
        ddCanvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (!drawdownValues || !drawdownValues.length) return;

        const padding = { top: 20, right: 24, bottom: 24, left: 52 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const min = Math.min(...drawdownValues);
        const max = 0; // Drawdown is always <= 0
        const range = Math.max(Math.abs(min), 1);
        
        const points = drawdownValues.map((value, index) => {
            const x = padding.left + (index / Math.max(labels.length - 1, 1)) * chartWidth;
            const y = padding.top + ((max - value) / range) * chartHeight; // inverted because min is negative
            return { x, y, value, label: labels[index] || "" };
        });

        ctx.fillStyle = "#1a2440";
        ctx.font = "600 13px Inter, Arial, sans-serif";
        ctx.fillText("Drawdown %", padding.left, 14);

        ctx.strokeStyle = "#ffe4e6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(width - padding.right, padding.top); // Line at 0%
        ctx.stroke();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, "rgba(244, 63, 94, 0.05)");
        gradient.addColorStop(1, "rgba(244, 63, 94, 0.4)");

        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.lineTo(points[points.length - 1].x, padding.top);
        ctx.lineTo(points[0].x, padding.top);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        ctx.fillStyle = "#881337";
        ctx.font = "11px Inter, Arial, sans-serif";
        ctx.fillText(`Min: ${min.toFixed(2)}%`, width - padding.right - 80, height - 8);

        if (typeof hoverIndex === "number" && points[hoverIndex]) {
            const point = points[hoverIndex];
            ctx.strokeStyle = "rgba(244, 63, 94, 0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(point.x, padding.top);
            ctx.lineTo(point.x, height - padding.bottom);
            ctx.stroke();

            ctx.fillStyle = "#f43f5e";
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

function pickNearestPoint(mouseX) {
        if (!chartState || !chartState.points.length) {
            return null;
        }

        let nearestIndex = 0;
        let nearestDistance = Infinity;
        chartState.points.forEach((point, index) => {
            const distance = Math.abs(point.x - mouseX);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });

        return nearestIndex;
    }

    function hideTooltip() {
        if (!tooltip) {
            return;
        }
        tooltip.classList.remove("visible");
        tooltip.setAttribute("aria-hidden", "true");
        if (ddTooltip) {
            ddTooltip.classList.remove("visible");
            ddTooltip.setAttribute("aria-hidden", "true");
        }
    }

    function updateTooltip(index) {
        if (!tooltip || !chartState || !chartState.points[index] || !chartStage) {
            hideTooltip();
            return;
        }

        
        const point = chartState.points[index];
        const val20 = chartState.mm20[index];
        const val50 = chartState.mm50[index];
        
        let html = `<strong>${point.label}</strong><br>R$ ${Number(point.value).toFixed(2)}`;
        if (val20 !== null) html += `<br><span style="color:#f59e0b">MM20:</span> R$ ${Number(val20).toFixed(2)}`;
        if (val50 !== null) html += `<br><span style="color:#8b5cf6">MM50:</span> R$ ${Number(val50).toFixed(2)}`;
        tooltip.innerHTML = html;


        const stageWidth = chartStage.clientWidth;
        const stageHeight = chartStage.clientHeight;
        const baseX = canvas.offsetLeft + point.x;
        const baseY = canvas.offsetTop + point.y;

        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;

        let left = baseX - (tooltipWidth / 2);
        let top = baseY - tooltipHeight - 14;

        left = Math.max(8, Math.min(left, stageWidth - tooltipWidth - 8));

        if (top < 8) {
            top = Math.min(baseY + 14, stageHeight - tooltipHeight - 8);
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        
        tooltip.classList.add("visible");
        tooltip.setAttribute("aria-hidden", "false");

        if (ddTooltip && chartState.drawdown && ddChartStage) {
            const ddVal = chartState.drawdown[index];
            ddTooltip.innerHTML = `<strong>${point.label}</strong><br>${Number(ddVal).toFixed(2)}%`;
            
            const stageWidthDD = ddChartStage.clientWidth;
            const stageHeightDD = ddChartStage.clientHeight;
            // map y for drawdown
            const padding = { top: 20, right: 24, bottom: 24, left: 52 };
            const chartHeight = ddCanvas.clientHeight - padding.top - padding.bottom;
            const min = Math.min(...chartState.drawdown);
            const max = 0;
            const range = Math.max(Math.abs(min), 1);
            const y = padding.top + ((max - ddVal) / range) * chartHeight;
            
            const baseXDD = ddCanvas.offsetLeft + point.x;
            const baseYDD = ddCanvas.offsetTop + y;
            const ttWidth = ddTooltip.offsetWidth;
            const ttHeight = ddTooltip.offsetHeight;
            
            let leftDD = baseXDD - (ttWidth / 2);
            let topDD = baseYDD - ttHeight - 14;
            leftDD = Math.max(8, Math.min(leftDD, stageWidthDD - ttWidth - 8));
            if (topDD < 8) topDD = Math.min(baseYDD + 14, stageHeightDD - ttHeight - 8);
            
            ddTooltip.style.left = `${leftDD}px`;
            ddTooltip.style.top = `${topDD}px`;
            ddTooltip.classList.add("visible");
            ddTooltip.setAttribute("aria-hidden", "false");
        }

    }

    function findAwesomeEntry(dadosAwesome) {
        const keys = Object.keys(dadosAwesome || {});
        if (keys.length === 0) {
            return null;
        }
        return dadosAwesome[keys[0]];
    }

    async function carregarDados() {
        const ticker = tickerInput.value.trim().toUpperCase() || "PETR4.SA";
        const period = periodInput.value;
        setStatus("Buscando dados de mercado...", false);

        const params = new URLSearchParams({
            ticker,
            period,
            par: "USDBRL"
        });

        const response = await fetch(`/api/backtest/primeiro-bloco?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.erro || "Falha ao carregar dados de mercado.");
        }

        const historico = payload.historico || [];
        const labels = historico.map((item) => item.data);
        const prices = historico.map((item) => item.fechamento);

        const indicadores = payload.indicadores || {};
        chartState = { labels, values: prices, mm20: indicadores.mm20 || [], mm50: indicadores.mm50 || [], drawdown: indicadores.drawdown || [] };
        drawLineChart(labels, prices, chartState.mm20, chartState.mm50, `${payload.ticker} (fechamento)`);
        drawDrawdownChart(labels, chartState.drawdown);
        hideTooltip();

        const entry = findAwesomeEntry((payload.awesome || {}).dados || {});
        if (entry) {
            kpiPar.textContent = entry.code + entry.codein;
            kpiCotacao.textContent = Number(entry.bid).toLocaleString("pt-BR", {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
            });
            kpiVariacao.textContent = `${Number(entry.pctChange).toFixed(2)}%`;
        } else {
            kpiPar.textContent = "USDBRL";
            kpiCotacao.textContent = "-";
            kpiVariacao.textContent = "-";
        }

        
        if (payload.indicadores) {
            if(kpiVolatilidade) kpiVolatilidade.textContent = `${Number(payload.indicadores.volatilidade_anual).toFixed(2)}%`;
            if(kpiMaxDd) kpiMaxDd.textContent = `${Number(payload.indicadores.max_drawdown).toFixed(2)}%`;
            if(kpiSharpe) kpiSharpe.textContent = Number(payload.indicadores.sharpe_ratio).toFixed(2);
        } else {
            if(kpiVolatilidade) kpiVolatilidade.textContent = "-";
            if(kpiMaxDd) kpiMaxDd.textContent = "-";
            if(kpiSharpe) kpiSharpe.textContent = "-";
        }

        if (payload.aviso) {
            setStatus(payload.aviso + ` Histórico atualizado para ${payload.ticker}.`, false);
        } else {
            setStatus(`Dados atualizados para ${payload.ticker} em ${payload.period}.`, false);
        }
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
            await carregarDados();
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    normalizeTickerInput(tickerInput);
    normalizeTickerInput(simTickerInput);
    setupTickerAutocomplete(tickerInput, tickerDropdown);
    setupTickerAutocomplete(simTickerInput, simTickerDropdown);

    if (tickerInput && simTickerInput) {
        tickerInput.addEventListener("change", function () {
            simTickerInput.value = tickerInput.value;
        });
    }

    
    function handleHover(event, canvasElem) {
        if (!chartState) return;
        const rect = canvasElem.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const hoverIndex = pickNearestPoint(mouseX);
        if (hoverIndex === null) return;

        drawLineChart(chartState.labels, chartState.values, chartState.mm20, chartState.mm50, chartState.title || "Preço", hoverIndex);
        drawDrawdownChart(chartState.labels, chartState.drawdown, hoverIndex);
        updateTooltip(hoverIndex);
    }
    
    function handleLeave() {
        if (!chartState) return;
        drawLineChart(chartState.labels, chartState.values, chartState.mm20, chartState.mm50, chartState.title || "Preço");
        drawDrawdownChart(chartState.labels, chartState.drawdown);
        hideTooltip();
    }

    
    function handleHover(event, canvasElem) {
        if (!chartState) return;
        const rect = canvasElem.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const hoverIndex = pickNearestPoint(mouseX);
        if (hoverIndex === null) return;

        drawLineChart(chartState.labels, chartState.values, chartState.mm20, chartState.mm50, chartState.title || "Preço", hoverIndex);
        drawDrawdownChart(chartState.labels, chartState.drawdown, hoverIndex);
        updateTooltip(hoverIndex);
    }
    
    function handleLeave() {
        if (!chartState) return;
        drawLineChart(chartState.labels, chartState.values, chartState.mm20, chartState.mm50, chartState.title || "Preço");
        drawDrawdownChart(chartState.labels, chartState.drawdown);
        hideTooltip();
    }

    canvas.addEventListener("mousemove", (e) => handleHover(e, canvas));
    canvas.addEventListener("mouseleave", handleLeave);
    
    if (ddCanvas) {
        ddCanvas.addEventListener("mousemove", (e) => handleHover(e, ddCanvas));
        ddCanvas.addEventListener("mouseleave", handleLeave);
    }

    carregarDados().catch((error) => {
        setStatus(error.message, true);
    });
})();
