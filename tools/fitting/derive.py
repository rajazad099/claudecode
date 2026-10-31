"""Turn what the shop already wrote into one fitting record per product.

Every value carries where it came from, in `src`, so a recommendation can
always be traced back to a sentence in the product copy, a collection the
shop filed it under, or ninety days of orders -- and so a value that turns
out to be wrong can be found and corrected rather than argued with.
"""
import json, re, sys
S = "/tmp/claude-0/-home-user-claudecode/5cab7d9d-432e-5626-ac9e-5c2b6c900bc1/scratchpad"
mined = json.load(open(S + "/mined.json"))
sales = json.load(open(S + "/sales.json"))
ids   = json.load(open(S + "/ids.json"))

SIZE_COLL = {"small-face-types": "small", "medium-face-type": "medium",
             "large-face-types": "large"}

def band(mm):
    """Bands cut from this catalogue's own spread: frame widths run 130-156mm,
    with the middle half between 142 and 147."""
    if mm is None: return None
    if mm <= 141: return "small"
    if mm <= 147: return "medium"
    return "large"

out, stats = {}, {"faces": 0, "fit_mm": 0, "fit_coll": 0, "sold": 0, "none": 0}
for h, r in mined.items():
    rec, src = {}, {}

    # 1. which faces the copy says it suits -- the shop's own fitting call
    if r.get("suits"):
        rec["faces"] = r["suits"]
        src["faces"] = "description"

    # 2. width: measured where stated, reconstructed from lens+bridge otherwise
    w = r.get("fw")
    if w:
        rec["width"] = w; src["width"] = "description"
    elif r.get("lw"):
        w = 2 * r["lw"] + 26
        rec["width"] = w; src["width"] = "estimated"

    # 3. the fit band. A measured width and a size collection that agree are
    #    worth more than either alone; where they disagree the shop's own
    #    filing wins, because a human looked at the frame.
    by_mm = band(w) if src.get("width") == "description" else None
    by_coll = [SIZE_COLL[c] for c in r["coll"] if c in SIZE_COLL]
    if by_coll:
        rec["fit"] = by_coll[0] if len(by_coll) == 1 else by_coll
        src["fit"] = "collection" + ("+width" if by_mm and by_mm in by_coll else "")
        stats["fit_coll"] += 1
    elif by_mm:
        rec["fit"] = by_mm; src["fit"] = "width"
        stats["fit_mm"] += 1

    # 4. ninety days of orders, which is what actually sold rather than what
    #    is merely sitting in the warehouse
    s = sales.get(r["title"].strip())
    if s:
        rec["sold"] = s["units"]; src["sold"] = "orders-90d"
        stats["sold"] += 1

    if r.get("faces") or rec.get("faces"): stats["faces"] += 1
    if not rec: stats["none"] += 1
    rec["src"] = src
    out[h] = rec

json.dump(out, open(S + "/quiz_data.json", "w"))
print("records       :", len(out))
print("  faces stated:", sum(1 for r in out.values() if "faces" in r))
print("  fit known   :", sum(1 for r in out.values() if "fit" in r),
      f"(collection {stats['fit_coll']}, width-only {stats['fit_mm']})")
print("  width known :", sum(1 for r in out.values() if "width" in r),
      f"(measured {sum(1 for r in out.values() if r['src'].get('width')=='description')})")
print("  sold known  :", stats["sold"])
print("  nothing     :", stats["none"])
missing = [h for h in out if h not in ids]
print("  no product id:", len(missing))
