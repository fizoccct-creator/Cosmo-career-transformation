# Designing in Figma

The app is built so you can design it in Figma and drop the results in without changing the logic.
Everything visual comes from three places:

1. **`public/styles/tokens.css`**: colours, fonts, type sizes, corner radius, spacing, button sizes
2. **Artwork slots**: images you export from Figma and point to in `tokens.css`
3. **AI prompts**: the look of the portraits themselves (see the last section)

## Suggested Figma setup

Main kiosk frame: **1920 × 1080** (landscape). Optional: 1080 × 1920 for a portrait screen.

| Figma frame | Screen in the app | Notes |
|---|---|---|
| 01 Welcome | `screen-welcome` | Headline left, big illustration right (`--art-welcome`) |
| 02 Consent | `screen-consent` | Text + BACK / I AGREE |
| 03 Photo – live | `screen-photo` | Camera box is **4:5** on the left, instructions + TAKE PHOTO on the right |
| 03b Photo – review | `screen-photo` | Same layout, CONTINUE + RETAKE |
| 04 Question (AR) | `screen-quiz.ar` | Live camera full-screen; question banner top; 4 answer cards float around the face (above head / below chin / left / right), each with a yellow gesture chip (↑ LOOK UP etc.); BACK and DISCOVER MY CAREER bottom. Card size: `--ar-card-width`, `--text-ar-option`, `--text-ar-question` |
| 04b Question (touch fallback) | `screen-quiz` | Question top, 4 answer cards in a 2×2 grid, BACK bottom-left, DISCOVER MY CAREER bottom-right (question 5 only) |
| 05 Loading | `screen-loading` | Round photo + spinning ring left (`--art-loading`), text right |
| 06 Result | `screen-result` | Portrait **4:5** left, title + description + PLAY AGAIN right |
| 07 Error | `screen-error` | "We couldn't create your portrait": START OVER / TRY AGAIN |
| Idle | `.idle` | "Still there?" overlay |

Text content (headlines, button labels, questions) is **not** in the design files. It lives in `public/content.json`, so you can design with real copy and edit the wording in one place.

## Tokens to match in Figma

Create Figma variables or styles with the same names, then copy the values into `tokens.css`:

- **Colour:** `--color-primary` #202959 · `--color-accent` #FDD00D · `--color-text` #FFFFFF · plus deep/soft blue and muted text
- **Type:** `--font-display`, `--font-body`, and sizes `--text-hero`, `--text-title`, `--text-question`, `--text-lead`, `--text-option`, `--text-button`, `--text-small`
  - Sizes are fluid: `clamp(min, preferred, max)`. For a 1920-wide frame, the **max** value is what you'll see.
- **Shape:** `--radius-lg`, `--radius-md`, `--radius-pill`, `--border-strong`
- **Touch:** `--button-height` (≥ 64 px), `--option-min-height`

To use a font other than Montserrat, change the Google Fonts link in `index.html` and `--font-display` / `--font-body`. For an offline kiosk, put the font files in `public/assets/brand/` and add an `@font-face` rule in `tokens.css`.

## Artwork slots

Export from Figma (PNG at 2×, or SVG) into `public/assets/brand/`, then set the slot in `tokens.css`:

```css
--bg-image: url("../assets/brand/background.png");     /* full-screen background, 1920×1080 */
--art-welcome: url("../assets/brand/welcome.png");     /* welcome illustration (hides the placeholder circle) */
--art-logo: url("../assets/brand/logo.png");           /* top-right logo */
--art-loading: url("../assets/brand/loading.png");     /* behind the loading photo */
```

## AI portrait look

The AI portrait's style is set by the text prompts in `content.json` (`careers.*.aiPrompt` and `aiPromptRules`), not by Figma. Once you have the visual direction, describe it in words there, for example "warm golden lighting, Cosmo blue and yellow accents in the set".
