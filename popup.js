// popup.js (FULL, WORKING)
// - Terms acceptance works (supports BOTH: your old mini-toggle #termsToggle AND a real checkbox #termsCheckbox)
// - Terms section hides ONLY after you turn ON, and ONLY on the NEXT popup open (so it won’t “vanish in front of eyes”)
// - No refresh needed: applies instantly to current tab using activeTab + scripting injection
// - Avoids chrome:// and Chrome Web Store errors

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

const BG_COLORS = {
    White: "#ffffff",
    Beige: "#fef3c7",
    Grey: "#f3f3f3",
    Blue: "#dbeafe"
};

const PRESETS = {
    default: { font: "Original Font", letterSpacing: 0, wordSpacing: 0, bgEnabled: false, bgColor: BG_COLORS.White },
    balanced: { font: "Lexend", letterSpacing: 1, wordSpacing: 6, bgEnabled: true, bgColor: BG_COLORS.Beige },
    strong: { font: "OpenDyslexic", letterSpacing: 3, wordSpacing: 10, bgEnabled: true, bgColor: BG_COLORS.Grey }
};

let currentSettings = { ...DEFAULT_SETTINGS };

// UI refs
let popupContainer;
let mainViewEl, termsViewEl, backBtn, openTermsInline;

let toggleEl, fontSelectEl;
let letterBar, wordBar, letterCircle, wordCircle;
let fontPreviewText, letterPreviewText, wordPreviewText;
let letterValueEl, wordValueEl;
let colorOptions, resetBtn, saveIndicatorEl;
let presetButtons;

let termsAcceptSection;
let termsToggle;      // old UI: div.mini-toggle
let termsCheckbox;    // new UI: input[type=checkbox]
let termsRequiredBanner;

let letterSliderCtrl, wordSliderCtrl;
let savedTimer, applyTimer;

// prevent the terms section from hiding instantly (only hide on next popup open)
let sessionJustDismissedTerms = false;

/* ---------- helpers ---------- */
function getFontFamily(fontLabel) {
    switch (fontLabel) {
        case "OpenDyslexic": return '"OpenDyslexic", sans-serif';
        case "Lexend": return '"Lexend", sans-serif';
        case "Comic Sans": return '"Comic Sans MS", "Comic Sans", cursive';
        case "Arial": return "Arial, Helvetica, sans-serif";
        default: return "inherit";
    }
}

function setSaveState(state) {
    if (!saveIndicatorEl) return;
    if (state === "saving") {
        saveIndicatorEl.classList.add("saving");
        saveIndicatorEl.querySelector(".text").textContent = "Saving…";
    } else {
        saveIndicatorEl.classList.remove("saving");
        saveIndicatorEl.querySelector(".text").textContent = "Saved";
    }
}

function isInjectableUrl(url) {
    if (!url || typeof url !== "string") return false;

    const blockedSchemes = ["chrome://", "edge://", "about:", "brave://", "opera://", "chrome-extension://"];
    if (blockedSchemes.some(s => url.startsWith(s))) return false;

    if (url.startsWith("https://chrome.google.com/webstore")) return false;
    if (url.startsWith("https://chromewebstore.google.com")) return false;

    return url.startsWith("http://") || url.startsWith("https://");
}

/* ---------- apply to active tab (activeTab, no broad host perms) ---------- */
function scheduleApplyToActiveTab() {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(applyToActiveTab, 60);
}

function applyToActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab?.id || !isInjectableUrl(tab.url)) return;

        chrome.scripting.insertCSS(
            { target: { tabId: tab.id, allFrames: true }, files: ["styles.css"] },
            () => {
                void chrome.runtime.lastError;

                chrome.scripting.executeScript(
                    { target: { tabId: tab.id, allFrames: true }, files: ["content.js"] },
                    () => {
                        void chrome.runtime.lastError;

                        chrome.tabs.sendMessage(tab.id, { type: "APPLY_SETTINGS", settings: currentSettings }, () => {
                            void chrome.runtime.lastError;
                        });
                    }
                );
            }
        );
    });
}

/* ---------- storage ---------- */
function saveSettingsToStorage() {
    setSaveState("saving");
    if (savedTimer) clearTimeout(savedTimer);

    chrome.storage.local.set(currentSettings, () => {
        savedTimer = setTimeout(() => setSaveState("saved"), 150);
        scheduleApplyToActiveTab();
    });
}

/* ---------- scroll ---------- */
function scrollToSection(el) {
    if (!popupContainer || !el) return;

    const containerRect = popupContainer.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const currentScroll = popupContainer.scrollTop;
    const offsetTop = (elRect.top - containerRect.top) + currentScroll;

    popupContainer.scrollTo({ top: Math.max(0, offsetTop - 12), behavior: "smooth" });
}

/* ---------- views ---------- */
function showTerms() {
    if (!mainViewEl || !termsViewEl) return;

    mainViewEl.classList.remove("active-view");
    termsViewEl.classList.add("active-view");
    termsViewEl.setAttribute("aria-hidden", "false");
    mainViewEl.setAttribute("aria-hidden", "true");

    // lock container scroll in terms view (your CSS uses this)
    if (popupContainer) {
        popupContainer.classList.add("lock-scroll");
        popupContainer.scrollTop = 0;
    }
}

