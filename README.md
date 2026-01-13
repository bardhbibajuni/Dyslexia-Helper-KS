# Dyslexia Helper (Chrome Extension)

Dyslexia Helper makes websites easier to read by applying dyslexia-friendly fonts, spacing, and softer background colors.

## Features
- Fonts: Original, OpenDyslexic, Lexend, Comic Sans, Arial
- Letter spacing + word spacing controls
- Background color presets to reduce eye strain
- Quick presets: Default / Balanced / Strong
- One-time Terms & Conditions acceptance before enabling
- Settings saved locally in the browser

## How it works
The popup lets users choose readability settings. A content script applies those settings to the current page by updating CSS variables and page styles. Preferences are stored using `chrome.storage.local`.

## Permissions
- `storage` — save user settings (enabled state, font, spacing, background, terms acceptance)
- `activeTab` — apply settings to the currently active tab when the popup is used
- `scripting` — inject the content script/styles into the active tab if needed (first-time use)

> Note: Chrome blocks extensions from running on certain pages like `chrome://` and Chrome Web Store pages.

## Installation (Development)
1. Download or clone this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder

## Usage
1. Open the extension popup
2. Read Terms & Conditions
3. Check “I accept the Terms & Conditions”
4. Turn the extension ON
5. Pick a preset or customize settings

## Privacy
Dyslexia Helper does not collect, sell, or share personal data. All settings are stored locally in the browser using Chrome extension storage.

## Support
Email: DyslexiaHelper@gmail.com  
Issues: (add your GitHub issues link if you have one)

## Licenses
- Fonts: OpenDyslexic and Lexend are distributed under open font licenses (OFL).
- Code: choose a license (MIT recommended) and include a `LICENSE` file.
