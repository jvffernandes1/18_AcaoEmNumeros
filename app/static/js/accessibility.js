(function () {
    const body = document.body;
    const toggleButton = document.getElementById("contrast-toggle");

    if (!body || !toggleButton) {
        return;
    }

    const isAuthenticated = body.dataset.authenticated === "true";

    function setTheme(themeName) {
        body.dataset.theme = themeName;
        const isHigh = themeName === "high";
        toggleButton.classList.toggle("active", isHigh);
        toggleButton.setAttribute("aria-pressed", isHigh ? "true" : "false");
        localStorage.setItem("aen_contrast", themeName);
    }

    async function persistPreference(isHighContrast) {
        if (!isAuthenticated) {
            return;
        }

        try {
            await fetch("/preferencias/contraste", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ enabled: isHighContrast }),
            });
        } catch (_error) {
            // Keep local state; backend persistence can be retried on next toggle.
        }
    }

    const initialTheme = isAuthenticated ? body.dataset.contrast || "light" : localStorage.getItem("aen_contrast") || "light";
    setTheme(initialTheme);

    toggleButton.addEventListener("click", async function () {
        const current = body.dataset.theme === "high" ? "high" : "light";
        const next = current === "high" ? "light" : "high";
        setTheme(next);
        await persistPreference(next === "high");
    });
})();
