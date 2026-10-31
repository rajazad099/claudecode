# The fitting data

What the quiz knows about a frame beyond which collection it sits in, read out
of the shop's own product copy and its order history, and written back to
Shopify as `custom.quiz_data`.

## Why it exists

Collections say which *shelf* a frame belongs on. They do not say whether it
will fit the person asking. The product descriptions do — the newer ones state
it outright:

> **Suits:** Round, oval and heart-shaped faces, where the angled edges add a
> little sharpness to soft features. The adjustable nose pads help it sit
> right. **Small to medium fit.**
> **Frame width:** 141 mm **Lens:** 55 mm wide, 38 mm high **Bridge:** 19 mm

That sentence was written by somebody holding the frame. It beats anything the
scoring table can infer from a collection, so where it exists it decides.

## The record

`custom.quiz_data`, product-scoped JSON, storefront-readable:

| Key | Meaning | Source |
| --- | --- | --- |
| `faces` | Face shapes the copy says it suits | the `Suits:` sentence |
| `width` | Frame width in mm | the `Frame width:` line, only where stated |
| `sold` | Units sold, 90 days | ShopifyQL `net_items_sold` |

Every key is optional. A frame with no `faces` is fitted the old way, from its
shape collections through the `FIT` table. A frame with no `width` takes its
size from its size collection. A frame with no `sold` falls back to stock depth.
Nothing here is ever a reason to exclude a frame — only to rank it.

`custom.lens_tint` (`mild` | `strong`) is separate, hand-editable, and feeds the
optional tint question. See the caveat below.

## Running it

```
python3 -I tools/fitting/mine.py <products-page-1.json> <page-2.json> mined.json
python3 -I tools/fitting/derive.py          # reads mined.json + sales.json + ids.json
```

`mine.py` parses the descriptions. `derive.py` joins that to the size
collections and to 90 days of orders and emits one record per product. Both are
pure functions of their input — rerunning them cannot corrupt anything, and the
metafield is safe to overwrite wholesale.

## Coverage, as of the last run

Of 271 active products:

- **57** state which faces they suit. These are mostly the newer lines; the
  older copy is a single line of ad copy or dimensions only.
- **102** state a frame width. Another 36 state a lens width from which a frame
  width can be reconstructed, but those reconstructions were dropped — the
  arithmetic produced a 336 mm frame where a description had put a frame width
  on the lens line, and a wrong number is worse than a missing one.
- **223** have sold at least one unit in 90 days; **110** have sold ten or more,
  which is the floor for writing the number at all. Below ten units in a quarter
  is noise, not a signal.

Where a measured width and a size collection both exist they agree on **96%** of
medium frames, 78% of small and 52% of large. The collection wins where they
disagree, because a person looked at the frame to file it.

## The tint caveat

**Lens darkness is not recorded anywhere in this catalogue.** Not in the
collections, not in the variant options — those are frame colour, and one is
literally named "Frame color" — and in only 39 of 271 descriptions, 38 of which
read as strong. A mild/strong question asked today would have one product on the
mild side.

So the question ships switched off, behind **Ask about lens tint** in the theme
editor, and `custom.lens_tint` is populated for the 39 that can be proven from
the copy. Fill the rest and switch it on. Until then a frame with no value is
un-boosted rather than excluded, so the question degrades honestly rather than
emptying the shelf.
