"""Project Shades product recommendations for the Search & Discovery app.

Builds two lists per product and writes them as metafieldsSet batches:
  related_products        "You may also like": similar styles, a different model (colourways are
                          already covered by the colour swatches), one colourway per model.
  complementary_products  "Pair it with": what people actually buy together, then the closest
                          style; never more expensive than the product being viewed.

Inputs (tab/space separated, refreshed each run):
  cat.tsv     id  name  inventory  price  tags(comma list: shape/style tags, face sizes, b=bestseller)
  vel30.txt   id  units sold in the last 30 days
  orders.jsonl  Admin order export (orders + line items with __parentId) for co-purchase history

Usage: python3 recs.py <workdir>   ->  writes plan.json, plan.txt, batches/batch_N.json
"""
import collections
import json
import math
import os
import re
import sys

W = sys.argv[1] if len(sys.argv) > 1 else '.'
P = lambda f: os.path.join(W, f)

MIN_STOCK = 20          # never recommend thinner stock than this
MIN_COVER_DAYS = 30     # or anything that will sell out inside a month without help
N_RELATED, N_COMPLEMENT = 8, 4
SHAPES = {'rect', 'oval', 'round', 'over', 'wrap', 'rimless', 'techno', 'vintage', 'geo', 'cat',
          'luxe', 'slim', 'aviator', 'sport'}
NON_FRAMES = {'acc', 'jewel'}
CASE_ID = '8402207015052'  # Vault travel case: a natural add-on, offered last in "Pair it with"
# Models with a known return problem are recommended less outside their own style.
RETURN_RISK = {'hecate': 0.75}


def model_of(name):
    base = name.split(' : ')[0]
    base = re.sub(r'\s+(\d\.0|00\d|Cateye|Eyeglasses)$', '', base.strip())
    return base.lower()


cat = {}
for line in open(P('cat.tsv')):
    pid, name, inv, price, tags = line.rstrip('\n').split('\t')
    t = set(tags.split(','))
    cat[pid] = dict(id=pid, name=name, inv=int(inv), price=float(price), tags=t,
                    shape=t & SHAPES, face=t & {'s', 'm', 'l'}, model=model_of(name),
                    frame=not (t & NON_FRAMES))
vel = collections.Counter()
for line in open(P('vel30.txt')):
    pid, n = line.split()
    vel[pid] = max(vel[pid], int(n))
for p in cat.values():
    daily = vel[p['id']] / 30
    p['cover'] = p['inv'] / daily if daily else 999
    p['eligible'] = p['inv'] >= MIN_STOCK and p['cover'] >= MIN_COVER_DAYS

# Co-purchase at model level (colourways pooled), so thin per-colour data still counts.
# History lives in pairs_state.json (anonymised model-pair counts, no customer data). Any new
# orders.jsonl in the workdir is folded in first, so each weekly run learns from the latest baskets.
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pairs_state.json')
state = json.load(open(STATE)) if os.path.exists(STATE) else {'model_count': {}, 'pairs': {}, 'orders_seen': []}
gid_model = {pid: p['model'] for pid, p in cat.items()}
if os.path.exists(P('orders.jsonl')):
    orders, items = {}, collections.defaultdict(set)
    for line in open(P('orders.jsonl')):
        r = json.loads(line)
        if '__parentId' in r:
            if r.get('product'):
                items[r['__parentId']].add(r['product']['id'].rsplit('/', 1)[1])
        else:
            orders[r['id']] = r
    seen = set(state['orders_seen'])
    for oid, o in orders.items():
        if o.get('cancelledAt') or oid.rsplit('/', 1)[1] in seen:
            continue
        seen.add(oid.rsplit('/', 1)[1])
        ms = sorted({gid_model.get(i) or i for i in items[oid]})
        for m in ms:
            state['model_count'][m] = state['model_count'].get(m, 0) + 1
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                k = ms[i] + '|' + ms[j]
                state['pairs'][k] = state['pairs'].get(k, 0) + 1
    state['orders_seen'] = sorted(seen)
    json.dump(state, open(STATE, 'w'), separators=(',', ':'))
mcount = collections.Counter(state['model_count'])
mpair = collections.Counter({tuple(k.split('|')): v for k, v in state['pairs'].items()})


def cop(a, b):
    """Normalised co-purchase strength between two models (0..1, cosine on order counts)."""
    c = mpair[tuple(sorted((a, b)))]
    return c / math.sqrt(mcount[a] * mcount[b]) if c else 0.0


