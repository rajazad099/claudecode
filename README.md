# ENCORE WORLDWIDE — hero section

`EW-001 // DROP 001`

A drop-in Online Store 2.0 hero, built to the deck: black, white, chrome, with
blue rationed to five elements. Mobile-first, because 99% of visitors are.

<img src="preview/hero-mobile.jpg" width="300" alt="Mobile"> <img src="preview/hero-desktop.jpg" width="520" alt="Desktop">

*(The image is an abstract stand-in. Drop in a real film still to judge the art direction.)*

## Files

| File | |
| --- | --- |
| `sections/encore-hero.liquid` | The section + theme-editor schema |
| `assets/encore-hero.css` | All styling |
| `assets/encore-hero.js` | Video swap + off-screen pausing. Progressive enhancement only |
| `preview/index.html` | Static preview — open in a browser, no store needed |

## Install

1. **Online Store → Themes → ⋯ → Edit code**
2. **Assets → Add a new asset** → upload `encore-hero.css` and `encore-hero.js`
3. **Sections → Add a new section** → name it `encore-hero` → paste in `sections/encore-hero.liquid`
4. **Customize → Add section → Encore hero**, drag to the top

## How it follows the deck

**Colour.** Ink `#000000`, paper `#ffffff`, chrome `#c0c0c0`. No colour pickers
are exposed — *no new colors, ever* is a brand rule, so it's enforced in code
rather than left to a setting. Every uploaded image is forced to greyscale in
CSS, so the hero cannot go off-palette even by accident.

**The blue budget.** `#0154fd` appears in exactly five places, listed at the top
of the stylesheet: the live dot in the telemetry rail, the dot travelling the
orbit, the CTA arrow, one 300ms glitch frame on the headline at load, and the ✳
in the ticker. Together that's well under 5% of the frame.

**Type.** Anton is the shout — the headline. Space Mono is the paperwork — rail,
ticker, chips, button. Body copy inherits your theme font, which is the uniform.
Both webfonts load from Google Fonts and can be switched off if you self-host.

**Voice.** Defaults are lowercase, first person, no filler: *"small runs, made
because we wanted them. shipped worldwide. no restocks."* No emoji anywhere.

**Toolkit.** Orbit (one lap around everything), film grain, halftone-free hard
edges, the ticker (one per page), and hazard tape — tape ships **off**, since
the site's register is the quiet one.

## The motion

Everything is CSS transform/opacity, nothing runs on the main thread.

- **Push-in** — the still scales 1.10 → 1.00 over 24s
- **Line reveal** — each headline line rises out of a mask, 105ms apart
- **Chrome sweep** — silver travels across the `*asterisked*` line every 9s
- **Glitch** — two hard blue frames, ~300ms, once on load, then never again
- **Scanner** — a single hairline crosses the frame every 8s
- **Orbit** — a tilting ellipse with the blue dot running it
- **Grain** — 3-step film grain
- **Ticker** — marquee, pauses when the hero leaves the viewport

All of it is removed under `prefers-reduced-motion: reduce`, which also drops
the video and renders every element in its final state.

## Mobile specifics

- **Separate mobile crop.** `image_mobile` and `image_desktop` are distinct
  settings behind a `<picture>`, with independent focal points. Your current
  hero is a landscape frame in a portrait viewport — this is the fix.
- **Video is optional and never blocks.** The still is the LCP element; video
  loads with `preload="none"`, is chosen per breakpoint by JS, and fades in on
  `canplay`. It is skipped entirely on reduced-motion, data saver and 2G, and
  removed if autoplay is refused (low power mode).
- **Tap targets** — 48px button, 40px chips.
- **Category chips** put the six collections one thumb-tap from the hero.
- **No backdrop blur** anywhere; it's the most expensive thing you can put on a
  mid-range Android.
- Heights use `svh` with a `vh` fallback, so the browser chrome doesn't clip it.

## Settings worth knowing

| Setting | Notes |
| --- | --- |
| Headline | Enter for a new line. Wrap a whole line in `*asterisks*` for the chrome finish |
| Heading level | H1 when the hero is first on the page |
| Mobile / desktop focal point | Where the crop centres on each breakpoint |
| Content position | Bottom (default), centre, top |
| Darkening | Scrim over the photo — raise it if your still is bright |
| Telemetry rail | `EW-001 // DROP 001` · `LAT 19.99 / LON 73.78` · `LIVE` |
| Categories | Up to 8 blocks — the chip row |

## Verified

Headless Chromium at 320 / 360 / 390 / 414 / 430 / 768 / 1024 / 1440 / 1920 px:
no horizontal overflow, headline fits at every width, 48px and 40px tap targets
hold, ticker sits flush to the hero's bottom edge, no console errors. Checked
again with `prefers-reduced-motion: reduce`.

## One open item

**Gotham** is the uniform in the deck but it's a licensed Hoefler face and isn't
on Google Fonts, so body copy currently inherits whatever your theme is set to.
If you hold a Gotham web licence, add the files under **Assets** and point the
theme's body font at it — the section will follow automatically.
