// ✅ Prevent duplicate injections if popup injects content.js multiple times
if (!globalThis.__dyslexiaHelperInjected) {
    globalThis.__dyslexiaHelperInjected = true;

    const DEFAULT_SETTINGS = {
        enabled: false,
        font: "Original Font",
        letterSpacing: 0,
        wordSpacing: 0,
        bgEnabled: false,
        bgColor: "#ffffff",
        acceptedTerms: false,
        termsDismissed: false
    };

    function getFontFamily(fontLabel) {
        switch (fontLabel) {
            case "OpenDyslexic": return '"OpenDyslexic", sans-serif';
            case "Lexend": return '"Lexend", sans-serif';
            case "Comic Sans": return '"Comic Sans MS", "Comic Sans", cursive';
            case "Arial": return "Arial, Helvetica, sans-serif";
            default: return "inherit";
        }
    }

    function ensureFontFacesInjected() {
        if (document.getElementById("dyslexia-fontfaces")) return;

        const dyslexicUrl = chrome.runtime.getURL("fonts/OpenDyslexic-Regular.otf");
        const lexendUrl = chrome.runtime.getURL("fonts/Lexend-Regular.ttf");

        const css = `
@font-face {
  font-family: "OpenDyslexic";
  src: url("${dyslexicUrl}") format("opentype");
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: "Lexend";
  src: url("${lexendUrl}") format("truetype");
  font-weight: normal;
  font-style: normal;
}
    `.trim();

        const style = document.createElement("style");
        style.id = "dyslexia-fontfaces";
        style.textContent = css;
        document.documentElement.appendChild(style);
    }

    function forceOff() {
        const root = document.documentElement;
        const body = document.body;
        if (!root || !body) return;

        root.classList.remove("dyslexia-helper-active");
        body.classList.remove("dyslexia-helper-bg");

        root.style.removeProperty("--dys-font-family");
        root.style.removeProperty("--dys-letter-spacing");
        root.style.removeProperty("--dys-word-spacing");
        root.style.removeProperty("--dys-bg-color");

        body.style.backgroundColor = "";
    }

    function applySettings(settings) {
        const merged = { ...DEFAULT_SETTINGS, ...settings };
        const root = document.documentElement;
        const body = document.body;

        if (!root || !body) return;

        // ✅ HARD GATE: no terms acceptance => always OFF
        if (!merged.acceptedTerms) {
            forceOff();
            return;
        }

        ensureFontFacesInjected();

        if (merged.enabled) {
            root.classList.add("dyslexia-helper-active");

            root.style.setProperty("--dys-font-family", getFontFamily(merged.font));
            root.style.setProperty("--dys-letter-spacing", `${merged.letterSpacing}px`);
            root.style.setProperty("--dys-word-spacing", `${merged.wordSpacing}px`);
            root.style.setProperty("--dys-bg-color", merged.bgColor || "#fff9b0");

            if (merged.bgEnabled) {
                body.classList.add("dyslexia-helper-bg");
                body.style.backgroundColor = merged.bgColor || "#fff9b0";
            } else {
                body.classList.remove("dyslexia-helper-bg");
                body.style.backgroundColor = "";
            }
        } else {
            forceOff();
        }
    }

    function initFromStorage() {
        chrome.storage.local.get(DEFAULT_SETTINGS, stored => applySettings(stored));
    }

    // ✅ live update on storage changes (normal path)
    chrome.storage.onChanged.addListener((_changes, areaName) => {
        if (areaName !== "local") return;
        chrome.storage.local.get(DEFAULT_SETTINGS, current => applySettings(current));
    });

    // ✅ instant apply when popup sends message (fixes “first time needs refresh”)
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === "APPLY_SETTINGS") {
            applySettings(msg.settings || {});
            sendResponse({ ok: true });
        }
    });

    initFromStorage();
}
