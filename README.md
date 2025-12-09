# Gesture-Based Browser Shortcuts (Chrome Extension)

Use simple mouse or touch gestures to control the browser: go Back/Forward, Reload, open a New Tab, and scroll to the top or bottom of the page.  
The extension overlays a non-blocking canvas on any webpage and runs a lightweight $1-style gesture recognizer.

---

## Features

**Supported gestures + actions**

- `◯` **Circle** → Reload current page  
- `>` **Arrow Right** → Go forward in history  
- `<` **Arrow Left** → Go back in history  
- `Z` **Z-shape** → Open a new tab (Google)  
- `^` **Arrow Up** → Scroll to top of page  
- `v` **Arrow Down** → Scroll to bottom of page  

**Design goals**

- **Non-blocking overlay**: The gesture canvas is `pointer-events: none`, so normal clicks, links, and scroll still work underneath.
- **Low-friction**: No custom UI chrome; a tiny HUD in the top-right shows status, metrics, and a one-line cheat sheet.
- **Lightweight recognizer**: A small $1-like recognizer (resampling + normalization + template matching) running entirely in the content script.
- **Accessibility motivation**: Inspired by users with motor impairments for whom mouse-path gestures are easier than small target clicks or key combos.

---

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right).
4. Click **Load unpacked**.
5. Select the folder that contains:
   - `manifest.json`
   - `background.js`
   - `content.js`
   - `content.css`

The extension will appear in your toolbar.

---

## Usage

1. Navigate to any website (e.g. a news site).
2. Click the **extension icon** once on that tab.
   - This injects the overlay + recognizer (`content.js` + `content.css`) into the page.
3. In the top-right, you’ll see a tiny panel:
   - A **checkbox** toggle: enable/disable gesture recognition.
   - A **live HUD**: last recognized gesture + score.
   - **Metrics**: number of gestures, recognition accuracy, and average latency.
   - A **cheat sheet**: `◯ Reload · ←/→ Back/Forward · Z New Tab · ↑ Top · ↓ Bottom`.

Now draw gestures anywhere on the page with the mouse (or touch):

- Draw a **big** clear gesture (small doodles are ignored).
- When a gesture is recognized and passes the score threshold, the mapped browser action executes and a toast message appears at the bottom of the screen.

---

## How It Works (High-Level)

### Architecture

- **`manifest.json`**  
  - Uses Manifest V3.  
  - Declares a background service worker and the extension action (toolbar icon).  
  - Requests `scripting` + `activeTab` permissions so it can inject scripts into the current page.

- **`background.js`**  
  - Listens for clicks on the extension icon.  
  - On click, injects `content.js` and `content.css` into the active tab via `chrome.scripting`.

- **`content.js`**  
  - Injects:
    - A fullscreen `<canvas>` overlay for drawing (non-blocking).
    - A small HUD/metrics panel in the top-right.
    - A toast at the bottom for feedback.
  - Handles mouse/touch events at the document level and feeds the sampled points into the recognizer.
  - Runs a $1-style recognizer:
    - Resamples the path to a fixed number of points.
    - Normalizes scale and translation (but keeps orientation so `>`, `<`, `^`, `v` are distinct).
    - Compares against template gestures using average pointwise distance.
  - Maps recognized gesture names to browser actions (`history.back()`, `history.forward()`, `location.reload()`, `window.open()`, `scrollTo`, etc.).
  - Adapts stroke color dynamically to contrast with the page background.

- **`content.css`**  
  - Styles only the overlay canvas, HUD panel, metrics, and toast.  
  - Uses very high `z-index` to float above the page without interfering with it.

---

## Recognition Details

- The recognizer uses **fixed-length point sequences** (e.g., 96 points per gesture).
- Gestures are **scaled and translated**, but **orientation is preserved**, so:
  - `>` vs `<` vs `^` vs `v` are treated as distinct.
- Each template is precomputed for:
  - `line-right`, `line-left`
  - `arrow-right`, `arrow-left`
  - `arrow-up`, `arrow-down`
  - `circle`
  - `z`
- The recognizer reports:
  - `name`: best-matching template
  - `score`: similarity in `[0,1]`
- An action only fires if `score` passes a configurable threshold (e.g. `0.75`), to reduce false positives.

---

## Micro-Evaluation (Quick Pilot Study Idea)

If you want a **lightweight evaluation** without a full user study, you can log and present:

- **Participants**: 3–5 classmates, laptop + external mouse, standard Chrome.
- **Tasks**: For each gesture (circle, left/right/up/down arrow, Z):
  - Perform a fixed number of trials (e.g. 10 repetitions per gesture).
- **Metrics**:
  - Recognition accuracy per gesture.
  - False positives (wrong gesture recognized).
  - Average recognition latency (ms) from stroke end to action.
- **Data collection**:
  - The extension already logs gesture name, score, duration, and success flag in memory / console.
- **Presentation**:
  - A simple table or bar chart with accuracy per gesture.
  - A short list of failure modes (e.g., up/down sometimes mistaken when drawn too shallow).

See the “Micro-Evaluation” notes in this README for how to summarize this on a single slide.

---

## Extending / Customizing

- To add a new gesture:
  1. Define a new template generator (e.g. `templateTriangle()`).
  2. Add it to the `TEMPLATES` array in `content.js`.
  3. Add a new case for the template name in `performAction(name)`.

- To tweak strictness:
  - Adjust the **global minimum score** (e.g. `MIN_SCORE = 0.75`).
  - Optionally define **per-gesture thresholds** if some gestures are more error-prone.

---

## Limitations / Future Work

- No formal accessibility study yet; current design is motivated by anecdotal needs.
- Only a small gesture vocabulary (6 gestures).
- No learning/personalization; templates are hand-crafted.
- Gesture set is tuned for **desktop Chrome**; mobile/tablet WebView support is untested.

Planned / potential future work:

- Add a visual gesture library UI to customize mappings.  
- Per-user template adaptation (record your own gestures and train on them).  
- Package as a public Chrome Web Store extension after polishing permissions and UX.

