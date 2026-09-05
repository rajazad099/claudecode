# THE FITTING ROOM — frame finder quiz

`PS-003 // PROJECT SHADES`

Six questions, about a minute, and the customer walks out with frames chosen
for their face rather than for the algorithm's convenience. A face silhouette
and a pair of lenses are drawn in SVG; both morph as they answer. The face
becomes their face shape. The lenses become the frame being recommended. At the
end the drawn pair resolves into real products from the store.

<img src="../preview/quiz-question.jpg" width="520" alt="Question screen"> <img src="../preview/quiz-mobile.jpg" width="240" alt="Mobile">

**No app, no subscription, no monthly fee.** One section, one stylesheet, one
script. Nothing leaves the browser.

## It looks like the rest of the store, by construction

The quiz declares almost no colours, typefaces or spacing of its own. It reads
the theme's own custom properties — `--color-background`, `--color-foreground`,
`--font-body-family`, `--font-heading-family`, `--buttons-radius`,
`--page-margin-desktop`, `--product-card-*` and the rest. Change a colour or a
font in the theme editor and the quiz moves with it. Nothing here needs
re-styling when the storefront is re-styled.

**The recommendations are the theme's own product cards.** They are not a
lookalike rebuilt in JavaScript — the section fetches `card-product` through
the Section Rendering API, so the results carry the same badges, price
formatting and sale highlighting as every collection page.

Every `var()` in the stylesheet carries a fallback matching the current theme
settings, so nothing collapses if a property is missing.

## Files

| File | |
| --- | --- |
| `sections/shades-quiz.liquid` | The section, the product index and the theme-editor schema |
| `sections/shades-quiz-card.liquid` | Renders one theme product card, fetched per result |
| `assets/shades-quiz.css` | Layout, drawn entirely from the theme's tokens |
| `assets/shades-quiz.js` | The fitting logic and the whole interface |
| `preview/quiz.html` | Static preview — open in a browser, no store needed |
| `preview/build-preview.py` | Regenerates the preview from the section, so the two cannot drift |
| `preview/liquid-test.js` | Renders the section through a real Liquid engine and asserts the product index is populated |

## Install

1. **Online Store → Themes → ⋯ → Edit code**
2. **Assets → Add a new asset** → upload `shades-quiz.css` and `shades-quiz.js`
3. **Sections → Add a new section** → name it `shades-quiz` → paste in `sections/shades-quiz.liquid`
4. **Sections → Add a new section** → name it `shades-quiz-card` → paste in `sections/shades-quiz-card.liquid`
5. **Customize → Add section → Shades fitting quiz**

Step 4 is what makes the results use your own product cards. Skip it and the
quiz still works — it falls back to a simple built-in card built from the same
theme tokens — but the cards will not carry your badges or sale styling.

It works with zero configuration otherwise. Every collection it reads is already
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

These nineteen collections are wired in already:

| Signal | Collections |
| --- | --- |
| Frame shape | Rectangular, Oval, Round, Cateye, Rimless, Wraparound, Oversized, Geometric |
| Who it's for | Men, Women |
| Frame size | Small Face Types, Medium Face Type, Large Face Types |
| Aesthetic | Daily Luxe, Summer Is Coming, Techno, Vintage |
| Use case | Polarised Sports |
| Candidate pool only | Sale |

Shape, size and vibe are the three the customer is actually asked about, and
they are the three the shelf is built from. Gender is a strong lean rather than
a filter — plenty of frames sit in both collections and a few sit in neither,
and none of those should become unreachable.

Each is a setting, so if a collection is renamed or replaced, re-point it in the
theme editor rather than in code.

The product **title** is read too, for the shape words collections don't carry —
aviator, hexagon, butterfly, slim, chunky, Y2K, retro. Including `Overized`,
which is a live typo in the catalogue and is matched deliberately. A polarised
sports frame is also treated as a wraparound, because that is what the category
physically is.

### What the quiz learns