function showMain() {
    if (!mainViewEl || !termsViewEl) return;

    termsViewEl.classList.remove("active-view");
    mainViewEl.classList.add("active-view");
    mainViewEl.setAttribute("aria-hidden", "false");
    termsViewEl.setAttribute("aria-hidden", "true");

    // IMPORTANT: unlock scroll so popup can scroll down again
    if (popupContainer) popupContainer.classList.remove("lock-scroll");
}

/* ---------- UI updates ---------- */
function updateToggleUI() {
    if (!toggleEl) return;

    const canEnable = !!currentSettings.acceptedTerms;
    const isOn = !!currentSettings.enabled && canEnable;

    if (isOn) {
        toggleEl.classList.add("active");
        toggleEl.setAttribute("aria-checked", "true");
    } else {
        toggleEl.classList.remove("active");
        toggleEl.setAttribute("aria-checked", "false");
    }
}

function updateFontUI() {
    if (!fontSelectEl || !fontPreviewText) return;

    const options = Array.from(fontSelectEl.options);
    const index = options.findIndex(opt => opt.text.trim() === currentSettings.font);
    if (index >= 0) fontSelectEl.selectedIndex = index;

    fontPreviewText.style.fontFamily = getFontFamily(currentSettings.font);
}

function updateLetterPreview() {
    if (letterPreviewText) letterPreviewText.style.letterSpacing = `${currentSettings.letterSpacing}px`;
    if (letterValueEl) letterValueEl.textContent = `${currentSettings.letterSpacing} px`;
}

function updateWordPreview() {
    if (wordPreviewText) wordPreviewText.style.wordSpacing = `${currentSettings.wordSpacing}px`;
    if (wordValueEl) wordValueEl.textContent = `${currentSettings.wordSpacing} px`;
}

