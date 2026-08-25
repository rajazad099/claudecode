# THE FITTING ROOM — frame finder quiz

`PS-003 // PROJECT SHADES`

Six questions, about a minute, and the customer walks out with frames chosen
for their face rather than for the algorithm's convenience. A face silhouette
and a pair of lenses are drawn in SVG on the left; both morph as they answer.
The face becomes their face shape. The lenses become the frame being
recommended. At the end the drawn pair resolves into real products from the
store.

<img src="../preview/quiz-question.jpg" width="520" alt="Question screen"> <img src="../preview/quiz-mobile.jpg" width="240" alt="Mobile">

**No app, no subscription, no monthly fee.** One section, one stylesheet, one
script. Nothing leaves the browser.

## Files

| File | |
| --- | --- |
| `sections/shades-quiz.liquid` | The section, the product index and the theme-editor schema |
| `assets/shades-quiz.css` | The room, the stage and the panel |
| `assets/shades-quiz.js` | The fitting logic and the whole interface |
| `preview/quiz.html` | Static preview — open in a browser, no store needed |

## Install

1. **Online Store → Themes → ⋯ → Edit code**
2. **Assets → Add a new asset** → upload `shades-quiz.css` and `shades-quiz.js`
3. **Sections → Add a new section** → name it `shades-quiz` → paste in `sections/shades-quiz.liquid`
4. **Customize → Add section → Shades fitting quiz**

It works with zero configuration. Every collection it reads is already
pre-filled with the handle this store uses.

Where to put it: its own page (`/pages/find-your-frames`) linked from the nav
is the usual answer, because it wants the whole screen. It also works dropped
on the home page under the hero.

## How it decides

**It does not read tags.** The catalogue is essentially untagged — 5 products
out of 277 carry one — so tags would have produced a quiz that recommended the
same four frames to everyone. Traits come from **collection membership**, read
through `product.collections` at render time.

That has a useful consequence: **the quiz re-merchandises itself.** Put a frame
in `techno` and it starts being offered to people who pick the techno
aesthetic. Pull it from `bestsellers` and it stops getting the popularity
nudge. No re-tagging, no re-coding, no re-deploying.

These collections are wired in already:

| Signal | Collections |
| --- | --- |
| Frame shape | Rectangular, Oval, Round, Cateye, Rimless, Wraparound, Oversized |
| Aesthetic | Vintage, Techno, Daily Luxe, Code, Ice Ice Baby |
| Use case | Prescription Friendly, Polarised Sports |
| Confidence | Bestsellers, Staff picks, Markdowns, Buy any 3 |

Each is a setting, so if a collection is renamed or replaced, re-point it in the
theme editor rather than in code.

The product **title** is read too, for the shape words collections don't carry —
aviator, hexagon, butterfly, slim, chunky, Y2K, retro. Including `Overized`,
which is a live typo in the catalogue and is matched deliberately.

### The fitting table

The rule is contrast, not echo: you give a face the geometry it hasn't got.

| Face | Pushed toward | Pushed away from |
| --- | --- | --- |
| Round | Rectangular, cat-eye, wraparound, hexagon | Round, oval |
| Square | Round, oval, rimless, aviator | Rectangular, wraparound |
| Oval | Everything — scored on aesthetic instead | — |
| Heart | Rimless, round, oval, aviator | Oversized |
| Long | Oversized, wraparound, round | Slim, rimless |
| Diamond | Cat-eye, oval, rimless, round | Rectangular |

Fit is weighted **3×** above aesthetic and popularity. That matters: without it
a bestseller in the wrong shape outranks the right shape, which is the one
failure a fitting quiz cannot afford. Bestsellers now only break near-ties.

### The width question

Nobody owns a pupillometer, so the quiz never asks for a measurement. It asks
how sunglasses *currently sit*:

- *They slide down my nose* → the frame is too wide → slim frames, oversized penalised
- *They press on my temples* → too narrow → oversized and wraparound promoted
- *They look small on me* → statement widths

### Colourways

`[ Apollo ] Rectangular Unisex Sunglasses : Black` — the house naming
convention is load-bearing. The alias in brackets is what stops four colourways
of one frame from filling the entire result. Results show one row per alias with
a *"5 colourways"* note, so the customer still learns the other colours exist.

## What the customer gets

An alias in the house style — `[ THE ARCHIVIST ]`, `[ THE OPERATOR ]`,
`[ THE ICON ]`, `[ THE GLACIER ]`, `[ THE SPRINTER ]`, `[ THE REGULAR ]`,
`[ THE PURIST ]` — then a plain-English verdict explaining *why* that shape
suits that face, a spec read-out of the four inputs used, and the frames
themselves with the best fit flagged.

The explanation is the point. A quiz that just spits out products reads as a
sales funnel; one that tells you a strong jaw is already doing the geometry
reads as a fitting.

## Details worth knowing

- **Skipping is handled.** "Not sure" on the face question asks about the
  jawline instead, which most people can answer, and infers the shape from it.
- **The stage answers before you click.** Hovering or focusing an option
  previews the consequence — the face morphs, the frame changes.
- **Out of stock** frames are hidden by default and can be shown instead.
  Availability is scored, not assumed; plenty of active products sit at zero.
- **Prescription is a hard filter.** Answer yes and only glazable frames appear.
- **Budget is a soft ceiling.** A perfect fit slightly over still surfaces
  rather than vanishing, because a near-miss beats an empty result.
- **The result is remembered** in `localStorage` — returning visitors are
  offered it back. Nothing is transmitted anywhere.
- **Analytics.** `psq:start`, `psq:answer` and `psq:complete` fire as DOM events
  on the section and are pushed to `window.dataLayer` when GTM is present. The
  complete event carries the face shape, archetype and product handles.

## Settings worth knowing

| Setting | Notes |
| --- | --- |
| Frames to recommend | 2–8, default 4 |
| Hide sold-out frames | On by default |
| Frames read per collection | 40 covers this catalogue; raise for better matches, lower for a lighter page |
| Fallback collection | Linked when a fitting is too narrow, and from the no-JavaScript message |
| Lens tint | The one colour on the stage |
| Collection pickers | Re-point any signal without touching code |

The questions and the scoring live in `assets/shades-quiz.js`, in two clearly
marked blocks at the top of the file — `FIT` and `QUESTIONS`. Both are plain
data. Change the numbers to change the recommendations.

## Verified

Headless Chromium, `preview/quiz.html` against a live 178-frame snapshot of the
catalogue:

- **All 6,480 answer combinations** (6 faces × 4 fits × 6 aesthetics × 5
  use-cases × 3 lens answers × 3 budgets) return results. The thinnest returns
  32 frames; the average is 68. No combination dead-ends.
- **Every face shape returns only on-doctrine frames** in its top four.
- **35 different frames** take the top slot across those runs, the most frequent
  at 14.6% — no single product dominates the quiz.
- Prescription filter: 100% of results glazable. Sold-out filter: no leaks.
  Colourway dedupe: no repeated alias in any result.
- No horizontal overflow at 320 / 360 / 390 / 414 / 430 / 768 / 1024 / 1440 /
  1920 px. No tap target under 44px. No console errors.
- Keyboard: arrow keys walk the options, Enter selects, the question takes focus
  on each step.
- Under `prefers-reduced-motion: reduce`: zero animating elements, grain removed.
- Back button re-plans correctly, including backing out of a skipped question.

The preview's product images load from the Shopify CDN, so they appear when you
open it on a normal connection.
