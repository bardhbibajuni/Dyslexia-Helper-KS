# Dyslexia-Extension - Browser Extension

Dyslexia Helper is a browser extension created to improve reading accessibility on the web.  
It allows users to customize how text appears on any website by adjusting font type, spacing, and background color, making reading more comfortable for people with dyslexia or reading difficulties.

The extension works in real time, does not modify website content permanently, and stores user preferences locally.

---

## Features

- Turn the extension ON or OFF with a single toggle  
- Dyslexia-friendly fonts:
  - OpenDyslexic,
  - Lexend,

- Adjustable letter spacing,
- Adjustable word spacing,
- Optional background colors (white, beige, grey, blue),
- Live preview inside the popup interface,
- Changes apply instantly without page refresh,
- Preferences are saved automatically,
- Works on all websites

---

## Technologies Used

- HTML – popup interface structure  ,
- CSS – styling for popup and webpage content  ,
- JavaScript – logic, interaction, and state management  ,
- Chrome Extension API:
  - `chrome.storage.sync`
  - `content_scripts`
- Manifest Version 3

No external frameworks or libraries are used.

---

## Project Structure

- `
/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── content.js
├── styles.css
└── fonts/
    ├── OpenDyslexic-Regular.otf
    └── Lexend-Regular.ttf
  `
  
How It Works

popup.js
Handles the user interface, reads user input, updates previews, and saves settings.

content.js
Runs on every webpage, reads saved settings, and applies font, spacing, and background styles dynamically.

styles.css
Uses CSS variables and class-based overrides to safely apply styles on different websites.


Download & Installation (Developer Mode)

Option 1: Download as ZIP
Click the Code button on this repository,
Select Download ZIP,
Extract the ZIP file on your computer,

Option 2: Clone with Git
git clone https://github.com/bardhbibajuni/dyslexia-extension.git


Install the Extension in Chrome
Open Google Chrome,
Go to chrome://extensions,
Enable Developer mode (top-right corner),
Click Load unpacked
Select the project folder,
The extension will appear in the browser toolbar


Usage
Click the Dyslexia Extension icon,
Turn the extension ON,
Choose a font,
Adjust letter and word spacing,
Select a background color (optional),
Changes apply immediately,
Settings are saved automatically and reused on future visits


Target Users
People with dyslexia,
Students with reading difficulties,
Educators and academic users,
Anyone who prefers customizable reading environments


License
MIT License
Free to use, modify, and distribute.


Contributors:
Aulona Xhema,
Aurela Kajtazi,
Bardh Bibaj,
Bledar Morina

University of Prishtina “Hasan Prishtina”