Every link on the result carries UTM attribution
(`utm_source=fitting-room&utm_medium=quiz&utm_content=<profile>`), so Shopify's
own analytics can say which frames the quiz sent people to and which of those
turned into orders. That verdict is written back to each product's
`custom.quiz_rank` metafield (product, `number_decimal`, storefront-readable —
the definition exists on the store), read at render time and applied as a
bounded −2…+5 term. A frame with no history is un-boosted, never buried, which
is the right starting point for anything new.

Pooled as the **mean** across a line's colourways, not the sum — a line split
six ways should not out-earn one sold as a single product.

Turn it off with the *Use learned ranking* setting if the numbers ever look
wrong; nothing else changes.

### Proven performers

Two more live signals decide between frames that fit equally well. Both are read
at render time, so neither can go stale:

- **Reviews**, from the review app's metafields. Credit scales with how many
  people actually said it, saturating at 40, so one five-star review cannot
  outrank a line with eighty. Below 3.5 stars a frame is pushed down, not merely
  un-boosted.
- **Stock depth**, on a log curve — the step from 10 units to 100 matters far
  more than 800 to 900. Deep stock is the signal to push: the line was bought
  into, it won't sell out under the customer mid-fitting, and it's the range the
  shop stands behind.

Both are **pooled across every colourway of a line** before anything is scored.
Without that, a line split one product per colour is structurally punished — its
stock and reviews divided four ways, while a line keeping its colours as
variants presents its full depth in one row. The colourway shown on the shelf is
then the one actually in depth, not whichever sorts first alphabetically.

### Fit qualifies, performance orders

The order of operations matters, and getting it wrong is how one frame ends up
recommended to everybody:

1. **Fit is a gate.** A frame must *positively* suit the face to be shown at
   all. Negative fit is excluded, and so is neutral — a frame carrying opposing
   shape traits that cancel to zero is not a recommendation. Serendipity 2.0 is
   both rimless and rectangular, which cancels on a square face and on a long
   one, and it is now correctly absent from both.
2. **Taste modifies.** Aesthetic and tint are worth roughly what a shape trait
   is worth, so saying "vintage" genuinely reorders the shelf.
3. **Performance breaks ties.** Reviews and stock depth are capped at about six
   points combined. They are face-independent — a deep line earns the same
   credit against every face — so left unbounded they stop being a tiebreaker
   and become a thumb on the scale. At thirteen points, one frame led a third of
   all fittings.

Stock cuts both ways: the curve is centred at ten units, so a line down to its
last one or two is marked *down*, not merely left unrewarded. Recommending a
frame that is about to be unavailable wastes the fitting.

Fit is also summed with **diminishing returns**, because the shape traits are
correlated rather than independent: a frame that is oversized *and* wraparound
*and* round is one shape described three ways, not three separate merits. The
strongest trait counts in full, each additional one at half. Straight addition
produced a long-face winner nothing else could reach — 80% of those fittings,
from a choice of two frames. Penalties are not discounted; a frame wrong for the
face should stay wrong.

### Concentration is usually a catalogue signal

Some faces still concentrate, and that is information rather than a bug. Heart
faces land on Serendipity 2.0 in about seven of ten fittings — it is the
best-fitting rimless line *and* by far the deepest stocked, and there simply
are not many well-stocked rimless frames to compete. Long faces are similar.

When one frame dominates a face shape, the fix is usually stock or
merchandising, not scoring: more depth in that shape, or a collection
membership that is wrong. A rimless frame sitting in Rectangular is what makes
it eligible on angular faces at all.

### The snapshot is not the source

`preview/quiz-products.json` is a point-in-time capture of the catalogue, used
only so the standalone preview can run without a store. The section itself never
reads it — on the storefront every trait comes from `product.collections` at
render time. When collections change in Shopify the live quiz follows
immediately; only the preview needs re-capturing.

### When a strong seller doesn't appear

