# GestureNav: Gesture-Based Browser Shortcuts (Chrome Extension)

GestureNav is a research prototype Chrome extension that enables browser navigation using simple mouse or touch gestures drawn directly on any webpage. The extension injects a non-blocking overlay and uses a lightweight, transparent `$1`-style recognizer to map gestures to common actions such as Back, Forward, Reload, New Tab, Scroll to Top, and Scroll to Bottom.

This repository contains the full source code for the system described in the accompanying project report.

---

## 📁 Project Structure
```text
Gesture-overlay-extension
│
├── manifest.json
│ Manifest V3 file declaring:
│ - Permissions (scripting, activeTab)
│ - Background service worker
│ - Entry points for scripts and assets
│
├── background.js
│ - Runs as a service worker.
│ - Listens for clicks on the extension toolbar icon.
│ - Injects content.js and content.css into the active tab using
│ chrome.scripting.executeScript and chrome.scripting.insertCSS.
│
├── content.js
│ Main functionality of GestureNav:
│ - Creates a fullscreen canvas overlay (pointer-events: none)
│ - Renders gesture strokes in real time
│ - Dynamically adapts stroke color based on page background
│ - Displays a HUD with:
│ • Last detected gesture + similarity score
│ • Gesture count, accuracy %, average latency
│ - Displays toast notifications for actions
│ - Captures mouse/touch events and collects gesture points
│ - Normalizes strokes and calls recognize(points) from recognizer.js
│ - Maps recognized gestures to browser actions:
│ • Back / Forward
│ • Reload
│ • New Tab (Google)
│ • Scroll to Top / Bottom
│
├── content.css
│ - Styles the overlay canvas, HUD panel, metrics, and toast messages.
│ - Ensures UI elements float above the page with very high z-index.
│
├── recognizer.js
│ Exposes the gesture recognizer:
│ - Resamples strokes to fixed-length point sequences (N = 96)
│ - Normalizes scale and centroid (orientation preserved)
│ - Includes templates for:
│ • Arrow-right (>)
│ • Arrow-left (<)
│ • Arrow-up (Λ)
│ • Arrow-down (∨)
│ • Circle
│ • Z-stroke
│ - Uses average pointwise distance for template matching
│ - Implements a hand-crafted circle heuristic
│ - Applies per-gesture confidence thresholds
│
└── icons/
- Extension icons (optional)
```

