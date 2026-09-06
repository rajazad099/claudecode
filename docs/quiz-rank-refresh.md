# The monthly refresh — teaching the fitting room what sold

The quiz gets better on its own only if somebody closes the loop. This is that
loop, start to finish. It runs **once a month**.

Nothing here changes the theme. It reads Shopify's own analytics and writes one
number per product.

---

## What the loop is

1. Every link on a quiz result carries UTM attribution:
   `utm_source=fitting-room&utm_medium=quiz&utm_campaign=fitting-room&utm_content=<gender-face-size-vibe>`.
2. Shopify's analytics therefore know which frames the quiz sent people to, and
   which of those sessions added to cart and checked out.
3. This refresh turns that into one number per product — **`custom.quiz_rank`** —
   and writes it back.
4. The quiz reads that metafield at render time and applies it as a bounded
   −2…+5 term. Proven frames rise. Unproven frames are left alone, never buried.

The metafield definition already exists on the store: product-scoped,
`number_decimal`, storefront-readable.

---

## Step 1 — pull the month

```sql
FROM sessions
  SHOW sessions, sessions_with_cart_additions, sessions_that_completed_checkout
  GROUP BY landing_page_url
  WHERE utm_campaign = 'fitting-room'
  SINCE -30d UNTIL today
  ORDER BY sessions DESC
  LIMIT 250
```

`landing_page_url` is the product URL the customer clicked through to, so the
handle is the last path segment (drop any `?variant=` query string).

Worth pulling alongside it, because it says *which fittings* are working rather
than which frames:

```sql
FROM sessions
  SHOW sessions, sessions_that_completed_checkout
  GROUP BY utm_content
  WHERE utm_campaign = 'fitting-room'
  SINCE -30d UNTIL today
  ORDER BY sessions DESC
  LIMIT 100
```

A `utm_content` value is the profile that produced the shelf —
`women-round-medium-luxe`. A profile with traffic and no checkouts is a shelf
that is wrong, and that is a scoring problem, not a ranking one.

## Step 2 — score each frame

Per product handle, from the month's rows:

```
clicks     = sessions
carts      = sessions_with_cart_additions
orders     = sessions_that_completed_checkout

conversion = orders / max(clicks, 1)
volume     = min(log10(max(clicks, 1)), 2) / 2          # 0 at 1 click, 1 at 100

raw        = (conversion / median_conversion_across_all_frames) - 1
score      = clamp(raw * 3 * volume, -2, +5)
```

Three things this deliberately does:

- **Divides by the median, not by a fixed target.** A 2% conversion month and a
  6% conversion month should not move every frame's score together.
- **Scales by volume.** A frame with four clicks and one order is not a 25%
  converter, it is noise; `volume` shrinks its score toward zero.
- **Clamps asymmetrically.** A proven frame can earn +5. A weak one loses at
  most 2, because the quiz should not bury a frame on one bad month.

**Fewer than 10 clicks in the month: write nothing.** Leave the metafield as it
was, or absent. An absent `quiz_rank` is treated as un-boosted, which is the
right answer for a frame the quiz has not really tested yet.

## Step 3 — write it back

```graphql
mutation {
  metafieldsSet(metafields: [
    { ownerId: "gid://shopify/Product/…", namespace: "custom", key: "quiz_rank",
      type: "number_decimal", value: "2.4" }
  ]) { userErrors { field message } }
}
```

Up to 25 per call. Products that dropped below the 10-click floor keep their
previous value; nothing needs deleting.

## Step 4 — check it did something

Re-run the sweep in `preview/` after the next snapshot rebuild and compare the
`distinct #1s` figure. If one frame's share of top slots jumps above roughly
15%, the learned term is overpowering the fit — clamp harder, or turn it off
with the **Use learned ranking** setting while it is investigated.

---

## The first run

There will be no data until the quiz is on the published theme and has been
live for a month. Until then every product has no `quiz_rank`, which is exactly
the intended starting state — the quiz ranks on fit, size, vibe, stock and
reviews alone, and starts learning the moment traffic arrives.

## Automation

A monthly Routine fires this refresh on the **1st at 11:35 IST**
(`0 6 1 * *` UTC), in a fresh session, with push and email notification on
completion. It can be listed, paused or deleted at any time; nothing else
depends on it.

**One thing to do before the first real run.** A Routine created from inside a
session cannot carry a connector across on this account, so the scheduled
session starts without the Shopify tools and cannot reach the store. Open the
Routine in the claude.ai Routines UI and attach the **Shopify** connector to it.
Until that is done the Routine will fire, notice it has no Shopify access, and
say so in one line rather than half-running. Failing that, the refresh works
perfectly well asked for by hand in any session that has Shopify connected.