Almost always a collection gap rather than a scoring one, because collections
are the only taxonomy the quiz has. A frame in no shape collection scores zero
on fit and can never place, however well it sells. A frame outside
**Bestsellers** gives up its curation bonus. Both are one-click fixes in
Shopify, and they take effect immediately — nothing needs redeploying.

Membership of **Bestsellers** and **Staff picks** adds a little on top.

Together these are bounded so they rank well-fitting frames against each other
rather than overruling the fit — a bestseller in the wrong shape still loses to
the right shape.

### Tint

Tint has to distinguish *"this frame is dark"* from *"this frame comes in six
colours, one of which is dark"* — otherwise every deep line matches both
preferences and the question does nothing. A frame split one product per
colourway states its tint exactly in its `: Colour` suffix and scores full
credit; a frame that keeps its colours as variants scores partial credit, so it
sits below an exact match without being excluded.

### The fitting table

The rule is contrast, not echo: you give a face the geometry it hasn't got.

The six questions are: who we're fitting, face shape, how frames currently sit,
aesthetic, where they'll be worn, and lens tint — plus a jawline question that
only appears if the face-shape question is skipped.

**Who we're fitting** is a light steer toward how each range is styled, not a
filter — almost the whole catalogue is unisex and nothing is hidden from anyone.
Across identical fittings it changes about one frame in four, and diverges
sharply where doctrine does: a diamond face reading women's gets cat-eye first,
reading men's does not.

**Face shape** shows six diagrams rather than six descriptions. People cannot
reliably name their own face shape, and picking the closest of six outlines is a
much easier judgement than deciding whether "cheekbones widest, brow and jaw
narrower" describes them. The shapes are drawn as plain primitives — a circle
for round, a rhombus for diamond — with exaggerated proportions; an earlier
version drew all six as similar tapered paths and they were indistinguishable.

There is no driving option. The only polarised frames in the catalogue are the
sports range, so a driving answer pushed sports wraps at everyone who picked it.

## Capturing a WhatsApp number

Asked after the fitting is scored and before the shelf is shown — the only
moment the number is worth anything to the customer, because the result is what
is being offered in return.

It is never a wall. The answers are already scored, so a refused, failed or
slow submission still shows the frames; the request is fired and not awaited.
Skipping is allowed by default, and **Require it** is off on purpose: forcing it
costs completions, and a number given willingly is worth more than one extracted.
Consent is a ticked box, not an implication, and anyone who has already given a
number is not asked again.

Leads post to the store's own `/contact` form by default, which emails the
number together with the full fitting — face shape, fit, styling, aesthetic,
tint and the frames matched — so the lead arrives with the context to act on it.
Point **Where to send leads** at a webhook instead (Bitespeed, Zapier, Klaviyo)
to send it there.

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

### The shelf you name outranks the fit

Sport used to narrow outright. There are ten polarised frames in stock, most of
them wraparounds, and four of the six face shapes read a wraparound as a mild
negative — so the hard filter left **216 of the 1,296 fittings with a shelf of
seven frames or fewer**, and a square-faced customer who asked for sport was
shown round luxe frames instead.

The rule that replaced it: **a frame from the shelf the customer named by
hand is never gated out on shape.** The fit penalty stays in its score, so the
best-fitting sports frame leads and the worst-fitting one comes last — but they
are all sports frames, which is what was asked for. Everything else still has to
positively suit the face to appear at all.

### The width question

Nobody owns a pupillometer, so the quiz never asks for a measurement. It asks
how sunglasses *currently sit*:

- *They slide down my nose* → the frame is too wide → the **Small Face Types** collection leads, Large is pushed down hard
- *They sit about right* → **Medium Face Type** leads, with Small and Large both still in play
- *They press on my temples* → **Large Face Types** leads, Small is pushed down hard
- *They look small on me* → Large plus **Oversized**, for statement widths

Each option reads straight onto the shop's own size collections, so re-filing a
frame in Shopify moves it in the quiz on the next page load.

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
- **The result is remembered** in `localStorage` — returning visitors are
  offered it back. Nothing is transmitted anywhere.
