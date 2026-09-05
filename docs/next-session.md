# Next session — where to pick up

## State

The quiz is live and working on the **unpublished** preview theme
"Fitting Room preview (do not publish)" (id `157330604172`), at
`/pages/about-us?preview_theme_id=157330604172`. The live theme, GokwikOnly, is
untouched. The shop owner has confirmed it renders correctly.

Their verdict on the output: **"the recommendations are still not even at par."**
That is the work.

## What they asked for

1. **A gender question.** Not asked at all today. Likely the single biggest
   missing signal — the catalogue is largely unisex by title, but fit and taste
   both skew, and cat-eye vs aviator recommendations currently ignore it.
2. **Size.** Their words: *"size is what you are not able to read."*

## On size — check this first

Worth being precise, because it decides the approach. Nothing has stopped the
section reading data that exists in Shopify; the open question is whether frame
measurements are stored anywhere at all. Today's quiz has no measurements: it
infers width from one behavioural question ("how do sunglasses usually sit on
you" → slides / sits right / presses / looks small), which is a proxy, not a
measurement.

Before designing anything, establish where — if anywhere — the real numbers live:

- Product **metafields**. Check custom namespaces; only `reviews.rating` and
  `reviews.rating_count` are known to be populated so far.
- Product **options**. An early probe found `Size` on one product and `Frame` on
  one. Not a catalogue-wide taxonomy.
- The product **description / body_html**, which often carries
  lens-width–bridge–temple as free text and can be parsed.
- The product **images**, if the numbers are only printed on a spec card.

If the measurements exist, the fit question should become a real width match
(face width → frame width in mm) rather than the behavioural proxy. If they do
not exist, say so plainly and either keep the proxy or propose where to store
them.

## Known weak spots, from today's sweeps

- **Heart faces** land on Serendipity 2.0 in ~7 of 10 fittings, and **long
  faces** on Gaia in ~7 of 10. Both are catalogue-depth problems more than
  scoring ones: few well-stocked rimless frames, few oversized wraps.
- The **fit vs taste balance** was tuned by hand today (fit ×3, aesthetic and
  tint ~7–8, performance capped ~6). It is defensible but not validated against
  anything real. Their sales data is the obvious yardstick: do the quiz's picks
  correlate with what actually sells to that profile?
- **Archetype copy** is thin — seven fixed archetypes doing a lot of work.

## Do not repeat today's mistake

`preview/quiz.html` never executes Liquid; it runs off a Python-built snapshot.
A `case/when ... then` error shipped to a real store because of it and the quiz
recommended nothing. Run `npm install liquidjs && node preview/liquid-test.js`
after **every** change to a `.liquid` file.
