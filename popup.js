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

/** ✅ Return false for pages we are not allowed to access */
function isInjectableUrl(url) {
  if (!url || typeof url !== "string") return false;

  // Block Chrome internal pages + extension pages
  const blockedSchemes = ["chrome://", "edge://", "about:", "brave://", "opera://", "chrome-extension://"];
  if (blockedSchemes.some(s => url.startsWith(s))) return false;

  // Chrome Web Store blocks extensions
  if (url.startsWith("https://chrome.google.com/webstore")) return false;
  if (url.startsWith("https://chromewebstore.google.com")) return false;

  // Most normal pages
  return url.startsWith("http://") || url.startsWith("https://");
}

/* ✅ Apply changes instantly to the active tab, but skip blocked pages */
function scheduleApplyToActiveTab() {
  if (applyTimer) clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyToActiveTab(), 60);
}

function applyToActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;

    if (!isInjectableUrl(tab.url)) {
      // Avoid "Cannot access a chrome:// URL"
      return;
    }

    // First try messaging content script
    chrome.tabs.sendMessage(tab.id, { type: "APPLY_SETTINGS", settings: currentSettings }, () => {
      // If no listener yet, ignore error and then inject
      const hadNoReceiver = !!chrome.runtime.lastError;

      if (!hadNoReceiver) return;

      // Inject CSS then JS then message again
      chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] }, () => {
        // swallow insertCSS errors too
        if (chrome.runtime.lastError) return;

        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
          if (chrome.runtime.lastError) return;

          chrome.tabs.sendMessage(tab.id, { type: "APPLY_SETTINGS", settings: currentSettings }, () => {
            // swallow final sendMessage error
            void chrome.runtime.lastError;
          });
        });
      });
    });
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

  // ✅ Hide terms section only AFTER user turns ON successfully once
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

  currentSettings.enabled = !currentSettings.enabled;

  // ✅ Only when turning ON (and accepted), we "dismiss" the terms section
  if (currentSettings.enabled && currentSettings.acceptedTerms) {
    currentSettings.termsDismissed = true;
  }

  updateToggleUI();
  updateTermsUI();
  saveSettingsToStorage();
}

function onTermsCheckboxChanged() {
  currentSettings.acceptedTerms = !!termsCheckbox.checked;

  // If unchecked, force OFF and show terms again
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

  termsAcceptSection = document.getElementById("termsAcceptSection");
  termsCheckbox = document.getElementById("termsCheckbox");
  termsRequiredBanner = document.getElementById("termsRequiredBanner");

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

    // apply on open (only if tab is allowed)
    scheduleApplyToActiveTab();
  });

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

  if (termsCheckbox) termsCheckbox.addEventListener("change", onTermsCheckboxChanged);
});
