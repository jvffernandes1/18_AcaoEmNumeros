(function () {
    const body = document.body;
    const toggleButton = document.getElementById("contrast-toggle");
    const fontIncrease = document.getElementById("font-increase");
    const fontDecrease = document.getElementById("font-decrease");

    if (!body || !toggleButton) {
        return;
    }

    const isAuthenticated = body.dataset.authenticated === "true";

    // ── Theme / Contrast ───────────────────────────────────────────

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

    // ── Font Size Accessibility ────────────────────────────────────

    const FONT_STEP = 2;       // px per click
    const FONT_MIN = 12;       // px minimum
    const FONT_MAX = 28;       // px maximum
    const FONT_DEFAULT = 16;   // px browser default

    function getStoredFontSize() {
        const stored = localStorage.getItem("aen_font_size");
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed >= FONT_MIN && parsed <= FONT_MAX) {
                return parsed;
            }
        }
        return FONT_DEFAULT;
    }

    function applyFontSize(size) {
        document.documentElement.style.fontSize = size + "px";
        localStorage.setItem("aen_font_size", String(size));

        // Update button states
        if (fontDecrease) {
            fontDecrease.disabled = size <= FONT_MIN;
            fontDecrease.style.opacity = size <= FONT_MIN ? "0.4" : "1";
        }
        if (fontIncrease) {
            fontIncrease.disabled = size >= FONT_MAX;
            fontIncrease.style.opacity = size >= FONT_MAX ? "0.4" : "1";
        }
    }

    // Apply stored font size on load
    let currentFontSize = getStoredFontSize();
    applyFontSize(currentFontSize);

    if (fontIncrease) {
        fontIncrease.addEventListener("click", function () {
            if (currentFontSize < FONT_MAX) {
                currentFontSize = Math.min(currentFontSize + FONT_STEP, FONT_MAX);
                applyFontSize(currentFontSize);
            }
        });
    }

    if (fontDecrease) {
        fontDecrease.addEventListener("click", function () {
            if (currentFontSize > FONT_MIN) {
                currentFontSize = Math.max(currentFontSize - FONT_STEP, FONT_MIN);
                applyFontSize(currentFontSize);
            }
        });
    }
})();
