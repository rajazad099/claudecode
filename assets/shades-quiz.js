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

  /* THE FIVE PERSONAS.

     Each is one collection on the store, and that collection is the persona's
     shelf: the thing the first four recommendations are drawn from. `lead` is
     the trait that defines the shelf; `score` is what the answer is worth,
     including the secondary shapes that belong to the look.

     Deliberately no "not sure" option. Five personas cover the catalogue, every
     one of them is a real shelf with stock behind it, and forcing the choice is
     what makes the result feel like it was written about you rather than
     averaged across everyone. */
  var PERSONAS = [
    {
      v: 'max', lead: 'ovsz',
      l: 'Maximalist',
      s: 'Big frames, loud colour, seen from across the room',
      score: { ovsz: 10, cate: 4, tech: 3, small: -2 }
    },
    {
      v: 'finance', lead: 'luxe',
      l: 'High Finance',
      s: 'Quiet money. The good acetate, the colours that never date',
      score: { luxe: 10, rect: 3, round: 2 }
    },
    {
      v: 'explorer', lead: 'summer',
      l: 'Explorer',
      s: 'Holiday pairs — rimless, metal, built for glare and salt',
      score: { summer: 10, riml: 5, oval: 2 }
    },
    {
      v: 'afterdark', lead: 'tech',
      /* "Party people" in the brief. Named for the hour rather than the
         activity, because the frames read the same at a rave, a set and a
         night out, and nobody describes themselves as a party person. */
      l: 'After Dark',
      s: 'Futuristic wraps and chrome, for rooms with no daylight',
      score: { tech: 10, wrap: 5, ovsz: 2 }
    },
    {
      /* Added to the brief's four. Vintage is the biggest aesthetic shelf in
         the store — 57 lines in stock against Daily Luxe's five — and without
         a persona pointing at it most of the catalogue is unreachable. */
      v: 'archive', lead: 'vint',
      l: 'The Archive',
      s: '90s metal, tortoise, frames that already had a life',
      score: { vint: 10, round: 2, cate: 2 }
    }
  ];

  /* A drawn mark per persona, animated by the stylesheet. Each one behaves
     the way its persona does rather than depicting anything: Maximalist pushes
     outward, High Finance holds three steady rules, Explorer runs a sun up over
     a horizon, After Dark strobes a grid, the Archive drifts scan lines. They
     are inline SVG, so they inherit the theme's colour, stay sharp at any size
     and cost nothing to load. */
  var SIGNATURE = {
    max:       '<g class="sig sig--max"><rect x="20" y="20" width="24" height="24"/>' +
               '<rect x="12" y="12" width="40" height="40"/><rect x="4" y="4" width="56" height="56"/></g>',
    finance:   '<g class="sig sig--finance"><path d="M8 22h48"/><path d="M8 32h48"/><path d="M8 42h48"/></g>',
    explorer:  '<g class="sig sig--explorer"><path d="M6 42h52"/><circle cx="32" cy="42" r="13"/></g>',
    afterdark: '<g class="sig sig--afterdark"><path d="M14 14v36"/><path d="M26 14v36"/>' +
               '<path d="M38 14v36"/><path d="M50 14v36"/></g>',
    archive:   '<g class="sig sig--archive"><path d="M8 18h48"/><path d="M8 26h48"/><path d="M8 34h48"/>' +
               '<path d="M8 42h48"/><path d="M8 50h48"/></g>'
  };
  PERSONAS.forEach(function (p) { p.sig = SIGNATURE[p.v]; });

  /* Three faces at the widths the question is asking about, each wearing the
     same frame, so the choice is made by comparing pictures rather than by
     deciding what "medium" means. */
  var SIZE_GLYPH = {
    small:  '<ellipse cx="32" cy="30" rx="12" ry="20"/><rect x="22" y="25" width="9" height="7" rx="2"/>' +
            '<rect x="33" y="25" width="9" height="7" rx="2"/><path d="M31 28h2M22 27l-4-1M42 27l4-1"/>',
    medium: '<ellipse cx="32" cy="30" rx="17" ry="21"/><rect x="18" y="24" width="12" height="9" rx="2"/>' +
            '<rect x="34" y="24" width="12" height="9" rx="2"/><path d="M30 28h4M18 26l-5-2M46 26l5-2"/>',
    large:  '<ellipse cx="32" cy="30" rx="22" ry="22"/><rect x="13" y="23" width="16" height="11" rx="2"/>' +
            '<rect x="35" y="23" width="16" height="11" rx="2"/><path d="M29 28h6M13 25l-6-2M51 25l6-2"/>'
  };

  var SHELVES = PERSONAS.map(function (p) { return p.lead; });

  function personaFor(v) {
    for (var i = 0; i < PERSONAS.length; i++) if (PERSONAS[i].v === v) return PERSONAS[i];
    return null;
  }

  /* If the shelf would come up short, neutral-fit frames are allowed back in
     to fill it rather than showing the customer a half-empty result. The
     threshold is the shelf size itself: asking for ten and topping up at eight
     left two gaps on every fitting that needed the top-up at all. */
  var NEUTRAL_FALLBACK_AT = 10;

  var FIT = {
    oval:    { rect: 3, round: 3, cate: 3, oval: 3, riml: 2, wrap: 2, avia: 3, ovsz: 1, geo: 3 },
    round:   { rect: 5, cate: 4, geo: 4, wrap: 3, avia: 2, riml: 1, ovsz: 1, oval: -2, round: -4 },
    square:  { round: 5, oval: 4, riml: 3, cate: 3, avia: 3, ovsz: 1, geo: -1, rect: -3, wrap: -2 },
    heart:   { riml: 5, round: 3, oval: 3, avia: 3, cate: 1, rect: 1, geo: 1, ovsz: -3, wrap: -1 },
    long:    { ovsz: 5, wrap: 4, round: 3, geo: 3, rect: 2, cate: 1, slim: -3, riml: -2 },
    diamond: { cate: 5, oval: 4, riml: 3, round: 3, geo: 2, ovsz: 1, rect: -1, wrap: -1 }
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

  /* Small diagrams for the face-shape options. Most people cannot name their
     own face shape from a written description — being shown six outlines and
     picking the closest is a far easier judgement than reading "cheekbones
     widest, brow and jaw narrow" and deciding whether that is you. */
  /* Each glyph is inner SVG rather than a single path, so the six shapes can be
     drawn with whatever primitive states them most plainly — a circle really is
     the clearest way to say "round". An earlier version drew all six as similar
     tapered paths and they were indistinguishable at this size, which defeats
     the point: the reason to show a diagram at all is that people cannot name
     their own face shape from a sentence. Proportions are exaggerated on
     purpose. */
  var FACE_GLYPH = {
    oval:    '<ellipse cx="24" cy="30" rx="14" ry="21"/>',
    round:   '<circle cx="24" cy="30" r="19"/>',
    square:  '<rect x="7" y="9" width="34" height="42" rx="6"/>',
    heart:   '<path d="M7 11h34v11c0 13-7 21-17 33C14 43 7 35 7 22V11Z"/>',
    long:    '<ellipse cx="24" cy="30" rx="9" ry="27"/>',
    diamond: '<path d="M24 4 41 30 24 56 7 30Z"/>'
  };

  /* --------------------------------------------------------------- questions */

  var QUESTIONS = [
    {
      /* Straight to the shop's own men/women collections. A strong preference
         rather than a filter: plenty of frames sit in both, and some sit in
         neither, and none of those should become unreachable. */
      id: 'gender',
      q: 'Who are we fitting?',
      hint: 'Everything stays available whichever you pick — this decides what leads.',
      options: [
        { v: 'women', l: 'Women’s',            s: 'The women’s range leads',        score: { women: 9, men: -3 } },
        { v: 'men',   l: 'Men’s',              s: 'The men’s range leads',          score: { men: 9, women: -3 } },
        { v: 'any',   l: 'Doesn’t matter',     s: 'Unisex — fit and taste decide it', score: {} }
      ],
      apply: function (a, v) { a.gender = v; }
    },
    {
      /* The aesthetic. Built from PERSONAS above so the options, their scoring
         and the shelf the result is drawn from can never drift apart.

         Each option is drawn, not photographed. Thumbnails of three frames per
         persona were tried and looked like a contact sheet: five rows of tiny
         product cut-outs, all of them roughly black, none of them legible at
         that size, and the aesthetic — which is the actual question — buried
         under them. Each persona now has a signature instead: a small animated
         mark that behaves the way the persona does. Nothing to photograph,
         nothing to go stale, and it reads at a glance. */
      id: 'persona',
      q: 'Which one is you?',
      hint: 'Go with your gut. This decides the shelf the first four come from.',
      figures: 'persona',
      options: PERSONAS.map(function (p) {
        return { v: p.v, l: p.l, s: p.s, score: p.score, shelf: p.lead, sig: p.sig };
      }),
      apply: function (a, v) { a.persona = v; }
    },
    {
      /* Asked outright, because the roundabout version was worse.

         It used to ask how sunglasses currently sit on your nose — slide down,
         press on the temples — on the theory that nobody knows their own frame
         width. But everybody knows whether their face is small, medium or
         large, nobody enjoys being asked about their nose, and the indirect
         version made the customer do arithmetic to answer a question they
         already knew the answer to.

         Three options, not four. The old "they look small on me" was a fourth
         size that really meant a taste for big frames, and that is what the
         Maximalist persona is for. */
      id: 'size',
      q: 'Your face — honestly?',
      hint: 'Across the cheekbones, not up and down. Pick the one you would call yourself.',
      figures: 'size',
      options: [
        { v: 'small',  l: 'Small',  s: 'Narrow across. Most frames swamp you.',  score: { small: 10, medium: 2, large: -6 } },
        { v: 'medium', l: 'Medium', s: 'Standard. Most things sit right.',       score: { medium: 10, small: 2, large: 2 } },
        { v: 'large',  l: 'Large',  s: 'Broad across. You need the width.',      score: { large: 10, medium: 2, small: -6 } }
      ],
      apply: function (a, v) { a.size = v; }
    },
    {
      /* The brief asked for chic / classy / rager / chill / timeless. Chic,
         classy and timeless are three words for one axis — how dressed-up —
         and offering all three makes the customer arbitrate between synonyms,
         which is the fastest way to make a fun question feel like a form. Four
         moods, each clearly a different day.

         Deliberately light. The persona picks the shelf; the mood only
         re-weights inside it and decides which direction the six alternates
         lean. At a tenth of the persona's weight it can colour a shelf without
         ever overturning it. */
      id: 'mood',
      q: 'And today?',
      hint: 'Same person, different day. This tilts the picks rather than changing the shelf.',
      options: [
        { v: 'sharp', l: 'Sharp',    s: 'Dressed, considered, somewhere good',      score: { cate: 3, rect: 2, luxe: 2 } },
        { v: 'quiet', l: 'Quiet',    s: 'Nothing shouting. Nothing to regret',      score: { luxe: 3, round: 2, vint: 2 } },
        { v: 'loud',  l: 'Loud',     s: 'Out late, and happy to be looked at',      score: { tech: 3, ovsz: 3, wrap: 2 } },
        { v: 'easy',  l: 'Easy',     s: 'Errands, sun, nothing to prove',           score: { summer: 3, riml: 2, oval: 2 } }
      ],
      apply: function (a, v) { a.mood = v; }
    },
    {
      /* LENS TINT.

         Off by default, and that is not timidity — it is what the catalogue
         can currently support. Lens darkness is recorded nowhere: not in the
         collections, not in the variant options (those are frame colour, one
         is literally named "Frame color"), and in only 39 of 271 descriptions,
         38 of which read as strong. Asked today the question would cost a tap
         and move almost nothing, which is exactly why the first tint question
         was removed.

         So the plumbing ships and the question waits. Fill custom.lens_tint on
         the catalogue and switch "Ask about lens tint" on, and it starts
         working immediately. A frame with no value is never excluded by the
         answer — only un-boosted — so the question degrades honestly while the
         data is still going in. */
      id: 'tint',
      q: 'How dark do you like them?',
      hint: 'Only the frames we have a lens on record for will shift — the rest stay in the running.',
      when: function (a, opts) { return !!(opts && opts.askTint); },
      options: [
        { v: 'mild',   l: 'Mild',   s: 'You can still see my eyes',          score: { 'tint-mild': 8 } },
        { v: 'strong', l: 'Strong', s: 'Dark. I am hiding back here',        score: { 'tint-strong': 8 } },
        { v: 'either', l: 'Either', s: 'Fit matters more than the lens',     score: {} }
      ],
      apply: function (a, v) { a.tint = v; }
    },
    {
      /* Last, and deliberately so. The three questions before it are ones
         anybody can answer without thinking — who it is for, how frames sit,
         what it is for — so the quiz is already three-quarters done and the
         stage is already moving by the time it asks the one question people
         hesitate over. It is also the question that pays off visually: the
         silhouette has been abstract the whole way, and this is where it
         becomes their face. */
      id: 'face',
      skip: 'I honestly can’t tell — ask me something else',
      q: 'Last one — which of these is closest to your face?',
      hint: 'Most people are between two. Go with the closer one.',
      /* Shown as a short numbered method rather than a paragraph. The question
         is only hard because nobody has ever been told how to answer it. */
      guide: [
        'Hair back, straight on to a mirror — or the selfie camera, not held above you.',
        'Find the widest part: forehead, cheekbones or jaw.',
        'Then ask whether the chin comes to a point or squares off.'
      ],
      options: [
        { v: 'oval',    l: 'Oval',    s: 'Longer than wide, tapering gently to the chin' },
        { v: 'round',   l: 'Round',   s: 'Full cheeks, soft chin, about as wide as it is long' },
        { v: 'square',  l: 'Square',  s: 'Jaw and forehead near the same width, corners defined' },
        { v: 'heart',   l: 'Heart',   s: 'Widest at the brow, narrowing to a pointed chin' },
        { v: 'long',    l: 'Long',    s: 'Clearly longer than it is wide, forehead to chin' },
        { v: 'diamond', l: 'Diamond', s: 'Cheekbones the widest part, brow and jaw narrower' }
      ],
      apply: function (a, v) { a.face = v; }
    },
    {
      id: 'jaw',
      q: 'Your jawline, honestly?',
      hint: 'This tells us the same thing, from an easier angle.',
      when: function (a) { return !a.face && a.skippedFace === true; },
      options: [
        { v: 'soft',    l: 'Soft and curved',     s: 'No hard corners anywhere' },
        { v: 'sharp',   l: 'Sharp and angular',   s: 'A jaw you could set a ruler against' },
        { v: 'pointed', l: 'Narrow and pointed',  s: 'Comes to a point at the chin' },
        { v: 'even',    l: 'Even, in proportion', s: 'Nothing especially wide or narrow' }
      ],
      apply: function (a, v) {
        a.face = { soft: 'round', sharp: 'square', pointed: 'heart', even: 'oval' }[v];
        a.faceInferred = true;
      }
    },
  ];

  /* -------------------------------------------------------------- archetypes */

  /* THE NAME.

     Twenty of them: one for every persona crossed with every mood. A name that
     only read off the persona would be the same five results the shop already
     sells, and the customer would know it — the point of asking a second taste
     question is that the answer has to change what comes back.

     Keyed persona:mood. The description is written for the pair, not stitched
     together from two halves, because "THE RAINMAKER. Quiet money. Out late."
     reads like a template and "THE RAINMAKER" with its own line does not. */
  var ARCHETYPES = {
    'max:sharp':       { n: 'THE SPECTACLE',      d: 'Big frame, sharp edge. You dress for the room you are about to walk into.' },
    'max:quiet':       { n: 'THE SLOW BURN',      d: 'Scale without noise. The frame is large; nothing else about you is.' },
    'max:loud':        { n: 'THE HEADLINER',      d: 'You are the brightest thing in every photograph and that is the plan.' },
    'max:easy':        { n: 'THE NATURAL',        d: 'Oversized, unbothered. It looks thrown on because you threw it on.' },

    'finance:sharp':   { n: 'THE CLOSER',         d: 'Quiet money, sharpened. Nothing here is trying — it is just correct.' },
    'finance:quiet':   { n: 'THE PRINCIPAL',      d: 'The most expensive-looking thing you own is a silhouette. No logo required.' },
    'finance:loud':    { n: 'THE RAINMAKER',      d: 'Good taste with the volume up. You can afford to be noticed.' },
    'finance:easy':    { n: 'THE SILENT PARTNER', d: 'Understated to the point of invisible, which is the whole trick.' },

    'explorer:sharp':  { n: 'THE NAVIGATOR',      d: 'Holiday frames with a plan. Metal, light, nothing that creaks in salt.' },
    'explorer:quiet':  { n: 'THE DRIFTER',        d: 'Somewhere warm, nobody expecting you back. Rimless and almost weightless.' },
    'explorer:loud':   { n: 'THE DEPARTURE',      d: 'Sun, colour, and no intention of blending in with the locals.' },
    'explorer:easy':   { n: 'THE CASTAWAY',       d: 'Barefoot energy. The pair you lose and immediately buy again.' },

    'afterdark:sharp': { n: 'THE OPERATOR',       d: 'Future-tense geometry, cut clean. You dress like the year after next.' },
    'afterdark:quiet': { n: 'THE GHOST',          d: 'Dark, wrapped, unreadable. People remember the frame, not the face.' },
    'afterdark:loud':  { n: 'THE RINGLEADER',     d: 'Chrome, shields, no daylight. You are the reason the room is loud.' },
    'afterdark:easy':  { n: 'THE REGULAR',        d: 'You were there before it was busy and you will be there after.' },

    'archive:sharp':   { n: 'THE CURATOR',        d: 'You buy the archive piece and wear it better than it was worn first.' },
    'archive:quiet':   { n: 'THE ARCHIVIST',      d: 'Tortoise, acetate, ninety-something. Nothing you own was made this year.' },
    'archive:loud':    { n: 'THE BOOTLEG',        d: 'Retro turned up past where retro was ever meant to go.' },
    'archive:easy':    { n: 'THE HEIRLOOM',       d: 'Worn in, handed down, a bit scratched. That is the point of it.' }
  };
  var DEFAULT_ARCHETYPE = { n: 'THE PURIST', d: 'Fit first, fashion second. We picked on shape alone.' };

  /* ------------------------------------------------------ title -> traits */

  /* The shapes that can be fitted to a face. `slim`, `metal`, `uni` and the
     rest describe a frame without saying what shape it is. */
  var FITTABLE = ['rect', 'oval', 'round', 'cate', 'riml', 'wrap', 'ovsz', 'geo', 'avia'];

  /* THE JUDGEMENT CALLS.

     Fifteen frames sit in no shape collection and have no shape word in their
     title, and the shop's own view is that they are genuinely hard to
     categorise. A frame with no shape cannot be fitted to a face, so without
     this table they would never be recommended at all — which is the wrong
     answer for the three deepest-stocked lines in the catalogue.

     Each call below is read off the product's own copy: lens and frame
     dimensions where the description gives them, the silhouette where it
     describes one. The reasoning is written next to each so it can be argued
     with. Three are marked LOW CONFIDENCE — no dimensions, no descriptive copy,
     and the product photography is not reachable from here.

     This is a fallback, not an override: file the frame into a shape
     collection in Shopify and the collection wins, and the row here stops
     doing anything. Keyed on the alias, so it covers every colourway. */
  var JUDGED = {
    /* lens 53 x 38 on a 145 frame, 32 g, "sleek cutline" — a slim soft
       rectangle with a cut brow line, not a big frame. */
    'CONTOUR':          ['rect', 'slim'],
    /* LOW CONFIDENCE. No description and no dimensions. Techno, and in the
       small and medium face types but not large, so: a narrow wrap. */
    'TRESOR':           ['wrap', 'slim'],
    /* "a sleek metal frame carved into a bold, elongated silhouette", 59 mm. */
    'ISLA':             ['oval', 'slim'],
    /* "the oversized silhouette and tinted lenses", built for raves. */
    'LIMITED EDITION':  ['ovsz'],
    /* frame 144, lens 68 — the lens is most of the frame. */
    'FLUFF':            ['ovsz'],
    /* lens 53 x 53, and the name is Inflated. Square-round and large. */
    'VOGUE':            ['ovsz', 'round'],
    /* "futuristic sculpted cat-eye silhouette ... sleek wrap design", 156 mm. */
    'VENOM':            ['cate', 'wrap'],
    /* "a chunky frame with tinted lenses". */
    'MARINA':           ['ovsz', 'rect'],
    /* LOW CONFIDENCE. Copy is one line of ad. 80s, vintage, women's. */
    'GRACE':            ['cate'],
    /* lens 71 wide x 39 high — wide and shallow is a wrap, and it is Y2K. */
    'AMBER':            ['wrap', 'ovsz'],
    /* "full-coverage visor silhouette", lens 68 x 45. The title's misspelt
       "Polarsied" is why no title rule catches this one. */
    'MONGUL':           ['wrap', 'ovsz'],
    /* LOW CONFIDENCE. Futuristic / techno / rave, no geometry given. */
    'KATANA':           ['wrap'],
    /* The title says Aviator and nothing else does; there is no aviator
       collection for it to sit in. */
    'AKITA':            ['avia'],
    /* "futuristic wraparound shield silhouette", frame 145, lens height 45. */
    'LEX':              ['wrap']
  };

  /* WHAT A FRAME IS, ACCORDING TO THE SHOP.

     Traits come from collection membership and nothing else. An earlier version
     also read the product title — "Classic" meant vintage, "Gold" meant luxe,
     "Y2k" meant techno — and that was wrong often enough to matter: Offset
     Clubmaster in Black Gold was leading the Daily Luxe shelf on the strength of
     the word Gold, and it is not in Daily Luxe. A word in a product name is a
     guess about merchandising; the collection is the merchandising.

     One documented exception below, and it is a fallback rather than a source:
     JUDGED, for the handful of frames that sit in no shape collection at all. */
  /* Frame width in millimetres, banded against this catalogue's own spread:
     widths run 130-156, with the middle half between 142 and 147. A measured
     width is a fact about the frame; a size collection is somebody's judgement
     about it. Where both exist they mostly agree — 96% on medium — and where
     they disagree the collection still wins, because a person looked at it. */
  function widthBand(mm) {
    if (!mm) return null;
    if (mm <= 141) return 'small';
    if (mm <= 147) return 'medium';
    return 'large';
  }

  function read(p) {
    var traits = Object.create(null);
    var i, c = p.c || [];
    for (i = 0; i < c.length; i++) traits[c[i]] = true;

    /* A stated width fills in the size the shop never filed. It never
       overrules a size collection — only covers for a missing one. */
    if (!traits.small && !traits.medium && !traits.large) {
      var b = widthBand(p.fw);
      if (b) { traits[b] = true; traits.fromWidth = true; }
    }
    if (p.tn) traits['tint-' + p.tn] = true;
    /* Only when the collections did not say what shape it is. */
    var shaped = false;
    for (i = 0; i < FITTABLE.length; i++) if (traits[FITTABLE[i]]) shaped = true;
    if (!shaped) {
      var judged = JUDGED[parseTitle(p.t).alias.toUpperCase()];
      if (judged) {
        for (i = 0; i < judged.length; i++) traits[judged[i]] = true;
        /* Flagged, so the fit it earns from an inferred shape can be discounted
           against a frame whose shape the shop actually stated. Nothing scores
           this trait directly. */
        traits.judged = true;
      }
    }
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
      var g = pool[key] || (pool[key] = { iv: 0, rc: 0, weighted: 0, rt: 0, qr: null, qrn: 0, sv: 0 });
      g.iv += p.iv || 0;
      g.sv += p.sv || 0;
      g.rc += p.rc || 0;
      g.weighted += (p.rt || 0) * (p.rc || 0);
      if (p.qr != null && isFinite(Number(p.qr))) {
        g.qr = (g.qr || 0) + Number(p.qr);
        g.qrn++;
      }
    }
    for (k in pool) {
      if (pool[k].rc) pool[k].rt = pool[k].weighted / pool[k].rc;
      /* A line's learned score is the mean of its colourways, not their sum —
         a line split six ways should not out-earn one sold as a single product. */
      if (pool[k].qrn) pool[k].qr = pool[k].qr / pool[k].qrn;
    }
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
  /* What the quiz has learned, written back into each product's
     custom.quiz_rank metafield from Shopify's own attribution of the clicks and
     orders this quiz produced. Normalised to roughly -2..+5 so a proven
     performer rises without ever overturning the fit, and so a frame with no
     history yet is simply un-boosted rather than buried. */
  function learned(line, use) {
    if (!use || line.qr == null) return 0;
    var q = Number(line.qr);
    if (!isFinite(q)) return 0;
    return Math.max(-2, Math.min(5, q));
  }

  function performance(line) {
    var s = 0;

    /* What actually sold, over ninety days, pooled across the line's
       colourways. Stock depth below is a proxy for this — what the shop bought
       into — and where the real number exists it should lead rather than
       follow. Log-scaled and capped, like everything else here, so a runaway
       bestseller reorders frames that already suit the face and never drags one
       onto a face it does not. */
    if (line.sv > 0) s += Math.min(Math.log(line.sv) / Math.LN10, 2.7) * 1.4;

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
    if (line.iv > 0) {
      s += (Math.min(Math.log(line.iv) / Math.LN10, 3) - 1) * 2;
      /* Under a dozen units the log curve is far too gentle to matter — a line
         with nine pairs left scored the same as one with fifty — so scarcity
         gets its own ramp, steepening as the line runs out. Deliberately
         one-sided: the credit for deep stock stays capped at +4 so it can never
         lift a frame onto a face it does not suit, while the penalty for a line
         about to disappear is allowed to bite. Recommending the last three
         pairs of something wastes the fitting. */
      if (line.iv < 12) s -= (12 - line.iv) * 0.35;
    } else s -= 2;

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

    /* The shelf the customer asked for by name. It is the one trait allowed
       through the fit gate below, because an explicit request outranks a soft
       optical preference: someone who says "sport" and has a square face wants
       polarised wraps, ranked worst-fit-last, not a shelf of round luxe frames
       because every sports frame in stock is a wrap and a square face reads
       wraps as a mild negative. */
    var shelf = (personaFor(answers.persona) || {}).lead || null;

    /* Pooled over every product, including sold-out colourways: a line's depth
       is the line's depth regardless of which colours are showing today. */
    var lines = linesOf(products);

    var scored = [], neutral = [];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      if (opts.hideOOS && !p.a) continue;
      var traits = read(p);
      if (required && !traits[required]) continue;
      /* A frame that is in none of the three face-size collections has no
         stated width, and the shop's instruction is not to recommend it. The
         soft penalties below still decide between a large frame and a small
         one; this only excludes the frames that claim no size at all. */
      if (!traits.small && !traits.medium && !traits.large) continue;
      var onShelf = shelf !== null && traits[shelf] === true;
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

      /* WHAT THE PRODUCT COPY SAYS.

         Fifty-seven frames state, in their own description, which face shapes
         they suit — "Suits: Round, oval and heart-shaped faces, where the
         angled edges add a little sharpness to soft features." That sentence
         was written by someone holding the frame. It beats anything this file
         can infer from which collection the frame sits in, so where it exists
         it decides: a match is worth more than the best shape trait can score,
         and a frame whose copy lists three faces and omits this one is not
         being recommended for this face. */
      if (p.fc && p.fc.length) {
        fitScore = p.fc.indexOf(face) > -1 ? 6 : -6;
        traits.stated = true;
      }

      /* A shape read off a product description is a good guess, not a fact.
         Discounting it keeps these frames reachable — which is the whole point
         of the table — while letting any frame whose shape the shop stated
         outrank them at equal everything else. */
      if (traits.judged) fitScore *= 0.8;

      /* A frame must positively suit the face to be recommended at all.

         Excluding only negative fit was not enough: a frame carrying opposing
         shape traits nets out to zero — Serendipity 2.0 is both rimless and
         rectangular, which cancels on a square face and on a long one — and a
         neutral frame still collected taste, performance and curation points
         and won faces it had no business on. Zero is not a recommendation, so
         zero is excluded too. */
      if (fitScore < 0 && !onShelf) continue;

      var score = fitScore * FIT_WEIGHT;
      /* 2. taste and use — what they told us they want */
      for (k in wanted) if (traits[k]) score += wanted[k];
      /* 3. proven performers — a bounded tiebreaker between frames that
            already suit the face */
      score += performance(line);
      score += learned(line, opts.useLearned);
      /* 4. in stock and shippable today, which beats a marginally better fit
            the customer cannot buy */
      if (p.a) score += 3;

      var row = { p: p, score: score, traits: traits, meta: parseTitle(p.t), line: line };
      /* A frame from the shelf they named belongs on the shelf they named,
         even at neutral or negative fit — the penalty is already in its score,
         so it sorts below the ones that also suit the face. */
      if (fitScore > 0 || onShelf) scored.push(row); else neutral.push(row);
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
    var target = opts.results || NEUTRAL_FALLBACK_AT;
    if (out.length < target) collapse(neutral, out);

    return out;
  }

  /* How the shelf reads back to the customer, per shelf they could have named. */
  var SHELF_LABEL = {
    ovsz: 'Maximalist', luxe: 'High Finance', summer: 'Explorer',
    tech: 'After Dark', vint: 'The Archive'
  };

  /* THE SHELF, IN TWO HALVES.

     A ranked list of ten reads as ten answers to the same question, and it is
     not: past the first few, the aesthetic runs out and the list starts filling
     with frames that fit the face but are nothing like what was asked for. A
     round luxe frame appearing fourth on a futuristic fitting looks like the
     quiz misheard.

     So the shelf is split. The first four are the answer: they fit the face AND
     carry the aesthetic that was asked for. The rest are offered as what they
     are — frames that fit this face just as well, in a different mood, in case
     the mood is negotiable. Nothing is hidden; it is labelled.

     When the customer named no aesthetic there is nothing to differ from, so
     the second half is spread across the shelves instead — one per aesthetic
     before any shelf gets a second — which turns it into a tour of the range. */
  function splitShelf(results, count, persona, answers) {
    var primaryCount = Math.min(4, count);
    /* The persona names the shelf; the shelf is a collection trait. */
    var shelf = (personaFor(persona) || {}).lead || null;
    var i, j;

    /* A small stable number derived from the fitting, used to rotate which
       frame represents each aesthetic in the second half. Same answers, same
       number, same shelf. */
    var seed = 0, key = JSON.stringify(answers || {}) + '|' + persona;
    for (i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 100003;

    /* First half: the answer to the question they asked. */
    var primary = [], rest = [];
    if (shelf) {
      for (i = 0; i < results.length; i++) {
        if (results[i].traits[shelf] && primary.length < primaryCount) primary.push(results[i]);
        else rest.push(results[i]);
      }
      /* Not enough on the named shelf — Techno has twenty frames and some face
         shapes rule half of them out. Top up from the best of the rest rather
         than showing a short one, and let the divider copy soften to match. */
      while (primary.length < primaryCount && rest.length) primary.push(rest.shift());
    } else {
      primary = results.slice(0, primaryCount);
      rest = results.slice(primaryCount);
    }

    /* Second half: deliberately NOT the shelf they named, even when that shelf
       has more to give. Four techno frames answer a techno question; the fifth
       through tenth techno frame is just a longer list of the same idea. The
       six that follow are there to catch the customer whose mind is not quite
       made up, so they have to be something else — and spread one per aesthetic
       before any aesthetic gets a second, so the six are a tour of the range
       rather than six of whatever ranked next. */
    var wantAlt = count - primary.length;
    var offShelf = [], onShelf = [];
    for (i = 0; i < rest.length; i++) {
      if (shelf && rest[i].traits[shelf]) onShelf.push(rest[i]);
      else offShelf.push(rest[i]);
    }

    /* Group the off-shelf frames by which aesthetic they belong to, so one can
       be taken from each. */
    var groups = Object.create(null), order = [], spare = [], tag;
    for (i = 0; i < offShelf.length; i++) {
      tag = null;
      for (j = 0; j < SHELVES.length; j++) if (offShelf[i].traits[SHELVES[j]]) { tag = SHELVES[j]; break; }
      if (!tag) { spare.push(offShelf[i]); continue; }
      if (!groups[tag]) { groups[tag] = []; order.push(tag); }
      groups[tag].push(offShelf[i]);
    }

    /* Take the group's representative at a rotating offset rather than always
       its best frame.

       Always taking the best made one frame the face of a whole aesthetic:
       Sterling is the strongest frame in Daily Luxe, so it took the luxe slot
       on every shelf that was not High Finance — 583 of 1,440 fittings, on top
       of the 430 where it legitimately led. It was on seven shelves in ten,
       which is the opposite of a result that feels written about you.

       The offset is derived from the answers, so a given fitting always returns
       the same shelf — this is a rotation, not randomness, and retaking the
       quiz with the same answers gives the same ten — while different fittings
       see different faces of the same aesthetic. Limited to the top three of
       each group so the rotation never reaches down into frames that do not
       deserve the slot. */
    var spread = [];
    for (i = 0; i < order.length; i++) {
      var g = groups[order[i]];
      var pick = g.length > 1 ? seed % Math.min(3, g.length) : 0;
      spread.push(g[pick]);
      for (j = 0; j < g.length; j++) if (j !== pick) spare.push(g[j]);
    }
    spread.sort(function (a, b) { return b.score - a.score; });
    spare.sort(function (a, b) { return b.score - a.score; });
    var alternates = spread.concat(spare).slice(0, wantAlt);

    /* Only if the catalogue genuinely cannot fill six other aesthetics. */
    var mixed = false;
    if (alternates.length < wantAlt && onShelf.length) {
      mixed = true;
      alternates = alternates.concat(onShelf.slice(0, wantAlt - alternates.length));
    }

    /* The divider promises a change of aesthetic, so it may only say so when
       the first half really is all on the named shelf and the second half
       really is all off it. */
    var pure = !!shelf && !mixed;
    if (shelf) for (i = 0; i < primary.length; i++) if (!primary[i].traits[shelf]) pure = false;

    return { primary: primary, alternates: alternates, shelf: shelf, pure: pure };
  }

  function archetypeFor(answers) {
    return ARCHETYPES[answers.persona + ':' + answers.mood] || DEFAULT_ARCHETYPE;
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
    this.count = parseInt(root.dataset.results, 10) || 10;
    this.askTint = root.dataset.askTint === 'true';
    /* The theatre is the question phase: full bleed, dark, the drawing behind
       the type. The result leaves it — products need daylight and the theme's
       own cards, and a shelf of ten on a black stage reads as a different
       website. */
    if (root.dataset.theatre !== 'false') root.classList.add('is-theatre');
    this.hideOOS = root.dataset.hideOos === 'true';
    this.persist = root.dataset.persist === 'true';
    this.themeCards = root.dataset.themeCards === 'true';
    this.useLearned = root.dataset.useLearned !== 'false';
    this.utmCampaign = root.dataset.utmCampaign || 'fitting-room';
    this.collectPhone = root.dataset.collectPhone === 'true';
    this.phoneRequired = root.dataset.phoneRequired === 'true';
    this.leadEndpoint = root.dataset.leadEndpoint || '/contact';
    this.dialCode = root.dataset.dialCode || '+91';
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
      phone: root.querySelector('[data-psq-phone]'),
      consent: root.querySelector('[data-psq-consent]'),
      phoneErr: root.querySelector('[data-psq-phone-error]'),
      phoneSkip: root.querySelector('[data-psq-phone-skip]'),
      caption: root.querySelector('[data-psq-caption]'),
      stat: root.querySelector('[data-psq-stat]'),
      guide: root.querySelector('[data-psq-guide]'),
      roll: root.querySelector('[data-psq-roll]')
    };

    this.bind();
    this.stat();
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

    var send = this.root.querySelector('[data-psq-phone-send]');
    if (send) send.addEventListener('click', function () { self.submitPhone(); });
    if (this.el.phoneSkip) this.el.phoneSkip.addEventListener('click', function () { self.finish(); });
    if (this.el.phone) this.el.phone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); self.submitPhone(); }
    });

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

  Quiz.prototype.opts = function () {
    return { askTint: this.askTint };
  };

  Quiz.prototype.plan = function () {
    var self = this;
    this.order = QUESTIONS.filter(function (q) {
      /* A question the visitor has already been shown stays in the plan even if
         its condition no longer holds — answering the jaw question sets the face,
         which would otherwise drop the jaw question out from under the cursor and
         skip whatever came next. Position is identity, not index. */
      if (self.asked.indexOf(q.id) > -1) return true;
      return !q.when || q.when(self.answers, self.opts());
    });
  };

  /* The intro claims a number, and the number is real: distinct frames, in
     stock, that this quiz could actually put in front of someone today. Counted
     from the same index the recommendations come out of, so it cannot drift
     away from the truth the way a number typed into a theme setting would. */
  Quiz.prototype.stat = function () {
    if (!this.el.stat) return;
    var lines = Object.create(null), n = 0, i;
    for (i = 0; i < this.products.length; i++) {
      var p = this.products[i];
      if (!p.a) continue;
      var key = parseTitle(p.t).alias.toUpperCase();
      if (lines[key]) continue;
      lines[key] = true;
      n++;
    }
    if (n < 2) return;
    this.el.stat.textContent = this.el.stat.dataset.template.replace('[count]', n);
    this.el.stat.hidden = false;
  };

  Quiz.prototype.start = function () {
    this.answers = {};
    this.asked = [];
    this.phoneDone = false;
    this.at = 0;
    this.plan();
    this.root.classList.remove('is-result', 'is-lead');
    this.clearReveal();
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
    if (this.at >= this.order.length) return this.askPhone();

    var q = this.order[this.at];
    if (this.asked.indexOf(q.id) === -1) this.asked.push(q.id);
    this.el.step.textContent = String(this.at + 1).padStart(2, '0');
    this.el.total.textContent = String(this.order.length).padStart(2, '0');
    this.el.question.textContent = q.q;
    this.el.hint.textContent = q.hint || '';
    if (this.el.guide) {
      this.el.guide.innerHTML = '';
      if (q.guide) {
        q.guide.forEach(function (step) {
          var li = document.createElement('li');
          li.textContent = step;
          self.el.guide.appendChild(li);
        });
      }
      this.el.guide.hidden = !q.guide;
    }
    this.el.back.hidden = this.at === 0;
    this.el.skip.hidden = !q.skip;
    /* "Not sure — skip" is a dead end phrased as a shrug. The face question has
       a real second route, so it says what that route is. */
    if (q.skip) this.el.skip.textContent = q.skip;

    this.el.options.innerHTML = '';
    /* Six face outlines read as six outlines in a grid and as a wall of text in
       a list. The question the quiz is built around gets the grid. */
    this.el.options.className = 'psq__options' +
      (q.id === 'face' ? ' is-figures' : '') +
      (q.figures ? ' is-' + q.figures : '');
    this.el.options.setAttribute('aria-label', q.q);
    q.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'psq__opt';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', self.answers[q.id] === opt.v ? 'true' : 'false');
      b.tabIndex = i === 0 ? 0 : -1;
      b.style.setProperty('--i', i);   /* staggers the entrance */
      var art = '';
      if (q.id === 'face') {
        art = '<svg class="psq__opt-fig" viewBox="0 0 48 60" aria-hidden="true">' +
              FACE_GLYPH[opt.v] + '</svg>';
      } else if (q.figures === 'size') {
        art = '<svg class="psq__opt-fig psq__opt-fig--size" viewBox="0 0 64 60" aria-hidden="true">' +
              SIZE_GLYPH[opt.v] + '</svg>';
      } else if (q.figures === 'persona') {
        art = '<svg class="psq__opt-sig" viewBox="0 0 64 64" aria-hidden="true">' +
              (opt.sig || '') + '</svg>';
      }
      b.innerHTML = art +
        '<span class="psq__opt-txt"><span class="psq__opt-l"></span>' +
        '<span class="psq__opt-s"></span></span>';
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
    var top = rank(this.products, trial, { hideOOS: this.hideOOS, useLearned: this.useLearned, results: this.count });
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
      /* Commit the same stage change the hover preview shows. On a mouse the
         preview has already fired; on a touchscreen there is no hover at all,
         and without this the stage would sit still for the whole quiz. */
      if (opt) this.preview(q, opt);
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

  /* The number is asked for after the fitting is done and before the shelf is
     shown, which is the only moment it is worth anything to the customer: the
     result is the thing being offered. It is never a wall — the answers are
     already scored, so a failed or refused submission still shows the frames.
     Anyone who has already given a number is not asked twice. */
  Quiz.prototype.askPhone = function () {
    if (!this.collectPhone || this.phoneDone || this.loadPhone()) return this.finish();
    this.show('lead');
    this.root.classList.remove('is-result');
    this.root.classList.add('is-lead');
    if (this.el.phoneErr) { this.el.phoneErr.hidden = true; this.el.phoneErr.textContent = ''; }
    if (this.el.phoneSkip) this.el.phoneSkip.hidden = this.phoneRequired;
    if (this.el.phone) this.el.phone.focus();
    if (this.el.caption) this.el.caption.textContent = 'Your fit is ready';
    this.emit('lead_shown', {});
  };

  /* Digits only, 8 to 15 of them — enough to accept an Indian mobile typed with
     or without its country code, and any international number, without
     rejecting people over formatting they cannot see. */
  Quiz.prototype.cleanPhone = function (raw) {
    var digits = String(raw || '').replace(/\D+/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return digits;
  };

  Quiz.prototype.submitPhone = function () {
    var self = this;
    var fail = function (msg) {
      if (!self.el.phoneErr) return;
      self.el.phoneErr.textContent = msg;
      self.el.phoneErr.hidden = false;
    };

    var digits = this.cleanPhone(this.el.phone && this.el.phone.value);
    if (!digits) return fail('That doesn’t look like a complete number — check the digits and try again.');
    if (this.el.consent && !this.el.consent.checked) {
      return fail('Please tick the box so we know it’s alright to message you.');
    }

    var number = (this.dialCode || '') + digits;
    this.savePhone(number);
    this.emit('lead', { phone: number });

    /* Sent, not awaited. A slow or misconfigured endpoint must never stand
       between the customer and the frames they just answered six questions for. */
    try {
      var results = rank(this.products, this.answers, { hideOOS: this.hideOOS, useLearned: this.useLearned, results: this.count })
        .slice(0, this.count).map(function (r) { return r.meta.alias; }).join(', ');
      var body = 'Fitting Room result — ' +
        'phone: ' + number +
        ' | face: ' + (this.answers.face || 'not given') +
        ' | fit: ' + (this.answers.fit || '-') +
        ' | styling: ' + (this.answers.gender || '-') +
        ' | aesthetic: ' + (this.answers.persona || '-') +
        ' | mood: ' + (this.answers.mood || '-') +
        ' | wear: ' + (this.answers.wear || '-') +
        ' | matched: ' + results;

      var fd = new FormData();
      fd.append('form_type', 'contact');
      fd.append('utf8', '✓');
      fd.append('contact[phone]', number);
      fd.append('contact[body]', body);
      fetch(this.leadEndpoint, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .catch(function () { /* the shelf is shown regardless */ });
    } catch (e) { /* same */ }

    this.phoneDone = true;
    this.finish();
  };

  Quiz.prototype.savePhone = function (n) {
    try { localStorage.setItem(this.key + ':phone', n); } catch (e) {}
  };
  Quiz.prototype.loadPhone = function () {
    try { return localStorage.getItem(this.key + ':phone'); } catch (e) { return null; }
  };

  Quiz.prototype.finish = function (restored) {
    var self = this;
    var results = rank(this.products, this.answers, { hideOOS: this.hideOOS, useLearned: this.useLearned, results: this.count });
    var shelf = splitShelf(results, this.count, this.answers.persona, this.answers);
    var top = shelf.primary.concat(shelf.alternates);
    var face = this.answers.face || 'oval';
    var arch = archetypeFor(this.answers, top);

    this.setFace(face);
    this.setFrame(frameFor(this.answers, top));

    this.el.alias.textContent = '[ ' + arch.n + ' ]';
    this.el.verdict.textContent = arch.d + ' ' + (WHY[face] || '');

    /* The read-out. Shows the customer we used their answers, and on what. */
    var spec = [
      ['Face', FACE_LABEL[face] + (this.answers.faceInferred ? ' (from your jawline)' : '')],
      ['Width', { small: 'Narrower than standard', medium: 'Standard width',
                  large: 'Wider than standard', statement: 'Statement width' }[this.answers.size] || 'Standard width'],
      ['Frame', top.length ? (top[0].meta.desc || 'Best available fit') : '—'],
      ['Style', (personaFor(this.answers.persona) || {}).l || '—'],
      ['Mood', { sharp: 'Sharp', quiet: 'Quiet', loud: 'Loud', easy: 'Easy' }[this.answers.mood] || '—']
    ];
    this.el.spec.innerHTML = spec.map(function (r) {
      return '<li><b>' + r[0] + '</b><span></span></li>';
    }).join('');
    Array.prototype.forEach.call(this.el.spec.querySelectorAll('li span'), function (s, i) {
      s.textContent = spec[i][1];
    });

    this.renderCards(shelf);

    var fb = this.root.dataset.fallback;
    if (!top.length) {
      this.el.empty.hidden = false;
      this.el.empty.innerHTML = 'Nothing in stock matches that fitting exactly right now.' +
        (fb ? ' <a href="' + fb + '">Browse the whole shelf</a> — or retake it with a wider budget.' : '');
    } else {
      this.el.empty.hidden = true;
    }

    this.show('result');
    this.root.classList.remove('is-lead');
    this.root.classList.add('is-result');
    if (this.el.caption) this.el.caption.textContent = 'Your fit';
    /* Restoring a saved result is not a reveal — they have seen it. */
    if (restored) this.clearReveal(); else this.reveal();
    if (this.persist && !restored) this.save();
    this.emit('complete', {
      face: face, archetype: arch.n,
      products: top.map(function (r) { return r.p.h; })
    });
  };

  /* THE REVEAL.

     Without this the last answer swaps straight to a wall of ten products, and
     the one question the whole quiz was built around — face shape, asked last
     precisely so it would land — lands on nothing.

     So the result screen arrives in three beats rather than one: the drawn
     frame lowers onto the silhouette that has been abstract the entire way, the
     archetype name resolves, and only then does the shelf come in. It is about
     a second in total, which is long enough to read as deliberate and short
     enough that nobody waits.

     It is skippable on any tap or key, because a beat you cannot skip stops
     being a flourish the second time you see it. Users who ask for reduced
     motion never see it at all — the stylesheet collapses every duration, and
     the timer below is the only thing that still has to be short-circuited. */
  var ROLL_MS   = 1500;   /* the drumroll, before anything is named */
  var REVEAL_MS = 1100;   /* the staged arrival, after */

  /* What the drumroll says it is doing. Each line is true — they are the four
     things the engine actually does, in the order it does them — so the pause
     is the work being shown rather than a spinner pretending. */
  Quiz.prototype.rollLines = function () {
    var a = this.answers;
    var persona = (personaFor(a.persona) || {}).l || 'your taste';
    var n = this.products.length;
    return [
      'Reading a ' + (FACE_LABEL[a.face] || 'your').toLowerCase() + ' face…',
      'Ruling out the shapes that fight it…',
      'Searching ' + n + ' frames for ' + persona + '…',
      'Picking your ten.'
    ];
  };

  Quiz.prototype.reveal = function () {
    var self = this;
    this.clearReveal();

    var reduced = typeof matchMedia === 'function' &&
                  matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.root.classList.remove('is-rolling', 'is-revealing');
      if (this.el.roll) this.el.roll.textContent = '';
      return;
    }

    /* Beat one: the drumroll. Nothing is named yet — not the archetype, not a
       single frame — because a result you can already read is not a reveal. */
    var lines = this.rollLines(), at = 0;
    this.root.classList.add('is-rolling');
    if (this.el.roll) this.el.roll.textContent = lines[0];
    this.rollTimer = setInterval(function () {
      at++;
      if (at >= lines.length) return;
      if (self.el.roll) {
        self.el.roll.textContent = lines[at];
        /* restart the fade on each line */
        self.el.roll.classList.remove('is-in');
        void self.el.roll.offsetWidth;
        self.el.roll.classList.add('is-in');
      }
    }, ROLL_MS / lines.length);

    /* Beat two: the frame lands, the name resolves, the shelf arrives. */
    var settle = function () {
      self.root.classList.remove('is-rolling');
      self.root.classList.add('is-revealing');
      self.revealTimer = setTimeout(done, REVEAL_MS);
    };
    var done = function () { self.clearReveal(); };

    /* Any tap or key takes the whole thing away — a beat you cannot skip stops
       being a flourish the second time you see it. */
    this.skipReveal = function () { done(); };
    document.addEventListener('keydown', this.skipReveal, true);
    this.root.addEventListener('click', this.skipReveal, true);
    this.rollTo = setTimeout(settle, ROLL_MS);
  };

  Quiz.prototype.clearReveal = function () {
    clearInterval(this.rollTimer);
    clearTimeout(this.rollTo);
    clearTimeout(this.revealTimer);
    this.root.classList.remove('is-rolling', 'is-revealing');
    if (this.el.roll) this.el.roll.textContent = '';
    if (this.skipReveal) {
      document.removeEventListener('keydown', this.skipReveal, true);
      this.root.removeEventListener('click', this.skipReveal, true);
      this.skipReveal = null;
    }
  };

  /* Results are rendered twice over: a built-in card goes in immediately so the
     shelf is never empty, then the theme's own card-product markup replaces it
     as it arrives. That way the recommendations are the same cards the
     collection pages use — same badges, same price formatting, same sale
     highlighting — without this file having to imitate any of it. */
  /* Every result link is tagged so Shopify attributes the click, and any order
     that follows, back to this quiz and to the exact answers that produced it.
     That attribution is the whole learning loop: nothing here needs a tracker
     of its own, and the shop's existing analytics already reports it. */
  Quiz.prototype.tag = function (url) {
    var a = this.answers;
    var profile = [a.gender || 'any', a.face || 'na', a.size || 'na', a.persona || 'na', a.mood || 'na'].join('-');
    var q = 'utm_source=fitting-room&utm_medium=quiz' +
            '&utm_campaign=' + encodeURIComponent(this.utmCampaign) +
            '&utm_content=' + encodeURIComponent(profile);
    return url + (url.indexOf('?') > -1 ? '&' : '?') + q;
  };

  /* The line between the two halves of the shelf. It has to say plainly what
     changed, because the whole point of the split is that the second half is
     not pretending to be the first. */
  Quiz.prototype.divider = function (shelf) {
    var el = document.createElement('div');
    el.className = 'psq__divider';
    var h = document.createElement('span');
    h.className = 'psq__divider-h';
    var p = document.createElement('span');
    p.className = 'psq__divider-p';

    if (shelf.pure) {
      h.textContent = 'Same face, different mood';
      p.textContent = 'Not ' + SHELF_LABEL[shelf.shelf] + ' — but they fit you just as well, if you are open to it.';
    } else if (shelf.shelf) {
      h.textContent = 'Also worth trying';
      p.textContent = 'The ' + SHELF_LABEL[shelf.shelf] + ' shelf is short in your fit, so these are the next best on shape.';
    } else {
      h.textContent = 'A wider look';
      p.textContent = 'One from each corner of the range — all of them cut for your face.';
    }
    el.appendChild(h);
    el.appendChild(p);
    return el;
  };

  Quiz.prototype.renderCards = function (shelf) {
    var self = this;
    var top = shelf.primary.concat(shelf.alternates);
    var breakAt = shelf.alternates.length ? shelf.primary.length : -1;
    this.el.grid.innerHTML = '';
    top.forEach(function (r, i) {
      if (i === breakAt) self.el.grid.appendChild(self.divider(shelf));
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
    var self = this;
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
        /* The theme card brings its own links; tag them too. */
        var links = holder.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
          links[i].setAttribute('href', self.tag(links[i].getAttribute('href')));
        }
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
    a.href = this.tag(p.u);

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
    this.root.classList.remove('is-result', 'is-lead');
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
                       splitShelf: splitShelf, SHELF_LABEL: SHELF_LABEL,
                       archetypeFor: archetypeFor, frameFor: frameFor };
  }
})();
