(function () {
    const form = document.getElementById("portfolio-form");
    const canvas = document.getElementById("evolutionChart");
    const statusBox = document.getElementById("portfolio-status");

    if (!form || !canvas || !statusBox) {
        return;
    }

    const tickerInput = document.getElementById("ticker");
    const tickerDropdown = document.getElementById("ticker-dropdown");
    const quantidadeInput = document.getElementById("quantidade");
    const dataInput = document.getElementById("data");
    const rangeBtns = document.querySelectorAll(".range-btn");
    const tooltip = document.getElementById("chart-tooltip");
    const chartStage = canvas.closest(".chart-stage");

    let chartState = null;
    let currentRange = "30d";
    const tickerCache = new Map();

    // Set default date to today
    if (dataInput) {
        dataInput.valueAsDate = new Date();
    }

    function setStatus(message, isError) {
        statusBox.textContent = message;
        statusBox.classList.toggle("market-error", Boolean(isError));
    }

    function normalizeTickerInput(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener("input", function () {
            inputElement.value = inputElement.value.toUpperCase();
        });
    }

    function setupTickerAutocomplete(inputElement, dropdownElement) {
        let activeIndex = -1;
        let filtered = [];
        let debounceId = null;
        let requestToken = 0;

        function closeDropdown() {
            dropdownElement.classList.remove("visible");
            dropdownElement.innerHTML = "";
            activeIndex = -1;
        }

        function selectOption(value) {
            inputElement.value = value;
            closeDropdown();
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
                if (index === activeIndex) option.classList.add("active");
                option.innerHTML = `<strong>${item.symbol}</strong><span>${item.name}</span>`;
                option.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    selectOption(item.symbol);
                });
                dropdownElement.appendChild(option);
            });
            dropdownElement.classList.add("visible");
        }

        inputElement.addEventListener("input", () => {
            const query = inputElement.value.trim().toUpperCase();
            if (!query) {
                closeDropdown();
                return;
            }
            if (debounceId) clearTimeout(debounceId);
            debounceId = setTimeout(async () => {
                const token = ++requestToken;
                try {
                    const response = await fetch(`/api/tickers/search?q=${encodeURIComponent(query)}`);
                    const payload = await response.json();
                    if (token !== requestToken) return;
                    filtered = payload.items || [];
                    activeIndex = filtered.length ? 0 : -1;
                    renderDropdown();
                } catch (e) {
                    if (token !== requestToken) return;
                    filtered = [];
                    renderDropdown();
                }
            }, 200);
        });

        inputElement.addEventListener("keydown", (e) => {
            if (!dropdownElement.classList.contains("visible") || !filtered.length) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % filtered.length;
                renderDropdown();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
                renderDropdown();
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (activeIndex >= 0) selectOption(filtered[activeIndex].symbol);
            } else if (e.key === "Escape") {
                closeDropdown();
            }
        });

        document.addEventListener("click", (e) => {
            if (e.target !== inputElement) closeDropdown();
        });
    }

    function drawLineChart(labels, values, title, hoverIndex) {
        const ctx = canvas.getContext("2d");
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);

        if (!values.length) {
            ctx.fillStyle = "#5f6b8a";
            ctx.textAlign = "center";
            ctx.fillText("Sem dados para o período selecionado", width / 2, height / 2);
            return;
        }

        const padding = { top: 40, right: 30, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const min = Math.min(...values) * 0.95;
        const max = Math.max(...values) * 1.05;
        const range = max - min || 1;

        const points = values.map((v, i) => ({
            x: padding.left + (i / Math.max(values.length - 1, 1)) * chartWidth,
            y: padding.top + ((max - v) / range) * chartHeight,
            value: v,
            label: labels[i]
        }));

        // Draw axes
        ctx.strokeStyle = "#dbe2f1";
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        // Area gradient
        const grad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        grad.addColorStop(0, "rgba(39, 93, 255, 0.2)");
        grad.addColorStop(1, "rgba(39, 93, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
        ctx.lineTo(points[0].x, height - padding.bottom);
        ctx.fill();

        // Line
        ctx.strokeStyle = "#275dff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // Hover
        if (hoverIndex !== null && points[hoverIndex]) {
            const p = points[hoverIndex];
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(p.x, padding.top);
            ctx.lineTo(p.x, height - padding.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#275dff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        chartState = { points, labels, values };
    }

    async function loadEvolution() {
        setStatus("Carregando evolução...", false);
        try {
            const res = await fetch(`/api/carteira/evolucao?period=${currentRange}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro || "Falha ao carregar.");
            const labels = data.evolucao.map(d => d.data);
            const values = data.evolucao.map(d => d.valor);
            drawLineChart(labels, values, "Evolução Patrimonial", null);
            setStatus(`Evolução atualizada (${currentRange})`, false);
        } catch (e) {
            setStatus(e.message, true);
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            ticker: tickerInput.value,
            quantidade: parseFloat(quantidadeInput.value),
            data: dataInput.value
        };
        try {
            const res = await fetch("/api/carteira/transacao", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Erro ao salvar.");
            location.reload();
        } catch (e) {
            alert(e.message);
        }
    });

    window.excluirTransacao = async (id) => {
        if (!confirm("Excluir esta movimentação?")) return;
        try {
            const res = await fetch("/api/carteira/transacao/excluir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error("Erro ao excluir.");
            location.reload();
        } catch (e) {
            alert(e.message);
        }
    };

    rangeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            rangeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentRange = btn.dataset.range;
            loadEvolution();
        });
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!chartState) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let nearIdx = 0;
        let nearDist = Infinity;
        chartState.points.forEach((p, i) => {
            const d = Math.abs(p.x - x);
            if (d < nearDist) {
                nearDist = d;
                nearIdx = i;
            }
        });
        drawLineChart(chartState.labels, chartState.values, "", nearIdx);
        
        // Tooltip
        const p = chartState.points[nearIdx];
        tooltip.innerHTML = `<strong>${p.label}</strong><br>R$ ${p.value.toLocaleString("pt-BR")}`;
        tooltip.style.left = `${canvas.offsetLeft + p.x - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${canvas.offsetTop + p.y - tooltip.offsetHeight - 10}px`;
        tooltip.classList.add("visible");
    });

    canvas.addEventListener("mouseleave", () => {
        if (chartState) drawLineChart(chartState.labels, chartState.values, "", null);
        tooltip.classList.remove("visible");
    });

    normalizeTickerInput(tickerInput);
    setupTickerAutocomplete(tickerInput, tickerDropdown);
    loadEvolution();
})();
