# Discover Your Creative Career (Cosmo Career Transformation)

A full-screen touchscreen kiosk experience. The visitor:
1. takes a photo,
2. answers 5 questions,
3. gets an AI-generated portrait of themselves as a **Photographer, Videographer, Graphic Designer or Content Creator**.

```
Welcome → Consent → Photo (3-2-1 countdown) → 5 questions → "Creating your portrait…" → Result → back to Welcome
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

Use `node server.js`, not VS Code's "Live Server" or "Go Live". The AI portrait needs this server, and Live Server would run the app without it, so you'd only get the template portrait.

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
- **If AI fails** (no internet, quota used up, timeout after 60 s), the visitor automatically gets the **template portrait** instead. They never see an error.

## The two kinds of portrait

| | AI portrait | Template portrait (fallback) |
|---|---|---|
| How | Gemini redraws the person in a career scene | The person is cut out of the photo and placed on a career scene |
| Needs | Internet + API key + `node server.js` | Nothing; works offline |
| Speed | ~10–30 s | ~1–2 s |
| Look | Set by the prompts in `content.json` | Set by your Figma scenes in `public/assets/careers/` |

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
public/js/portrait.js         AI portrait + template fallback
public/assets/careers/        career scenes for the template portrait (placeholders for now)
public/vendor/selfie_segmentation/   Google MediaPipe cut-out model (Apache 2.0), bundled so it works offline
```
