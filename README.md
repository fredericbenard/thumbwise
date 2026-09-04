# Thumbwise

A guided thumb-ergotherapy web app. It walks you through a five-exercise
routine — one exercise per screen, with hold timers, repetition counters, and
figure photos — and keeps track of how many sessions you have finished today
against a daily goal of 3–4.

It is a plain static site: no build step, no dependencies, no backend. All
state lives in the browser's `localStorage`.

## The routine

| # | Exercise | Type | Hold | Reps |
|---|----------|------|------|------|
| 1 | Thumb into the palm | timed hold | 10 s | 5–10 |
| 2 | Thumb to each finger | tap sequence | — | 10–15 |
| 3 | Thumb in an L | timed hold | 10 s | 5–10 |
| 4 | Clothespin pinch | timed hold | 3–5 s (selectable) | 10–15 |
| 5 | Squeeze a ball | timed hold | 3–5 s (selectable) | 10–15 |

Each exercise also shows the original French instruction it was transcribed
from, so it can be checked against the therapist's sheet.

### How a session flows

- **Home** shows today's session count as dots, plus the sound and theme
  toggles, and a *Start a session* button.
- **Timed holds** run a countdown ring. When it reaches zero the rep is
  counted, a chime and a short vibration fire, and a brief rest (1.6 s) runs
  before the next rep is armed.
- **The tap sequence** (exercise 2) advances one step per tap — index, middle,
  ring, pinky, then a slide down the pinky. The full pass counts as one rep.
- You can move on once the exercise's **minimum** reps are reached; hitting the
  **maximum** marks it complete automatically. Reaching the max on the last
  exercise ends the session.
- **Done** increments today's counter and tells you where you stand against the
  3–4 goal.

## Features

- **Daily tracker** — session count keyed to the calendar date, so it resets on
  its own each day.
- **Sound and haptics** — a short Web Audio chime per rep plus
  `navigator.vibrate` where supported. Toggleable, and the choice is persisted.
- **Theme switch** — `Auto` follows the system preference, `Pale` and `Dark`
  override it. The browser chrome colour follows via the `theme-color` meta tag.
- **Installable** — a web app manifest with `display: standalone`, an SVG icon,
  and iOS web-app meta tags, so it can be added to a phone home screen. Note
  there is no service worker yet, so it is *not* usable fully offline.

## Running it

`app.js` is loaded as an ES module and the manifest is fetched relatively, so
opening `index.html` as a `file://` URL will not work — it needs to be served
over HTTP. Any static file server will do; from the repository root:

```bash
# Python (bundled with macOS and most Linux distributions)
python3 -m http.server 8000
```

```bash
# Node, no install needed
npx serve .
```

```bash
# PHP
php -S localhost:8000
```

Then open <http://localhost:8000/>.

### Testing on a phone

The app is designed for a phone screen, and installing it or testing vibration
is easier on the real device. Serve on all interfaces and browse to your
machine's LAN address:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# then visit http://<your-computer-ip>:8000/ from the phone
```

Note that installing as a PWA generally requires a secure context —
`localhost` counts, a plain-HTTP LAN address does not — so for the full
install experience use a tunnel that terminates TLS (`ngrok http 8000`, `cloudflared tunnel --url http://localhost:8000`, or similar).

### Deploying

Because it is entirely static, the repository can be published as-is to GitHub
Pages, Netlify, Cloudflare Pages, or any static host — no build command, and
the output directory is the repository root.

## Layout

```
index.html      markup shell, meta tags, font and asset links
app.js          exercise data, session state machine, timers, rendering
styles.css      design tokens (light + dark) and all component styles
manifest.json   PWA manifest
favicon.svg     app icon
figures/        photo for each exercise
```

`app.js` re-renders by replacing `#app`'s inner HTML on each state change; the
countdown ring is the one exception, patched in place on a 50 ms interval so
the animation stays smooth.

### Editing the routine

The exercises are a single `EXERCISES` array at the top of `app.js`. Each entry
carries its `title`, the original French `original` line, a `detail`
instruction, `hold` seconds (or `null`), `repsMin`/`repsMax`, a `type` of
`"hold"` or `"sequence"`, and a `figure` key into the `FIGURES` map. Adding an
exercise means adding an entry and a matching figure — no other changes needed.

Both `styles.css` and `app.js` are linked with a `?v=N` cache-busting query
parameter in `index.html`; bump it when deploying a change so returning users
do not get a stale cached copy.
