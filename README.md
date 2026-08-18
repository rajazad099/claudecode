# Encore hero — Shopify section

A drop-in hero section for **Encore Worldwide**: dark, futuristic, jewellery-first.
Built as an Online Store 2.0 section with no theme dependencies and no JavaScript libraries.

![Desktop](preview/hero-desktop.jpg)

<img src="preview/hero-mobile.jpg" width="280" alt="Mobile">

## What's in the box

| File | Purpose |
| --- | --- |
| `sections/encore-hero.liquid` | The section: markup + theme-editor schema |
| `assets/encore-hero.css` | All styling, driven by CSS custom properties |
| `assets/encore-hero.js` | Pointer parallax + off-screen animation pausing (optional) |
| `preview/index.html` | Static preview — open it in a browser, no Shopify needed |

## Install

1. Shopify admin → **Online Store → Themes → ⋯ → Edit code**.
2. **Assets → Add a new asset** → upload `assets/encore-hero.css` and `assets/encore-hero.js`.
3. **Sections → Add a new section** → name it `encore-hero` → replace the generated file with the contents of `sections/encore-hero.liquid`.
4. **Customize** → on your home page, **Add section → Encore hero**. Drag it to the top.

Or, with the [Shopify CLI](https://shopify.dev/docs/api/shopify-cli):

```bash
shopify theme dev --store encoreworldwide.myshopify.com
```

Copy `sections/` and `assets/` into your local theme first — the CLI syncs them live.

## The look

- **Cut-out product shot on a halo.** Two counter-rotating conic rings and a soft
  gold bloom sit behind the piece; the product floats and drifts with the cursor.
- **Word-by-word headline reveal.** Each word rises out of a mask on a stagger.
- **Liquid-metal accent words.** Wrap a word in asterisks — `the *next* century` —
  and it gets a gold→cyan→violet gradient with a slow shine sweep.
- **Atmosphere.** Drifting aurora, a perspective floor grid, film grain and a
  hairline HUD frame — each individually toggleable.
- **Marquee ticker** along the bottom for shipping, warranty and materials claims.

## Settings worth knowing

| Setting | Notes |
| --- | --- |
| Layout | `Split` (copy + product) or `Cinematic` (centred copy over a full-bleed background) |
| Heading | Press Enter for a hard line break; `*word*` for the metallic gradient |
| Heading level | Set to **H1** when the hero is the first section on the page |
| Product image | Use a PNG/WebP **cut-out with a transparent background** — this is the single biggest quality lever |
| Background video | Takes priority over the background image. Muted, looping, no controls |
| Colours | Accent 1 is the metal; accents 2 and 3 drive the halo and glow |
| Highlights | Up to 4 value/label blocks under the buttons |

## Notes

- **Motion.** Everything honours `prefers-reduced-motion: reduce` — animations are
  removed and all content renders in its final state. Ambient animation also pauses
  when the hero scrolls out of view.
- **No-JS.** `encore-hero.js` is progressive enhancement only. Without it you lose
  cursor parallax and the animated ghost-button border; nothing else changes.
- **Performance.** No libraries, no web fonts beyond the theme's own font picker.
  Background and product images ship with `srcset` and `fetchpriority="high"`.
- **Browser support.** Uses `color-mix()`, `@property`, `mask-image` and `svh` units
  (Chrome/Edge 111+, Safari 16.4+, Firefox 128+). Older browsers degrade to a flat
  dark hero with the same copy and buttons.

## Verified

Rendered in headless Chromium at 320 / 390 / 768 / 900 / 1024 / 1200 / 1440 / 1920 px:
no horizontal overflow, no console errors, headline holds its two-line composition
at every breakpoint.
