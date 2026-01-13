const DEFAULT_SETTINGS = {
    enabled: false,
    font: "Original Font",
    letterSpacing: 0,
    wordSpacing: 0,
    bgEnabled: false,
    bgColor: "#ffffff",
    acceptedTerms: false,

    // ✅ NEW: only becomes true after user successfully turns ON the extension once
    // This is what hides the terms section (not the checkbox action).
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

let popupContainer;
let mainViewEl, termsViewEl, backBtn;
let openTermsInline, openTermsFooter;

let toggleEl, fontSelectEl;
let letterBar, wordBar, letterCircle, wordCircle;
let fontPreviewText, letterPreviewText, wordPreviewText;
let letterValueEl, wordValueEl;
let colorOptions;
let resetBtn;
let saveIndicatorEl;

let presetButtons;

let termsAcceptSection;
let termsCheckbox;
let termsRequiredBanner;

let letterSliderCtrl, wordSliderCtrl;
let savedTimer;
let applyTimer;

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

/* ✅ Apply changes instantly to the active tab (no refresh needed, even first time) */
function scheduleApplyToActiveTab() {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => applyToActiveTab(), 60);
}

function applyToActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;

        // First try messaging the content script (if already injected)
        chrome.tabs.sendMessage(
            tab.id,
            { type: "APPLY_SETTINGS", settings: currentSettings },
            () => {
                // If content script not present yet (common on first install), inject it
                if (chrome.runtime.lastError) {
                    chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] }, () => {
                        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
                            // Try again after injection
                            chrome.tabs.sendMessage(tab.id, { type: "APPLY_SETTINGS", settings: currentSettings }, () => { });
                        });
                    });
                }
            }
        );
    });
}

function saveSettingsToStorage() {
    setSaveState("saving");
    if (savedTimer) clearTimeout(savedTimer);

    chrome.storage.local.set(currentSettings, () => {
        savedTimer = setTimeout(() => setSaveState("saved"), 150);
        scheduleApplyToActiveTab();
    });
}

/* scroll inside popup container */
function scrollToSection(el) {
    if (!popupContainer || !el) return;

    const containerRect = popupContainer.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const currentScroll = popupContainer.scrollTop;
    const offsetTop = (elRect.top - containerRect.top) + currentScroll;

    const target = Math.max(0, offsetTop - 12);
    popupContainer.scrollTo({ top: target, behavior: "smooth" });
}

/* ===== Views ===== */
function showTerms() {
    mainViewEl.classList.remove("active-view");
    termsViewEl.classList.add("active-view");
    termsViewEl.setAttribute("aria-hidden", "false");
    mainViewEl.setAttribute("aria-hidden", "true");

    popupContainer.classList.add("lock-scroll");
    popupContainer.scrollTop = 0;
}

function showMain() {
    termsViewEl.classList.remove("active-view");
    mainViewEl.classList.add("active-view");
    mainViewEl.setAttribute("aria-hidden", "false");
    termsViewEl.setAttribute("aria-hidden", "true");

    // ✅ FIX: unlock scrolling again
    popupContainer.classList.remove("lock-scroll");
}

/* ===== UI Updates ===== */
function updateToggleUI() {
    const canEnable = !!currentSettings.acceptedTerms;

    if (currentSettings.enabled && canEnable) {
        toggleEl.classList.add("active");
        toggleEl.setAttribute("aria-checked", "true");
    } else {
        toggleEl.classList.remove("active");
        toggleEl.setAttribute("aria-checked", "false");
    }
}

function updateFontUI() {
    const options = Array.from(fontSelectEl.options);
    const index = options.findIndex(opt => opt.text.trim() === currentSettings.font);
    if (index >= 0) fontSelectEl.selectedIndex = index;
    fontPreviewText.style.fontFamily = getFontFamily(currentSettings.font);
}

function updateLetterPreview() {
    letterPreviewText.style.letterSpacing = `${currentSettings.letterSpacing}px`;
    if (letterValueEl) letterValueEl.textContent = `${currentSettings.letterSpacing} px`;
}

function updateWordPreview() {
    wordPreviewText.style.wordSpacing = `${currentSettings.wordSpacing}px`;
    if (wordValueEl) wordValueEl.textContent = `${currentSettings.wordSpacing} px`;
}

