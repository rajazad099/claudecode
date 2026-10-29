# Product recommendations (Search & Discovery)

`recs.py` sets two lists per product through the Search & Discovery app's metafields
(`shopify--discovery--product_recommendation`). It changes no theme code.

| List | Where it shows | Rule |
|---|---|---|
| `related_products` + `related_products_display = only manual` | "You May Also Like" on the product page | Similar style (shape, frame type, face size), a **different model**: colourways are already covered by the swatches. One colourway per model, at least 60% of the viewed product's price. |
| `complementary_products` | "Pair it with" (section currently switched off in the theme) and any app that reads complements | Models people actually bought together first, then closest style. Same price or cheaper (40–100%), Vault travel case last. |

Every recommended product must have **at least 20 units in stock and at least 30 days of cover**
at the last 30 days' sales rate. Fast sellers about to run out are never pushed. Hecate is
down-weighted outside slim-metal styles (high returns).

## Files
- `recs.py`: the engine. `python3 recs.py <workdir>` reads `cat.tsv` and `vel30.txt` (and an
  optional `orders.jsonl` order export) from the workdir. It writes `plan.json`, `plan.txt`
  (readable), `changed.json`, and `batches/batch_N.json` (metafieldsSet payloads for changed products only).
- `pairs_state.json`: anonymised co-purchase history, as model-pair counts plus the order IDs already counted.
  New orders are folded in on each run, so the bought-together signal keeps learning.
- `plan_live.json`: the lists the store holds now. Update it after every successful write.

## Weekly refresh
1. Export active, in-stock products to `cat.tsv`: `id  name  inventory  price  tags`. Tags are the
   shape/style collections (rect, oval, round, over, wrap, rimless, techno, vintage, geo, cat, luxe,
   slim, aviator, sport), face sizes s/m/l, and `acc`/`jewel` for non-frames.
2. Run `FROM sales SHOW net_items_sold GROUP BY product_id SINCE -30d UNTIL today` and save it as `vel30.txt` (`id units`).
3. Export the last 7 days of orders with line-item product IDs to `orders.jsonl`.
4. Run `recs.py`. Spot-check `plan.txt` for the hero products, then write `batches/*` with `metafieldsSet`
   (2 aliased calls of 24 per request). Merge `changed.json` into `plan_live.json` and commit both state files.

## How to judge it
Over 14 days, compare against the week before switching on:
- **Share of orders with 2+ items:** baseline 16%.
- **AOV:** baseline ₹1,636–1,706.

If product-page add-to-cart rate drops, the lists are distracting. Lower `N_RELATED` before changing anything else.