function updateBgUI() {
    if (!colorOptions) return;

    colorOptions.forEach(btn => {
        const label = btn.textContent.trim();
        const color = BG_COLORS[label] || "#ffffff";
        if (currentSettings.bgEnabled && currentSettings.bgColor === color) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

function updateTermsUI() {
    if (!termsAcceptSection) return;

    // keep both UIs in sync if both exist
    if (termsCheckbox) {
        termsCheckbox.checked = !!currentSettings.acceptedTerms;
    }

    if (termsToggle) {
        if (currentSettings.acceptedTerms) {
            termsToggle.classList.add("active");
            termsToggle.setAttribute("aria-checked", "true");
        } else {
            termsToggle.classList.remove("active");
            termsToggle.setAttribute("aria-checked", "false");
        }
    }

    // hide ONLY on next open after turning ON (no “vanish in front of eyes”)
    const shouldHide = !!currentSettings.termsDismissed && !sessionJustDismissedTerms;
    termsAcceptSection.style.display = shouldHide ? "none" : "";
}

function applySettingsToUI() {
    updateToggleUI();
    updateFontUI();

    if (letterSliderCtrl) letterSliderCtrl.setValue(currentSettings.letterSpacing);
    if (wordSliderCtrl) wordSliderCtrl.setValue(currentSettings.wordSpacing);

    updateLetterPreview();
    updateWordPreview();
    updateBgUI();
    updateTermsUI();
}

/* ---------- sliders ---------- */
function setupSlider(bar, circle, maxValue, initialValue, onChange) {
    let currentValue = initialValue || 0;

    function positionCircle() {
        const rect = bar.getBoundingClientRect();
        const knobWidth = circle.offsetWidth || 18;
        const maxX = rect.width - knobWidth;
        const ratio = maxValue ? currentValue / maxValue : 0;
        circle.style.left = `${maxX * ratio}px`;
    }

    requestAnimationFrame(positionCircle);

    bar.addEventListener("click", (e) => {
        const rect = bar.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        currentValue = Math.round((x / rect.width) * maxValue);
        onChange(currentValue);
        positionCircle();
    });

    window.addEventListener("resize", () => requestAnimationFrame(positionCircle));

    return {
        setValue(value) {
            currentValue = value;
            requestAnimationFrame(positionCircle);
        }
    };
}

/* ---------- presets ---------- */
function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    currentSettings = { ...currentSettings, ...preset };
    applySettingsToUI();
    saveSettingsToStorage();
}

/* ---------- terms gating ---------- */
function showTermsRequired() {
    if (!termsRequiredBanner) return;
    termsRequiredBanner.classList.add("show");
    scrollToSection(termsAcceptSection);
    setTimeout(() => termsRequiredBanner.classList.remove("show"), 3500);
}

function tryToggleExtension() {
    const isTryingToEnable = !currentSettings.enabled;

    if (isTryingToEnable && !currentSettings.acceptedTerms) {
        currentSettings.enabled = false;
        updateToggleUI();
        saveSettingsToStorage();
        showTermsRequired();
        return;
    }

    currentSettings.enabled = !currentSettings.enabled;

    // if turning ON successfully, mark dismissed but do NOT hide immediately this session
    if (currentSettings.enabled && currentSettings.acceptedTerms) {
        currentSettings.termsDismissed = true;
        sessionJustDismissedTerms = true; // prevents instant hide
    }

    updateToggleUI();
    // DO NOT call updateTermsUI here if you want zero visual changes.
    // But we still keep it consistent (it won't hide because sessionJustDismissedTerms=true).
    updateTermsUI();
    saveSettingsToStorage();
}

// supports BOTH checkbox UI and mini-toggle UI
function setTermsAccepted(nextValue) {
    currentSettings.acceptedTerms = !!nextValue;

    if (!currentSettings.acceptedTerms) {
        currentSettings.enabled = false;
        currentSettings.termsDismissed = false;
        sessionJustDismissedTerms = false;
    }

    updateTermsUI();
    updateToggleUI();
    saveSettingsToStorage();
}

function toggleTermsAccepted() {
    setTermsAccepted(!currentSettings.acceptedTerms);
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", () => {
    // reset per-open session flag
    sessionJustDismissedTerms = false;

    popupContainer = document.getElementById("popupContainer");

    mainViewEl = document.getElementById("mainView");
    termsViewEl = document.getElementById("termsView");
    backBtn = document.getElementById("backBtn");

    openTermsInline = document.getElementById("openTermsInline");
    if (openTermsInline) openTermsInline.addEventListener("click", showTerms);
    if (backBtn) backBtn.addEventListener("click", showMain);

    // Main toggle
    toggleEl = document.getElementById("mainToggle");

    // Inputs
    fontSelectEl = document.getElementById("fontSelect");
    letterBar = document.getElementById("letterBar");
    wordBar = document.getElementById("wordBar");
    letterCircle = document.getElementById("letterCircle");
    wordCircle = document.getElementById("wordCircle");

    fontPreviewText = document.getElementById("fontPreviewText");
    letterPreviewText = document.getElementById("letterSpacingPreview");
    wordPreviewText = document.getElementById("wordSpacingPreview");

    letterValueEl = document.getElementById("letterValue");
    wordValueEl = document.getElementById("wordValue");

    colorOptions = document.querySelectorAll(".color-option");
    resetBtn = document.getElementById("resetBtn");
    saveIndicatorEl = document.getElementById("saveIndicator");

    presetButtons = document.querySelectorAll(".preset-btn");

    // Terms refs (support both designs)
    termsAcceptSection = document.getElementById("termsAcceptSection");
    termsToggle = document.getElementById("termsToggle");       // old mini-toggle
    termsCheckbox = document.getElementById("termsCheckbox");   // new checkbox (your screenshot)
    termsRequiredBanner = document.getElementById("termsRequiredBanner");

    chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };

        // sliders
        if (letterBar && letterCircle) {
            letterSliderCtrl = setupSlider(letterBar, letterCircle, 10, currentSettings.letterSpacing, (value) => {
                currentSettings.letterSpacing = value;
                updateLetterPreview();
                saveSettingsToStorage();
            });
        }

        if (wordBar && wordCircle) {
            wordSliderCtrl = setupSlider(wordBar, wordCircle, 30, currentSettings.wordSpacing, (value) => {
                currentSettings.wordSpacing = value;
                updateWordPreview();
                saveSettingsToStorage();
            });
        }

        applySettingsToUI();
        setSaveState("saved");

        // Apply once on open (counts as user gesture => activeTab allowed)
        scheduleApplyToActiveTab();
    });

    // Main toggle events
    if (toggleEl) {
        toggleEl.addEventListener("click", tryToggleExtension);
        toggleEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tryToggleExtension();
            }
        });
    }

    // Font change
    if (fontSelectEl) {
        fontSelectEl.addEventListener("change", () => {
            currentSettings.font = fontSelectEl.options[fontSelectEl.selectedIndex].text.trim();
            updateFontUI();
            saveSettingsToStorage();
        });
    }

    // Background buttons
    colorOptions.forEach(btn => {
        btn.addEventListener("click", () => {
            const label = btn.textContent.trim();
            currentSettings.bgColor = BG_COLORS[label] || "#ffffff";
            currentSettings.bgEnabled = label !== "White";
            updateBgUI();
            saveSettingsToStorage();
        });
    });

    // Presets
    presetButtons.forEach(btn => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));

    // Reset (keep terms state)
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            const accepted = !!currentSettings.acceptedTerms;
            const dismissed = !!currentSettings.termsDismissed;

            currentSettings = { ...DEFAULT_SETTINGS, acceptedTerms: accepted, termsDismissed: dismissed };
            applySettingsToUI();
            saveSettingsToStorage();
        });
    }

    // Terms acceptance (checkbox)
    if (termsCheckbox) {
        termsCheckbox.addEventListener("change", () => setTermsAccepted(termsCheckbox.checked));
    }

    // Terms acceptance (old mini-toggle)
    if (termsToggle) {
        termsToggle.addEventListener("click", toggleTermsAccepted);
        termsToggle.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleTermsAccepted();
            }
        });
    }
});