def style(a, b):
    s = len(a['shape'] & b['shape']) / max(len(a['shape'] | b['shape']), 1)
    return 0.8 * s + 0.2 * (1 if a['face'] & b['face'] else 0)


def price_fit(a, b):
    return max(0.0, 1 - abs(a['price'] - b['price']) / a['price'])


def stock_push(b):
    # More stock relative to sales = more reason to show it. 0..1.
    return min(1.0, math.log1p(min(b['cover'], 365)) / math.log1p(365)) * min(1.0, b['inv'] / 100)


# One representative colourway per model: the eligible one with the most stock.
rep = {}
for p in cat.values():
    if p['eligible'] and p['frame']:
        r = rep.get(p['model'])
        if not r or p['inv'] > r['inv']:
            rep[p['model']] = p
copmax = max((cop(a, b) for a in rep for b in rep if a < b), default=1) or 1


def rank(anchor, kind):
    out = []
    for m, c in rep.items():
        if m == anchor['model']:
            continue
        st, cp = style(anchor, c), cop(anchor['model'], m) / copmax
        if kind == 'related':
            # Alternatives must not pull the shopper down to a much cheaper pair.
            if st < 0.25 or c['price'] < 0.6 * anchor['price']:
                continue
            score = 0.5 * st + 0.2 * price_fit(anchor, c) + 0.15 * cp + 0.15 * stock_push(c)
        else:
            # The second pair should feel like an easy yes: same price or cheaper, but not a throwaway.
            if c['price'] > anchor['price'] + 1 or c['price'] < 0.4 * anchor['price']:
                continue
            if st < 0.15 and cp == 0:
                continue
            score = 0.45 * cp + 0.25 * st + 0.15 * stock_push(c) + 0.15 * price_fit(anchor, c)
        if m in RETURN_RISK and not (anchor['shape'] & c['shape'] & {'slim'}):
            score *= RETURN_RISK[m]
        out.append((round(score, 4), c['id']))
    out.sort(reverse=True)
    return out


plan = {}
for pid, a in cat.items():
    if not a['frame'] or not a['shape']:
        continue
    rel = [i for _, i in rank(a, 'related')[:N_RELATED]]
    comp = [i for _, i in rank(a, 'complement')[:N_COMPLEMENT - 1]]
    if cat.get(CASE_ID, {}).get('eligible'):
        comp.append(CASE_ID)
    plan[pid] = {'related': rel, 'complementary': comp}

json.dump(plan, open(P('plan.json'), 'w'), indent=1)
with open(P('plan.txt'), 'w') as f:
    for pid, v in sorted(plan.items(), key=lambda kv: -cat[kv[0]]['inv']):
        f.write(f"{cat[pid]['name']} [{cat[pid]['inv']}]\n")
        f.write('  pair: ' + ' | '.join(cat[i]['name'] for i in v['complementary']) + '\n')
        f.write('  like: ' + ' | '.join(cat[i]['name'] for i in v['related']) + '\n')

# Only rewrite products whose lists changed since the last write (plan_live.json is what the
# store holds now). metafieldsSet takes at most 25 metafields per call.
LIVE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plan_live.json')
live = json.load(open(LIVE)) if os.path.exists(LIVE) else {}
changed = {pid: v for pid, v in plan.items() if live.get(pid) != v}
mfs = []
for pid, v in changed.items():
    owner = f'gid://shopify/Product/{pid}'
    ns = 'shopify--discovery--product_recommendation'
    gl = lambda ids: json.dumps([f'gid://shopify/Product/{i}' for i in ids])
    if v['related']:
        mfs.append(dict(ownerId=owner, namespace=ns, key='related_products', type='list.product_reference', value=gl(v['related'])))
        mfs.append(dict(ownerId=owner, namespace=ns, key='related_products_display', type='single_line_text_field', value='only manual'))
    if v['complementary']:
        mfs.append(dict(ownerId=owner, namespace=ns, key='complementary_products', type='list.product_reference', value=gl(v['complementary'])))
os.makedirs(P('batches'), exist_ok=True)
for n in range(0, len(mfs), 24):
    json.dump({'metafields': mfs[n:n + 24]}, open(P(f'batches/batch_{n // 24}.json'), 'w'))
json.dump(changed, open(P('changed.json'), 'w'), indent=1)
print('products', len(plan), 'changed', len(changed), 'metafields', len(mfs), 'batches', math.ceil(len(mfs) / 24),
      'eligible models', len(rep))
