# Discover Your Creative Career (Cosmo Career Transformation)

A full-screen touchscreen kiosk experience. The visitor:
1. takes a photo,
2. answers 5 questions,
3. gets an AI-generated portrait of themselves as a **Photographer, Videographer, Graphic Designer or Content Creator**.

```
Welcome → Consent → Photo (3-2-1 countdown) → 5 AR questions → "Creating your portrait…" → Result → back to Welcome
```

## AR quiz (answer with your head)

After the photo, the camera stays on. Each question's four answers float around the visitor's face:

| Answer position | Gesture |
|---|---|
| above the head | **look up** |
| below the chin | **look down** |
| left of the face | **tilt (or turn) left** |
| right of the face | **tilt (or turn) right** |

- Hold the gesture for about 0.65 s. A yellow bar fills on the card, then it's chosen. The visitor must face the screen again before the next answer counts.
- Up/down is measured against **each visitor's own neutral pose**, so someone who naturally looks down at the screen won't trigger "down" by accident.
- The four positions are **shuffled for every question**, so nobody can just "always look up".
- **Tapping a card always works too.** If face tracking can't start, the quiz falls back to a normal touch grid.
- If someone stands too close, the screen says "Step back a little so everything fits".
- **Tuning:** the `ar` section in `content.json` (`holdMs`, `tiltDegrees`, `lookUp`, `lookDown`). Add `?debug` to the URL (http://localhost:3000/?debug) to see live values while you test.
- **Fully offline face tracking:** the tracking code is bundled. The face model downloads from Google the first time. To keep it on the kiosk (recommended for events), run once:
  ```
  curl -L -o public/vendor/face_landmarker/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
  ```

## Run it on your Mac

You need **Node.js 18 or newer** (check with `node -v`; install from https://nodejs.org if needed). There's nothing else to install.

1. Open the folder in VS Code.
2. Open the terminal in VS Code (**Terminal → New Terminal**).
3. Run:
   ```
   node server.js
   ```
4. Open **http://localhost:3000** in Chrome.

Use `node server.js`, not VS Code's "Live Server" or "Go Live". The AI portrait needs this server; without it, portraits fail and a red staff warning appears.

## Turn on AI portraits (Google Gemini)

1. Get an API key at https://aistudio.google.com/apikey
2. Copy `.env.example` to a new file called `.env`, then fill in your key:
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Restart `node server.js`. The terminal should say **AI portraits: ON**.

- **Your key stays on the kiosk computer.** `.env` is in `.gitignore` and is never uploaded to GitHub. The browser never sees the key.
- **Cost:** each portrait is one paid Gemini image request. Check current pricing on Google's site and set a budget limit in Google AI Studio before an event.
- **Model name:** if the terminal shows "model not found", Google has renamed the model. Put the current image-model name in `.env` as `GEMINI_MODEL=...`.
- **The kiosk needs internet.** Portraits are AI only. If one can't be made (no internet, quota used up, Google's safety filter refuses the photo, or a timeout after 60 s), the visitor sees **"We couldn't create your portrait"** with **TRY AGAIN** (same photo and answers) or **START OVER**. The real reason is printed in the terminal; add `?debug` to the URL to see it on screen too.
- **Staff warning:** if there's no API key, or the page isn't opened through `node server.js`, a red bar on the welcome screen says so.

## Privacy

- A consent screen comes before the camera. Its wording changes depending on whether AI is on.
- The photo exists only in browser memory. With AI on, it's sent to Google to make the portrait. **Nothing is saved to disk.**
- The photo is wiped when the portrait appears, when someone presses Play Again, or after the idle timeout.

## Kiosk behaviour

- **Idle timeout:** after 60 s with no touch (90 s on the result screen), it shows "Still there?" with a 10-second countdown, then resets to Welcome and turns the camera off.
- **Ties:** the career with the most answers wins. If two tie, the one picked most recently wins.
- **Staff keys:** **F** = fullscreen, **Esc** = back to Welcome.
- **Full kiosk mode in Chrome** (no browser bars, Mac):
  ```
  open -a "Google Chrome" --args --kiosk --use-fake-ui-for-media-stream http://localhost:3000
  ```
  (`--use-fake-ui-for-media-stream` skips the camera permission pop-up. Only use it on the kiosk machine.)

## Changing words and questions

Everything the visitor reads is in **`public/content.json`**: headlines, buttons, the 5 questions, the 4 careers (title, description, scene image, AI prompt) and timings. Edit it and refresh the page.

## Design (Figma)

See **DESIGN.md**. Colours, fonts and sizes are in `public/styles/tokens.css`, and artwork slots are ready for your exports.

## Files

```
server.js                     kiosk server + Gemini connection (no npm install needed)
.env.example                  copy to .env and add your API key
public/index.html             the screens
public/content.json           all text, questions, careers, AI prompts, timings
public/styles/tokens.css      DESIGN TOKENS: colours, fonts, sizes, artwork slots
public/styles/app.css         layout (landscape first, portrait supported)
public/js/app.js              flow, camera, quiz, idle reset
public/js/portrait.js         asks the server for the AI portrait
public/js/ar-tracker.js       head tracking for the AR quiz (MediaPipe Face Landmarker)
public/vendor/tasks-vision/          Google MediaPipe face tracking (Apache 2.0), bundled
public/vendor/face_landmarker/       put face_landmarker.task here for offline AR (see above)
```