function updateBgUI() {
    colorOptions.forEach(btn => {
        const label = btn.textContent.trim();
        const color = BG_COLORS[label] || "#ffffff";
        if (currentSettings.bgEnabled && currentSettings.bgColor === color) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

function updateTermsUI() {
    if (!termsAcceptSection || !termsCheckbox) return;

    // checkbox reflects acceptance
    termsCheckbox.checked = !!currentSettings.acceptedTerms;

    // ✅ Hide terms section ONLY AFTER the user successfully turns ON the extension once
    if (currentSettings.termsDismissed) {
        termsAcceptSection.classList.add("hidden");
    } else {
        termsAcceptSection.classList.remove("hidden");
    }
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

/* ===== Slider setup ===== */
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

    bar.addEventListener("click", e => {
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

function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    currentSettings = { ...currentSettings, ...preset };
    applySettingsToUI();
    saveSettingsToStorage();
}

/* ===== Terms gating ===== */
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

    // Toggle state
    currentSettings.enabled = !currentSettings.enabled;

    // ✅ If turning ON and terms accepted -> hide terms section now (not on checkbox click)
    if (currentSettings.enabled && currentSettings.acceptedTerms) {
        currentSettings.termsDismissed = true;
    }

    updateToggleUI();
    updateTermsUI();
    saveSettingsToStorage();
}

function onTermsCheckboxChanged() {
    currentSettings.acceptedTerms = !!termsCheckbox.checked;

    // If un-checked, force OFF + show section again
    if (!currentSettings.acceptedTerms) {
        currentSettings.enabled = false;
        currentSettings.termsDismissed = false;
    }

    applySettingsToUI();
    saveSettingsToStorage();
}

/* ===== Start ===== */
document.addEventListener("DOMContentLoaded", () => {
    popupContainer = document.getElementById("popupContainer");

    mainViewEl = document.getElementById("mainView");
    termsViewEl = document.getElementById("termsView");
    backBtn = document.getElementById("backBtn");

    openTermsInline = document.getElementById("openTermsInline");
    openTermsFooter = document.getElementById("openTermsFooter");

    if (openTermsInline) openTermsInline.addEventListener("click", showTerms);
    if (openTermsFooter) openTermsFooter.addEventListener("click", showTerms);

    backBtn.addEventListener("click", showMain);

    toggleEl = document.getElementById("mainToggle");

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

    // Terms
    termsAcceptSection = document.getElementById("termsAcceptSection");
    termsCheckbox = document.getElementById("termsCheckbox");
    termsRequiredBanner = document.getElementById("termsRequiredBanner");

    // Load settings
    chrome.storage.local.get(DEFAULT_SETTINGS, stored => {
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };

        letterSliderCtrl = setupSlider(letterBar, letterCircle, 10, currentSettings.letterSpacing, value => {
            currentSettings.letterSpacing = value;
            updateLetterPreview();
            saveSettingsToStorage();
        });

        wordSliderCtrl = setupSlider(wordBar, wordCircle, 30, currentSettings.wordSpacing, value => {
            currentSettings.wordSpacing = value;
            updateWordPreview();
            saveSettingsToStorage();
        });

        applySettingsToUI();
        setSaveState("saved");

        // ✅ Apply to active tab immediately when popup opens (helps first-time too)
        scheduleApplyToActiveTab();
    });

    // Events
    toggleEl.addEventListener("click", tryToggleExtension);
    toggleEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tryToggleExtension();
        }
    });

    fontSelectEl.addEventListener("change", () => {
        currentSettings.font = fontSelectEl.options[fontSelectEl.selectedIndex].text.trim();
        updateFontUI();
        saveSettingsToStorage();
    });

    colorOptions.forEach(btn => {
        btn.addEventListener("click", () => {
            const label = btn.textContent.trim();
            currentSettings.bgColor = BG_COLORS[label] || "#ffffff";
            currentSettings.bgEnabled = label !== "White";
            updateBgUI();
            saveSettingsToStorage();
        });
    });

    presetButtons.forEach(btn => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));

    resetBtn.addEventListener("click", () => {
        const accepted = !!currentSettings.acceptedTerms;
        const dismissed = !!currentSettings.termsDismissed;

        currentSettings = { ...DEFAULT_SETTINGS, acceptedTerms: accepted, termsDismissed: dismissed };
        applySettingsToUI();
        saveSettingsToStorage();
    });

    // ✅ checkbox accept handler
    termsCheckbox.addEventListener("change", onTermsCheckboxChanged);
});