- **Quick-add is off** on the result cards. These frames come in colourways, so
  the customer should land on the product page and choose one.
- **Analytics.** `psq:start`, `psq:answer` and `psq:complete` fire as DOM events
  on the section and are pushed to `window.dataLayer` when GTM is present. The
  complete event carries the face shape, archetype and product handles.

## Settings worth knowing

| Setting | Notes |
| --- | --- |
| Use the theme's own product cards | On by default. Falls back to a built-in card if the companion section is missing |
| Frames to recommend | 4–16, default 10 |
| Hide sold-out frames | On by default |
| Frames read per collection | Liquid reads at most 50 products per collection in one pass, so 50 is the ceiling and the right value |
| Fallback collection | Linked when a fitting is too narrow, and from the no-JavaScript message |
| Lens tint | The one colour on the stage |
| Collection pickers | Nineteen of them — re-point any signal without touching code |
| Use learned ranking | On by default; reads `custom.quiz_rank` |

The questions and the scoring live in `assets/shades-quiz.js`, in two clearly
marked blocks at the top of the file — `FIT` and `QUESTIONS`. Both are plain
data. Change the numbers to change the recommendations.

## Testing

Two harnesses, and they cover different halves:

- `preview/quiz.html` exercises the **scoring and the interface** against a real
  catalogue snapshot — but the snapshot is built by a Python script that mimics
  the section, so it never executes a line of Liquid.
- `preview/liquid-test.js` renders the **actual template** through a Liquid
  engine with mock Shopify globals and asserts the product index comes out
  populated, non-eyewear is excluded, traits resolve from collection handles,
  inventory sums across variants, review metafields are read and colourways are
  captured.

Run the second one after any change to the `.liquid`. A template can render
perfectly and still emit an empty index — that failure is silent, reaches the
storefront, and looks to a customer like a quiz that recommends nothing.

## Verified

Node against a live 178-frame snapshot of the catalogue, and headless Chromium
against `preview/quiz.html`:

- **All 1,296 answer combinations** (3 genders × 6 faces × 4 fits × 6 vibes ×
  3 tints) return a **full shelf of ten**. None comes up short.
- **105 different frames** appear across those runs and **58 different frames**
  take the top slot, the most frequent at 12% — proven lines lead without one
  product owning the quiz.
- **Every face shape returns only on-doctrine frames**, with the single
  deliberate exception above: a shelf the customer named by hand.
- Two full end-to-end passes in Chromium — gender → face → size → vibe → tint →
  lead capture → result — return ten cards each with no JavaScript errors.
- `preview/liquid-test.js` renders the real template and finds the index
  populated.

## Known catalogue gaps

The quiz can only steer on what the collections say. As of the last sweep, of
178 live frames:

- **20 carry no shape collection**, including the three deepest-stocked new
  lines — Contour (213 units across three colourways), Tresor (113) and the
  Limited Edition techno frame (97). A frame with no shape cannot be fitted to a
  face, so these only ever appear as top-up. Filing them into Rectangular, Oval,
  Round, Cateye, Rimless, Wraparound, Oversized or Geometric puts them straight
  into rotation.
- **16 carry no size collection** — Aurora (146u), Spectre (86u), Monarch,
  Fluff, Luna, Quantum, Cosmopolitan, Tara 2.0, Opium, Akita, both Festive SZN
  frames, Pharrell, Liberty, Orlando, Credence.
- **7 carry no gender** — Quebec (59u), Luna, Quantum, NOIR 140, Titan, Orlando,
  Credence.

Also worth a look: the **Rectangular** collection currently holds seven rimless
frames (Aphrodite, Roma, Athena, Credence, Woddy, Popsicle and all four
Serendipity 2.0 colourways). They score as both shapes at once, which is part of
why Serendipity kept surfacing on faces it doesn't suit. Nothing in the code
needs to change if they come out of Rectangular.
