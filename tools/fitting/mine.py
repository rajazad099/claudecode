"""Read what the shop already says about each frame, in its own product copy."""
import json, re, sys, statistics

P1, P2 = sys.argv[1], sys.argv[2]
nodes = json.load(open(P1))["data"]["products"]["nodes"] + json.load(open(P2))

FACES = {"round":"round","oval":"oval","square":"square","heart":"heart",
         "long":"long","oblong":"long","diamond":"diamond"}

# "Suits: Round, oval and heart-shaped faces, where ..."
SUITS = re.compile(r'Suits?\s*:\s*(.{0,160}?)\bfaces?\b', re.I | re.S)
# "Small to medium fit", "Medium fit", "Oversized fit"
FIT   = re.compile(r'\b(small|medium|large|oversized|wide|narrow)(?:\s+to\s+(small|medium|large|oversized))?\s+fit\b', re.I)
FW    = re.compile(r'frame\s*width\s*[:\s]\s*~?\s*(\d{2,3})(?:\s*)mm', re.I)
LW    = re.compile(r'lens\s*(?:width)?\s*[:\s]\s*~?\s*(\d{2,3})\s*mm\s*wide|lens\s*width\s*[:\s]\s*~?\s*(\d{2,3})\s*mm', re.I)
TEMPLE= re.compile(r'temple(?:\s*length)?\s*[:\s]\s*~?\s*(\d{2,3})\s*mm', re.I)
POLAR = re.compile(r'\bpolaris\w*|\bpolariz\w*', re.I)
MIRROR= re.compile(r'\bmirror\w*', re.I)
PHOTO = re.compile(r'\bphotochrom\w*', re.I)
GRAD  = re.compile(r'\bgradient\b', re.I)
CLEARL= re.compile(r'\bclear lens|\btransparent lens|\blight lens', re.I)
TINTED= re.compile(r'\btinted\b|\bdark lens|\bsmoke\b', re.I)

out = {}
for n in nodes:
    d = (n.get("description") or "")
    rec = {"handle": n["handle"], "title": n["title"],
           "iv": n.get("totalInventory") or 0,
           "coll": sorted(c["handle"] for c in n["collections"]["nodes"])}
    m = SUITS.search(d)
    if m:
        seg = m.group(1).lower()
        rec["suits"] = sorted({FACES[k] for k in FACES if re.search(r'\b'+k, seg)})
    m = FIT.search(d)
    if m:
        rec["fit"] = [x.lower() for x in m.groups() if x]
    m = FW.search(d)
    if m: rec["fw"] = int(m.group(1))
    m = LW.search(d)
    if m: rec["lw"] = int(m.group(1) or m.group(2))
    m = TEMPLE.search(d)
    if m: rec["temple"] = int(m.group(1))
    t = []
    if POLAR.search(d): t.append("polarised")
    if MIRROR.search(d): t.append("mirror")
    if PHOTO.search(d): t.append("photochromic")
    if GRAD.search(d): t.append("gradient")
    if CLEARL.search(d): t.append("clear-lens")
    if TINTED.search(d): t.append("tinted")
    if t: rec["lens"] = t
    out[n["handle"]] = rec

json.dump(out, open(sys.argv[3], "w"), indent=0)

tot = len(out)
def c(k): return sum(1 for r in out.values() if k in r)
print(f"active products                : {tot}")
print(f"  states which faces it suits  : {c('suits')}")
print(f"  states a fit band            : {c('fit')}")
print(f"  states frame width (mm)      : {c('fw')}")
print(f"  states lens width (mm)       : {c('lw')}")
print(f"  states temple length (mm)    : {c('temple')}")
print(f"  states something about lens  : {c('lens')}")
fws = sorted(r["fw"] for r in out.values() if "fw" in r)
lws = sorted(r["lw"] for r in out.values() if "lw" in r)
if fws:
    q = statistics.quantiles(fws, n=4)
    print(f"\nframe width mm  n={len(fws)}  min={fws[0]} p25={q[0]:.0f} median={q[1]:.0f} p75={q[2]:.0f} max={fws[-1]}")
if lws:
    q = statistics.quantiles(lws, n=4)
    print(f"lens  width mm  n={len(lws)}  min={lws[0]} p25={q[0]:.0f} median={q[1]:.0f} p75={q[2]:.0f} max={lws[-1]}")
from collections import Counter
print("\nfit bands stated:", dict(Counter(tuple(r["fit"]) for r in out.values() if "fit" in r)))
print("lens notes      :", dict(Counter(x for r in out.values() for x in r.get("lens", []))))
