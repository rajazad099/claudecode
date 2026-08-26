/*
 * PROJECT SHADES — THE FITTING ROOM  (PS-003)
 * Progressive enhancement. The section renders and reads fine without this file;
 * this is what makes it move and score.
 *
 * WHERE THE INTELLIGENCE LIVES
 * ----------------------------
 *  FIT      - optical fitting rules. Face shape vs frame shape, the real ones:
 *             you contrast a face, you don't echo it. A round face wants angles,
 *             a square face wants curves.
 *  QUESTIONS- the six questions, their options, and what each option scores.
 *  read()   - turns a product title into traits. The catalogue is untagged, so
 *             collections carry most of the signal and the title carries the rest.
 *  rank()   - scores every candidate, dedupes colourways, returns the shelf.
 *
 * All of it is data. Change the numbers, change the recommendations — no
 * restructuring required.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- fitting */

  /* Points added to a frame carrying that trait, for a face of this shape.
     Negative = actively wrong for this face, and we want it to lose. */
  /* Fit is the whole premise, so the fitting table outweighs taste and
     merchandising rather than competing with them. Without this a bestseller
     in the wrong shape outranks the right shape, which is the one failure
     mode a fitting quiz cannot have. */
  var FIT_WEIGHT = 3;

  /* Below this many positively-fitting frames, neutral-fit frames are allowed
     back in to fill the shelf rather than showing the customer a short one. */
  var NEUTRAL_FALLBACK_AT = 8;

  var FIT = {
    oval:    { rect: 3, round: 3, cate: 3, oval: 3, riml: 2, wrap: 2, avia: 3, ovsz: 1, geo: 2 },
    round:   { rect: 5, cate: 4, wrap: 3, geo: 3, avia: 2, riml: 1, ovsz: 1, oval: -2, round: -4 },
    square:  { round: 5, oval: 4, riml: 3, cate: 3, avia: 3, ovsz: 1, geo: -1, rect: -3, wrap: -2 },
    heart:   { riml: 5, round: 3, oval: 3, avia: 3, cate: 1, rect: 1, ovsz: -3, wrap: -1 },
    long:    { ovsz: 5, wrap: 4, round: 3, geo: 2, rect: 2, cate: 1, slim: -3, riml: -2 },
    diamond: { cate: 5, oval: 4, riml: 3, round: 3, ovsz: 1, rect: -1, wrap: -1 }
  };

  /* Why each pairing works — shown on the result so the advice is legible,
     not oracular. */
  var WHY = {
    oval:    'An oval face is the neutral one — it carries almost any frame. We leaned into shape rather than correction.',
    round:   'Angles are what a round face is missing, so we pushed you toward straight brows and defined corners. They add the structure your face doesn’t.',
    square:  'A strong jaw is already doing the geometry. Curves soften it, which is why the round and rimless frames scored hardest for you.',
    heart:   'A wider brow and a narrower chin want weight taken off the top. Rimless and light metal frames do that without shrinking the frame.',
    long:    'Depth is the trick on a longer face — tall lenses and wraps break the vertical and give the face width back.',
    diamond: 'Prominent cheekbones want a frame that lifts at the outer edge. Cat-eye and soft oval widen the brow line to match.'
  };

  var FACE_LABEL = {
    oval: 'Oval', round: 'Round', square: 'Square', heart: 'Heart', long: 'Long', diamond: 'Diamond'
  };

  /* Which drawn frame to show on the stage for a given winning trait. */
  var FRAME_FOR = ['ovsz', 'wrap', 'cate', 'riml', 'rect', 'round', 'oval'];

  /* --------------------------------------------------------------- questions */

  var QUESTIONS = [
    {
      id: 'face',
      q: 'What shape is your face?',
      hint: 'Pull your hair back and look straight on. Go with your gut — you can skip this and we’ll work it out from your jaw instead.',
      options: [
        { v: 'oval',    l: 'Oval',    s: 'Longer than wide, softly tapered' },
        { v: 'round',   l: 'Round',   s: 'Full cheeks, soft chin, width ≈ length' },
        { v: 'square',  l: 'Square',  s: 'Strong jaw, broad forehead' },
        { v: 'heart',   l: 'Heart',   s: 'Wide brow, narrow pointed chin' },
        { v: 'long',    l: 'Long',    s: 'Noticeably longer than it is wide' },
        { v: 'diamond', l: 'Diamond', s: 'Cheekbones widest, brow and jaw narrow' }
      ],
      apply: function (a, v) { a.face = v; }
    },
    {
      /* Only asked if they skipped the shape question. Infers it from one
         easier judgement — most people can describe a jaw but not a face. */
      id: 'jaw',
      q: 'Your jawline, honestly?',
      hint: 'This tells us the same thing, from an easier angle.',
      when: function (a) { return !a.face && a.skippedFace === true; },
      options: [
        { v: 'soft',    l: 'Soft and curved',   s: 'No hard corners anywhere' },
        { v: 'sharp',   l: 'Sharp and angular', s: 'A jaw you could set a ruler against' },
        { v: 'pointed', l: 'Narrow and pointed', s: 'Comes to a point at the chin' },
        { v: 'even',    l: 'Even, in proportion', s: 'Nothing especially wide or narrow' }
      ],
      apply: function (a, v) {
        a.face = { soft: 'round', sharp: 'square', pointed: 'heart', even: 'oval' }[v];
        a.faceInferred = true;
      }
    },
    {
      id: 'fit',
      q: 'How do sunglasses usually sit on you?',
      hint: 'This is the measurement that actually matters, and nobody owns a pupillometer.',
      options: [
        { v: 'slide',  l: 'They slide down my nose', s: 'The frame is too wide for your face',  score: { slim: 4, riml: 2, ovsz: -4, wrap: -2 } },
        { v: 'right',  l: 'They sit about right',    s: 'Standard width suits you',              score: {} },
        { v: 'press',  l: 'They press on my temples', s: 'You need width you’re not getting', score: { ovsz: 5, wrap: 3, slim: -4 } },
        { v: 'small',  l: 'They look small on me',   s: 'You have the face for a statement frame', score: { ovsz: 4, geo: 1, slim: -3 } }
      ],
      apply: function (a, v) { a.fit = v; }
    },
    {
      id: 'vibe',
      q: 'Which of these is closest to how you dress?',
      hint: 'We merchandise by mood as well as by shape.',
      options: [
        { v: 'vint',  l: 'Archive / vintage',   s: '90s frames, retro rounds, tortoise',   score: { vint: 8, round: 1 } },
        { v: 'tech',  l: 'Techno / futuristic', s: 'Wraps, visors, Y2K metal',              score: { tech: 8, wrap: 2 } },
        { v: 'luxe',  l: 'Quiet luxury',        s: 'Clean lines, gold, nothing shouting',   score: { luxe: 8, riml: 2, oval: 1 } },
        { v: 'code',  l: 'Street / everyday',   s: 'Black, matte, goes with everything',    score: { code: 7, best: 2 } },
        { v: 'ice',   l: 'Ice / clear',         s: 'Transparent, chrome, cold tones',       score: { ice: 8, riml: 2 } },
        { v: 'any',   l: 'Depends on the day',  s: 'Show me what fits first',               score: { best: 2, staff: 1 } }
      ],
      apply: function (a, v) { a.vibe = v; }
    },
    {
      id: 'wear',
      q: 'Where will these actually live?',
      hint: 'Be honest. The answer changes the lens as much as the frame.',
      options: [
        { v: 'city',   l: 'Everyday, in the city', s: 'Commutes, coffee, going out',   score: { best: 2, code: 2, staff: 1 } },
        { v: 'drive',  l: 'Driving and daylight',  s: 'Glare is the enemy',            score: { sport: 6, wrap: 3, avia: 2 } },
        /* Answering this is a functional constraint, not a preference: a frame
           that is not built for sport is the wrong answer however well it fits,
           so this narrows to the polarised sports range outright. */
        { v: 'sport',  l: 'Running, riding, gym',  s: 'They have to stay on',          score: { sport: 7, wrap: 4, ovsz: -2, riml: -2 }, require: 'sport' },
        { v: 'beach',  l: 'Beach and travel',      s: 'Sun, water, long days out',     score: { ovsz: 3, sport: 2, vint: 1 } },
        { v: 'night',  l: 'Out, mostly for looks', s: 'The frame is the outfit',       score: { tech: 3, ovsz: 3, luxe: 2 } }
      ],
      apply: function (a, v) { a.wear = v; }
    },
    {
      id: 'tint',
      q: 'Which lens do you reach for?',
      hint: 'Tint changes the whole character of a frame, and it is the thing people regret getting wrong.',
      options: [
        { v: 'dark',   l: 'Dark — black, brown, smoke', s: 'Hides the eyes, holds up in hard sun',   score: { dark: 7, darkish: 2 } },
        { v: 'light',  l: 'Light — blue, beige, clear', s: 'Softer, shows the eyes, reads modern',   score: { light: 7, lightish: 2 } },
        { v: 'either', l: 'Either — surprise me',       s: 'Fit matters more to you than colour',    score: {} }
      ],
      apply: function (a, v) { a.tint = v; }
    }
  ];

  /* -------------------------------------------------------------- archetypes */

  var ARCHETYPES = [
    { k: 'sport', n: 'THE SPRINTER',  d: 'Built to stay on. Wrapped, polarised, unbothered.' },
    { k: 'tech',  n: 'THE OPERATOR',  d: 'Y2K metal and future-tense geometry. You dress like the year after next.' },
    { k: 'vint',  n: 'THE ARCHIVIST', d: 'You buy the frame that already had a life. Tortoise, acetate, ninety-something.' },
    { k: 'luxe',  n: 'THE ICON',      d: 'Nothing shouting. The most expensive-looking thing you own is a silhouette.' },
    { k: 'ice',   n: 'THE GLACIER',   d: 'Clear, chrome, cold. You like a frame you can see through.' },
    { k: 'code',  n: 'THE REGULAR',   d: 'One black pair, worn to death, replaced with the same. Correct.' }
  ];
  var DEFAULT_ARCHETYPE = { n: 'THE PURIST', d: 'Fit first, fashion second. We picked on shape alone.' };

  /* ------------------------------------------------------ title -> traits */

  var TINT_DARK  = /\b(black|brown|smoke|smoked|tortoise|grey|gray|charcoal|olive|forest|emerald|midnight|ash|dark|espresso|leopard)\b/i;
  var TINT_LIGHT = /\b(blue|beige|biege|clear|transparent|white|silver|yellow|pink|orange|purple|gold|ice|crystal|sand|rose|cream|lilac)\b/i;

  /* Tint has to distinguish "this frame IS dark" from "this frame is sold in
     several colours, one of which is dark" — otherwise every deep line matches
     both preferences and the question does nothing.

     A frame split one product per colourway states its tint exactly in the
     ": Colour" suffix. A frame that keeps its colours as variants only offers
     the tint, so it scores the weaker `-ish` trait and sits below an exact
     match without being excluded. */
  function tintTraits(p, traits) {
    var parts = String(p.t).split(/\s+:\s+/);
    var exact = parts.length > 1 ? parts.pop() : null;
    if (exact !== null) {
      if (TINT_DARK.test(exact))  { traits.dark = true;  traits.darkish = true;  return; }
      if (TINT_LIGHT.test(exact)) { traits.light = true; traits.lightish = true; return; }
    }
    var pool = (p.cl || '') + ' ' + p.t;
    var d = TINT_DARK.test(pool), l = TINT_LIGHT.test(pool);
    /* Only one tint in the whole range: that is what the frame is. */
    if (d && !l) { traits.dark = true; traits.darkish = true; return; }
    if (l && !d) { traits.light = true; traits.lightish = true; return; }
    if (d) traits.darkish = true;
    if (l) traits.lightish = true;
  }

  var TITLE_RULES = [
    [/rimless/i, 'riml'], [/cat[\s-]?eye/i, 'cate'], [/wrap/i, 'wrap'],
    [/aviator|pilot/i, 'avia'], [/hexagon|hex\b|octagon|geometric/i, 'geo'],
    [/rectangular|rectangle|square|squared/i, 'rect'], [/round/i, 'round'],
    [/oval|butterfly/i, 'oval'],
    /* "Overized" is a live typo in the catalogue — match it on purpose. */
    [/over\s*i?zed|chunky|thick|bold|jumbo/i, 'ovsz'],
    [/slim|sleek|thin|micro|skinny/i, 'slim'],
    [/y2k|futuristic|techno|tech\b|cyber|3d|alien/i, 'tech'],
    [/retro|vintage|archive|90'?s|classic|heritage/i, 'vint'],
    [/polaris|polariz|sport|shield/i, 'sport'],
    [/sports?\s+sunglasses|shield|wrap/i, 'wrap'],
    [/metal|chrome|steel|titanium/i, 'metal'],
    [/luxury|luxe|premium|gold/i, 'luxe'],
    [/clear|transparent|ice|crystal/i, 'ice']
  ];

  function read(p) {
    var traits = Object.create(null);
    var i, c = p.c || [];
    for (i = 0; i < c.length; i++) traits[c[i]] = true;
    for (i = 0; i < TITLE_RULES.length; i++) {
      if (TITLE_RULES[i][0].test(p.t)) traits[TITLE_RULES[i][1]] = true;
    }
    tintTraits(p, traits);
    return traits;
  }

  /* ------------------------------------------------- proven performers */

  /* Pool the performance signals across every colourway of a line before
     scoring any of them.

     Without this a line split one product per colour is structurally punished:
     its stock and its reviews are divided four ways, and whichever colour wins
     the dedupe then represents the whole line carrying only its own share —
     while a line that keeps its colours as variants presents its full depth in
     a single row. Serendipity 2.0 (four colourways, 582 units between them)
     ranked below Serendipity 1.0 (one row, 23 units) for exactly this reason,
     despite outselling it four to one.

     Depth is summed, review counts are summed, and the rating is the
     count-weighted mean — so a line reads as what it actually is. */
  function poolLines(products) {
    var pool = Object.create(null), i, k;
    for (i = 0; i < products.length; i++) {
      var p = products[i];
      var key = parseTitle(p.t).alias.toUpperCase();
      var g = pool[key] || (pool[key] = { iv: 0, rc: 0, weighted: 0, rt: 0 });
      g.iv += p.iv || 0;
      g.rc += p.rc || 0;
      g.weighted += (p.rt || 0) * (p.rc || 0);
    }
    for (k in pool) if (pool[k].rc) pool[k].rt = pool[k].weighted / pool[k].rc;
    return pool;
  }

  /* rank() runs on every hover preview, so pooling is memoised against the
     product array it was built from. */
  var poolCacheKey = null, poolCacheValue = null;
  function linesOf(products) {
    if (poolCacheKey === products && poolCacheValue) return poolCacheValue;
    poolCacheKey = products;
    poolCacheValue = poolLines(products);
    return poolCacheValue;
  }

  /* What the shop already knows about a frame, from two live sources: what
     customers said about it, and how deep it is stocked. Deep stock is the
     signal to push — the line was bought into, it will not sell out under the
     customer mid-fitting, and it is the range the shop stands behind.
     Deliberately bounded so it ranks well-fitting frames against each other
     rather than overruling the fit. */
  /* Performance is deliberately small, and this is the whole point of it.

     It is face-independent — a deep, well-reviewed line earns the same credit
     against every face shape — so if it is allowed to grow it stops being a
     tiebreaker and becomes a thumb on the scale that lifts one product onto
     faces it does not suit. That is exactly what happened when this was worth
     up to 13 points: one frame led a third of all fittings.

     Capped at roughly 6 combined, it can reorder frames that already suit the
     face and can never overturn the fit itself. */
  function performance(line) {
    var s = 0;

    /* Reviews. Credit scales with how many people actually said it, saturating
       at 40, so a single five-star review cannot outrank a line with eighty.
       Below 3.5 stars a frame is pushed down, not merely un-boosted. */
    if (line.rt) {
      var confidence = Math.min(line.rc || 0, 40) / 40;
      s += (line.rt - 3.5) * 2 * confidence;
    }

    /* Stock depth, on a log curve — the step from 10 units to 100 matters far
       more than 800 to 900 — and centred at ten so it cuts both ways. A line
       down to its last unit is marked down, not merely left unrewarded: it is
       about to be unavailable, and recommending it wastes the fitting. */
    if (line.iv > 0) s += (Math.min(Math.log(line.iv) / Math.LN10, 3) - 1) * 2;
    else s -= 2;

    return s;
  }

  /* `[ Apollo ] Rectangular Unisex Sunglasses : Black` -> parts. The house
     naming convention is load-bearing: the alias is how we stop four colourways
     of one frame from filling the whole result. */
  function parseTitle(t) {
    var m = String(t).match(/^\s*\[\s*([^\]]+?)\s*\]\s*(.*)$/);
    var alias = m ? m[1] : String(t);
    var rest = m ? m[2] : '';
    var colour = '';
    var bits = rest.split(/\s+:\s+/);
    if (bits.length > 1) { colour = bits.pop().trim(); rest = bits.join(' : '); }
    rest = rest.replace(/\s*sunglasses\s*$/i, '').replace(/\s*glasses\s*$/i, '').trim();
    return { alias: alias, desc: rest, colour: colour };
  }

  /* -------------------------------------------------------------- scoring */

  function rank(products, answers, opts) {
    var face = answers.face || 'oval';
    var fitTable = FIT[face] || FIT.oval;
    var wanted = Object.create(null);   /* trait -> points, from the answers */
    var required = null;                /* hard filter, if an answer sets one */

    QUESTIONS.forEach(function (q) {
      var v = answers[q.id];
      if (!v) return;
      var opt = null;
      for (var i = 0; i < q.options.length; i++) if (q.options[i].v === v) opt = q.options[i];
      if (!opt) return;
      if (opt.require) required = opt.require;
      var sc = opt.score || {};
      for (var k in sc) wanted[k] = (wanted[k] || 0) + sc[k];
    });

    /* Pooled over every product, including sold-out colourways: a line's depth
       is the line's depth regardless of which colours are showing today. */
    var lines = linesOf(products);

    var scored = [], neutral = [];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      if (opts.hideOOS && !p.a) continue;
      var traits = read(p);
      if (required && !traits[required]) continue;
      var line = lines[parseTitle(p.t).alias.toUpperCase()] || { iv: p.iv || 0, rc: p.rc || 0, rt: p.rt || 0 };

      /* 1. fit — how the frame shape reads against this face.

         Summed with diminishing returns, because the shape traits are
         correlated rather than independent: a frame that is oversized AND
         wraparound AND round is one shape described three ways, not three
         separate merits. Straight addition triple-counted it and produced a
         winner that nothing else could reach — the strongest trait counts in
         full, each additional one at half. Penalties are not discounted; a
         frame wrong for the face should stay wrong. */
      var fitScore = 0, best = 0, penalty = 0, k, v;
      for (k in fitTable) {
        if (!traits[k]) continue;
        v = fitTable[k];
        if (v < 0) { penalty += v; continue; }
        fitScore += v;
        if (v > best) best = v;
      }
      fitScore = best + (fitScore - best) * 0.5 + penalty;

      /* A frame must positively suit the face to be recommended at all.

         Excluding only negative fit was not enough: a frame carrying opposing
         shape traits nets out to zero — Serendipity 2.0 is both rimless and
         rectangular, which cancels on a square face and on a long one — and a
         neutral frame still collected taste, performance and curation points
         and won faces it had no business on. Zero is not a recommendation, so
         zero is excluded too. */
      if (fitScore < 0) continue;

      var score = fitScore * FIT_WEIGHT;
      /* 2. taste and use — what they told us they want */
      for (k in wanted) if (traits[k]) score += wanted[k];
      /* 3. proven performers — a bounded tiebreaker between frames that
            already suit the face */
      score += performance(line);
      /* 4. house curation, smaller still */
      if (traits.best) score += 1;
      if (traits.staff) score += 1;
      if (p.a) score += 3;

      var row = { p: p, score: score, traits: traits, meta: parseTitle(p.t), line: line };
      if (fitScore > 0) scored.push(row); else neutral.push(row);
    }

    var order = function (a, b) {
      return b.score - a.score
          /* Colourways of one line now tie on score, since performance is
             pooled across them. Break that tie on the colour's own stock depth
             so the shelf shows the one actually in depth — otherwise the
             representative fell to alphabetical order and Serendipity 2.0 was
             fronted by its 8-unit Black instead of its 308-unit Clear. */
          || (b.p.iv || 0) - (a.p.iv || 0)
          || a.p.p - b.p.p
          || a.p.h.localeCompare(b.p.h);
    };
    /* Collapse colourways: one row per alias, with a count so the customer
       still learns the other colours exist. */
    var byAlias = Object.create(null);
    function collapse(rows, into) {
      rows.sort(order);
      for (var j = 0; j < rows.length; j++) {
        var key = rows[j].meta.alias.toUpperCase();
        if (byAlias[key]) { byAlias[key].ways++; continue; }
        rows[j].ways = 1;
        byAlias[key] = rows[j];
        into.push(rows[j]);
      }
      return into;
    }

    var out = collapse(scored, []);

    /* Top up only if the shelf would otherwise come up short — which is judged
       on distinct frames, after colourways collapse. Counting raw rows was the
       bug: eight rows of three lines read as a full shelf and the top-up never
       fired, leaving three frames for anyone wanting sports on a square, heart
       or diamond face. Neutral-fit frames land after every frame that
       positively suits the face, never among them. */
    if (out.length < NEUTRAL_FALLBACK_AT) collapse(neutral, out);

    return out;
  }

  function archetypeFor(answers, top) {
    var key = answers.wear === 'sport' ? 'sport' : answers.vibe;
    for (var i = 0; i < ARCHETYPES.length; i++) if (ARCHETYPES[i].k === key) return ARCHETYPES[i];
    return DEFAULT_ARCHETYPE;
  }

  /* Which drawn frame best represents the recommendation so far. */
  function frameFor(answers, top) {
    if (top && top.length) {
      for (var i = 0; i < FRAME_FOR.length; i++) if (top[0].traits[FRAME_FOR[i]]) return FRAME_FOR[i];
    }
    var face = answers.face;
    if (!face) return 'rect';
    var t = FIT[face] || FIT.oval, best = 'rect', bestV = -Infinity;
    for (var k in t) {
      if (FRAME_FOR.indexOf(k) === -1) continue;
      if (t[k] > bestV) { bestV = t[k]; best = k; }
    }
    return best;
  }

  /* ------------------------------------------------------------------ view */

  function Quiz(root) {
    this.root = root;
    this.answers = {};
    this.order = [];
    this.asked = [];
    this.at = 0;
    this.products = [];
    this.count = parseInt(root.dataset.results, 10) || 4;
    this.hideOOS = root.dataset.hideOos === 'true';
    this.persist = root.dataset.persist === 'true';
    this.themeCards = root.dataset.themeCards === 'true';
    this.cardSection = root.dataset.cardSection || 'shades-quiz-card';
    this.key = 'psq:' + (root.dataset.uid || 'x');
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var tag = root.querySelector('[data-psq-products]');
    if (tag) { try { this.products = JSON.parse(tag.textContent) || []; } catch (e) { this.products = []; } }

    this.el = {
      screens: root.querySelectorAll('[data-screen]'),
      rail: root.querySelector('[data-psq-rail]'),
      step: root.querySelector('[data-psq-step]'),
      total: root.querySelector('[data-psq-total]'),
      question: root.querySelector('[data-psq-question]'),
      hint: root.querySelector('[data-psq-hint]'),
      options: root.querySelector('[data-psq-options]'),
      back: root.querySelector('[data-psq-back]'),
      skip: root.querySelector('[data-psq-skip]'),
      alias: root.querySelector('[data-psq-alias]'),
      verdict: root.querySelector('[data-psq-verdict]'),
      spec: root.querySelector('[data-psq-spec]'),
      grid: root.querySelector('[data-psq-grid]'),
      empty: root.querySelector('[data-psq-empty]'),
      resume: root.querySelector('[data-psq-resume]'),
      caption: root.querySelector('[data-psq-caption]')
    };

    this.bind();
    this.setFace(null);
    this.setFrame('rect');
    this.offerResume();
  }

  Quiz.prototype.bind = function () {
    var self = this;
    var start = this.root.querySelector('[data-psq-start]');
    if (start) start.addEventListener('click', function () { self.start(); });
    if (this.el.back) this.el.back.addEventListener('click', function () { self.back(); });
    if (this.el.skip) this.el.skip.addEventListener('click', function () { self.answer(null); });

    var retake = this.root.querySelector('[data-psq-retake]');
    if (retake) retake.addEventListener('click', function () { self.reset(); });
    var share = this.root.querySelector('[data-psq-share]');
    if (share) share.addEventListener('click', function () { self.share(share); });
    var restore = this.root.querySelector('[data-psq-restore]');
    if (restore) restore.addEventListener('click', function () {
      var saved = self.load();
      if (saved) { self.answers = saved; self.finish(true); }
    });

    /* Arrow keys walk the options; Enter/Space picks. Standard radiogroup. */
    this.el.options.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(self.el.options.querySelectorAll('[role="radio"]'));
      var i = items.indexOf(document.activeElement);
      if (i === -1) return;
      var next = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % items.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
      if (next > -1) { e.preventDefault(); items[next].focus(); }
    });
  };

  Quiz.prototype.emit = function (name, detail) {
    this.root.dispatchEvent(new CustomEvent('psq:' + name, { detail: detail, bubbles: true }));
    if (window.dataLayer && window.dataLayer.push) {
      window.dataLayer.push(Object.assign({ event: 'psq_' + name }, detail || {}));
    }
  };

  Quiz.prototype.plan = function () {
    var self = this;
    this.order = QUESTIONS.filter(function (q) {
      /* A question the visitor has already been shown stays in the plan even if
         its condition no longer holds — answering the jaw question sets the face,
         which would otherwise drop the jaw question out from under the cursor and
         skip whatever came next. Position is identity, not index. */
      if (self.asked.indexOf(q.id) > -1) return true;
      return !q.when || q.when(self.answers);
    });
  };

  Quiz.prototype.start = function () {
    this.answers = {};
    this.asked = [];
    this.at = 0;
    this.plan();
    this.root.classList.remove('is-result');
    this.emit('start', {});
    this.show('question');
    this.render();
  };

  Quiz.prototype.show = function (name) {
    Array.prototype.forEach.call(this.el.screens, function (s) {
      var on = s.dataset.screen === name;
      s.classList.toggle('is-active', on);
      s.hidden = !on;
    });
  };

  Quiz.prototype.render = function () {
    var self = this;
    this.plan();
    if (this.at >= this.order.length) return this.finish();

    var q = this.order[this.at];
    if (this.asked.indexOf(q.id) === -1) this.asked.push(q.id);
    this.el.step.textContent = String(this.at + 1).padStart(2, '0');
    this.el.total.textContent = String(this.order.length).padStart(2, '0');
    this.el.question.textContent = q.q;
    this.el.hint.textContent = q.hint || '';
    this.el.back.hidden = this.at === 0;
    this.el.skip.hidden = q.id !== 'face';

    this.el.options.innerHTML = '';
    this.el.options.setAttribute('aria-label', q.q);
    q.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'psq__opt';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', self.answers[q.id] === opt.v ? 'true' : 'false');
      b.tabIndex = i === 0 ? 0 : -1;
      b.innerHTML = '<span class="psq__opt-l"></span><span class="psq__opt-s"></span>';
      b.querySelector('.psq__opt-l').textContent = opt.l;
      b.querySelector('.psq__opt-s').textContent = opt.s || '';
      b.addEventListener('click', function () { self.answer(opt.v); });
      /* Preview the consequence on the stage before they commit. */
      b.addEventListener('mouseenter', function () { self.preview(q, opt); });
      b.addEventListener('focus', function () { self.preview(q, opt); });
      self.el.options.appendChild(b);
    });

    this.rail();
    this.el.question.focus();
    if (this.el.caption) this.el.caption.textContent = 'Step ' + (this.at + 1) + ' of ' + this.order.length;
  };

  /* Hovering a face-shape option morphs the silhouette; hovering anything else
     re-reads the frame. The stage answers before you click. */
  Quiz.prototype.preview = function (q, opt) {
    if (q.id === 'face') { this.setFace(opt.v); this.setFrame(frameFor({ face: opt.v }, null)); return; }
    if (q.id === 'jaw') {
      var f = { soft: 'round', sharp: 'square', pointed: 'heart', even: 'oval' }[opt.v];
      this.setFace(f); this.setFrame(frameFor({ face: f }, null)); return;
    }
    var trial = Object.assign({}, this.answers);
    trial[q.id] = opt.v;
    var top = rank(this.products, trial, { hideOOS: this.hideOOS });
    this.setFrame(frameFor(trial, top));
  };

  Quiz.prototype.answer = function (v) {
    var q = this.order[this.at];
    if (v === null) {
      /* Skipping the face question is what unlocks the jaw question. */
      if (q.id === 'face') this.answers.skippedFace = true;
    } else {
      this.answers[q.id] = v;
      var opt = null;
      for (var i = 0; i < q.options.length; i++) if (q.options[i].v === v) opt = q.options[i];
      if (opt && q.apply) q.apply(this.answers, v);
      this.emit('answer', { question: q.id, answer: v });
    }
    this.at++;
    this.plan();
    this.render();
  };

  Quiz.prototype.back = function () {
    if (this.at === 0) return;
    this.at--;
    /* Un-pin everything after the question we are returning to, so the path is
       free to branch differently the second time through. */
    this.asked = this.asked.slice(0, this.at + 1);
    var q = this.order[this.at];
    if (q) {
      delete this.answers[q.id];
      if (q.id === 'face') delete this.answers.skippedFace;
      if (q.id === 'jaw') { delete this.answers.face; delete this.answers.faceInferred; }
    }
    this.render();
  };

  Quiz.prototype.rail = function () {
    if (!this.el.rail) return;
    var n = this.order.length, html = '';
    for (var i = 0; i < n; i++) {
      html += '<i class="psq__tick' + (i < this.at ? ' is-done' : (i === this.at ? ' is-now' : '')) + '"></i>';
    }
    this.el.rail.innerHTML = html;
  };

  Quiz.prototype.setFace = function (shape) {
    var faces = this.root.querySelectorAll('[data-face]');
    Array.prototype.forEach.call(faces, function (f) {
      f.classList.toggle('is-on', f.dataset.face === (shape || 'oval'));
    });
    this.root.classList.toggle('is-faceless', !shape);
  };

  Quiz.prototype.setFrame = function (frame) {
    var frames = this.root.querySelectorAll('[data-frame]');
    Array.prototype.forEach.call(frames, function (f) {
      f.classList.toggle('is-on', f.dataset.frame === frame);
    });
  };

  Quiz.prototype.finish = function (restored) {
    var self = this;
    var results = rank(this.products, this.answers, { hideOOS: this.hideOOS });
    var top = results.slice(0, this.count);
    var face = this.answers.face || 'oval';
    var arch = archetypeFor(this.answers, top);

    this.setFace(face);
    this.setFrame(frameFor(this.answers, top));

    this.el.alias.textContent = '[ ' + arch.n + ' ]';
    this.el.verdict.textContent = arch.d + ' ' + (WHY[face] || '');

    /* The read-out. Shows the customer we used their answers, and on what. */
    var spec = [
      ['Face', FACE_LABEL[face] + (this.answers.faceInferred ? ' (from your jawline)' : '')],
      ['Fit', { slide: 'Narrower than standard', right: 'Standard width', press: 'Wider than standard', small: 'Statement width' }[this.answers.fit] || 'Standard width'],
      ['Frame', top.length ? (top[0].meta.desc || 'Best available fit') : '—'],
      ['Tint', { dark: 'Dark — black, brown, smoke', light: 'Light — blue, beige, clear' }[this.answers.tint] ||
                (this.answers.wear === 'drive' || this.answers.wear === 'sport' ? 'Polarised preferred' : 'No preference')]
    ];
    this.el.spec.innerHTML = spec.map(function (r) {
      return '<li><b>' + r[0] + '</b><span></span></li>';
    }).join('');
    Array.prototype.forEach.call(this.el.spec.querySelectorAll('li span'), function (s, i) {
      s.textContent = spec[i][1];
    });

    this.renderCards(top);

    var fb = this.root.dataset.fallback;
    if (!top.length) {
      this.el.empty.hidden = false;
      this.el.empty.innerHTML = 'Nothing in stock matches that fitting exactly right now.' +
        (fb ? ' <a href="' + fb + '">Browse the whole shelf</a> — or retake it with a wider budget.' : '');
    } else {
      this.el.empty.hidden = true;
    }

    this.show('result');
    this.root.classList.add('is-result');
    if (this.el.caption) this.el.caption.textContent = 'Your fit';
    if (this.persist && !restored) this.save();
    this.emit('complete', {
      face: face, archetype: arch.n,
      products: top.map(function (r) { return r.p.h; })
    });
  };

  /* Results are rendered twice over: a built-in card goes in immediately so the
     shelf is never empty, then the theme's own card-product markup replaces it
     as it arrives. That way the recommendations are the same cards the
     collection pages use — same badges, same price formatting, same sale
     highlighting — without this file having to imitate any of it. */
  Quiz.prototype.renderCards = function (top) {
    var self = this;
    this.el.grid.innerHTML = '';
    top.forEach(function (r, i) {
      var slot = document.createElement('div');
      slot.className = 'psq__slot';
      slot.style.setProperty('--i', i);

      var body = document.createElement('div');
      body.className = 'psq__slot-body';
      body.appendChild(self.fallbackCard(r));
      slot.appendChild(body);

      if (i === 0) {
        var flag = document.createElement('b');
        flag.className = 'psq__flag';
        flag.textContent = 'Best fit';
        slot.appendChild(flag);
      }
      self.el.grid.appendChild(slot);
      if (self.themeCards) self.loadThemeCard(body, r);
    });
  };

  /* Section Rendering API: asking for a section against a product URL puts that
     product in scope, which is what lets a storefront-side quiz render a
     server-side product card. */
  Quiz.prototype.loadThemeCard = function (mount, r) {
    var url = r.p.u + (r.p.u.indexOf('?') > -1 ? '&' : '?') + 'section_id=' + encodeURIComponent(this.cardSection);
    fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (res) { return res.ok ? res.text() : null; })
      .then(function (html) {
        if (!html) return;
        var trimmed = html.trim();
        /* A missing or misnamed section hands back the whole page instead of a
           card. Keep the fallback rather than injecting a document. */
        if (!trimmed || /^<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) return;
        var holder = document.createElement('div');
        holder.innerHTML = trimmed;
        if (!holder.querySelector('.card-product, .card')) return;
        mount.innerHTML = '';
        while (holder.firstChild) mount.appendChild(holder.firstChild);
      })
      .catch(function () { /* keep the fallback card */ });
  };

  /* Used until the theme card lands, and permanently if it never does. Built
     from the theme's own card tokens so the two are hard to tell apart. */
  Quiz.prototype.fallbackCard = function (r) {
    var p = r.p, m = r.meta;
    var a = document.createElement('a');
    a.className = 'psq__card';
    a.href = p.u;

    var fig = document.createElement('figure');
    fig.className = 'psq__shot';
    if (p.i) {
      var img = document.createElement('img');
      img.src = p.i;
      img.alt = p.ia || p.t;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        fig.classList.add('is-blank');
        img.remove();
      });
      fig.appendChild(img);
    } else {
      fig.classList.add('is-blank');
    }
    a.appendChild(fig);

    var body = document.createElement('div');
    body.className = 'psq__meta';

    var h = document.createElement('h3');
    h.className = 'psq__name';
    h.textContent = p.t;
    body.appendChild(h);

    var pr = document.createElement('p');
    pr.className = 'psq__price';
    pr.textContent = p.pf;
    if (p.cp) {
      var was = document.createElement('s');
      was.textContent = p.cp;
      pr.appendChild(was);
    }
    body.appendChild(pr);

    if (r.ways > 1) {
      var w = document.createElement('p');
      w.className = 'psq__ways';
      w.textContent = r.ways + ' colourways';
      body.appendChild(w);
    }
    if (!p.a) {
      var oos = document.createElement('p');
      oos.className = 'psq__ways';
      oos.textContent = 'Sold out';
      body.appendChild(oos);
    }

    a.appendChild(body);
    return a;
  };

  Quiz.prototype.share = function (btn) {
    var alias = this.el.alias.textContent;
    var names = Array.prototype.map.call(
      this.el.grid.querySelectorAll('.psq__name, .card-product-title-h3'),
      function (n) { return n.textContent.trim(); }
    ).join(', ');
    var text = 'My Project Shades fitting: ' + alias + ' — ' + names + ' — ' + location.href;
    var done = function () {
      var was = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = was; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
    }
  };

  Quiz.prototype.save = function () {
    try { localStorage.setItem(this.key, JSON.stringify(this.answers)); } catch (e) {}
  };
  Quiz.prototype.load = function () {
    try {
      var v = localStorage.getItem(this.key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  };
  Quiz.prototype.offerResume = function () {
    if (!this.persist || !this.el.resume) return;
    if (this.load()) this.el.resume.hidden = false;
  };
  Quiz.prototype.reset = function () {
    try { localStorage.removeItem(this.key); } catch (e) {}
    this.setFace(null);
    this.root.classList.remove('is-result');
    this.show('intro');
    if (this.el.resume) this.el.resume.hidden = true;
    if (this.el.caption) this.el.caption.textContent = 'Your fit, so far';
  };

  /* ------------------------------------------------------------------ boot */

  function boot() {
    var nodes = document.querySelectorAll('[data-psq]');
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.__psq) return;
      n.__psq = new Quiz(n);
    });
  }

  /* Guarded so the scoring half of this file can be required and tested
     outside a browser. In the theme, `document` always exists. */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
    /* Theme editor re-renders the section on every setting change. */
    document.addEventListener('shopify:section:load', boot);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FIT: FIT, QUESTIONS: QUESTIONS, WHY: WHY, ARCHETYPES: ARCHETYPES,
                       read: read, parseTitle: parseTitle, rank: rank,
                       archetypeFor: archetypeFor, frameFor: frameFor };
  }
})();
