/*
 * Renders sections/shades-quiz.liquid through a real Liquid engine against mock
 * Shopify globals, and asserts the product index comes out populated.
 *
 *     npm install liquidjs && node preview/liquid-test.js
 *
 * This exists because of a bug that reached a real store: the section dispatched
 * its collection pools with `case forloop.index / when 1 then assign src = ...`,
 * and Liquid has no `then` keyword. It did not error — `when` simply matched a
 * value that never occurs, so the source collection stayed blank, every pool was
 * skipped, and the quiz rendered with nothing to recommend.
 *
 * Nothing caught it because nothing executed the Liquid. preview/quiz.html is
 * built from a JSON snapshot produced by a Python script that mimics the
 * section's logic, so it validated the scoring and the interface while the
 * template itself went untested. This closes that gap: it is the only test here
 * that runs the actual template.
 */
const { Liquid } = require('liquidjs');
const fs = require('fs');

const src = fs.readFileSync('/home/user/claudecode/sections/shades-quiz.liquid', 'utf8');
// Strip the {% schema %} block — it is metadata, not renderable Liquid.
const body = src.replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, '');

const engine = new Liquid({ strictFilters: false, strictVariables: false });
engine.registerFilter('json', v => JSON.stringify(v === undefined ? null : v));
engine.registerFilter('money', v => '₹' + (Number(v) / 100).toFixed(0));
engine.registerFilter('image_url', (v) => (v && v.src) ? v.src : '');
engine.registerFilter('asset_url', v => '/assets/' + v);
engine.registerFilter('stylesheet_tag', v => `<link href="${v}">`);
engine.registerFilter('strip_html', v => String(v == null ? '' : v).replace(/<[^>]*>/g, ''));

function mkProduct(i, title, collHandles, opts) {
  opts = opts || {};
  return {
    handle: 'p-' + i, title, url: '/products/p-' + i, price: 99900,
    compare_at_price: opts.cap || 0, available: true,
    featured_image: { src: 'https://cdn.shopify.com/x' + i + '.jpg', alt: title },
    variants: [{ inventory_quantity: opts.inv == null ? 12 : opts.inv }],
    options_with_values: [{ name: 'Color', values: ['Black', 'Biege'] }],
    collections: collHandles.map(h => ({ handle: h })),
    metafields: { reviews: opts.rt
      ? { rating: { value: { rating: opts.rt } }, rating_count: opts.rc }
      : {} },
  };
}
const mkColl = (handle, products) => ({ handle, products, url: '/collections/' + handle });

const rect  = mkColl('rectangular-sunglasses', [
  mkProduct(1, '[ Hecate ] Slim Metal Sunglasses', ['rectangular-sunglasses','bestsellers'], { inv: 940, rt: 4.78, rc: 78 }),
  mkProduct(2, '[ Vancouver ] Unisex Aviator Sunglasses', ['rectangular-sunglasses','vintage'], { inv: 303, rt: 4.93, rc: 14 }),
  mkProduct(3, '[ Altair ] Star Unisex Bracelet', ['rectangular-sunglasses'], {}),        // must be filtered out
]);
const riml  = mkColl('rimless', [
  mkProduct(4, '[ Serendipity 2.0 ] Holiday Rimless Sunglasses : Clear', ['rimless','bestsellers'], { inv: 308, rt: 5.0, rc: 1 }),
]);
const sport = mkColl('sports-sunglasses', [
  mkProduct(5, '[ Kryptonite ] Polarised Sports Sunglasses : Red', ['sports-sunglasses','wraparound-sunglasses'], { inv: 77 }),
]);
const empty = h => mkColl(h, []);
const collections = {
  'rectangular-sunglasses': rect, 'rimless': riml, 'sports-sunglasses': sport,
};
['oval-sunglasses','round-sunglasses','cat-eye-glasses','wraparound-sunglasses','oversized-sunglasses',
 'geometric','vintage','techno','luxe-collection','code','ice-ice-baby',
 'prescription-friendly-sunglasses','30','sale','bestsellers','staff-picks'
].forEach(h => { if (!collections[h]) collections[h] = empty(h); });

const ctx = {
  section: { id: 'test', settings: { per_collection: 40, result_count: 4, hide_sold_out: true,
    remember_result: true, use_theme_cards: true, card_section: 'shades-quiz-card' } },
  collections, routes: { cart_url: '/cart' },
};

(async () => {
  let html;
  try {
    html = await engine.parseAndRender(body, ctx);
  } catch (e) {
    console.log('*** LIQUID FAILED TO RENDER ***');
    console.log('   ' + e.message.split('\n').slice(0, 6).join('\n   '));
    process.exit(1);
  }
  console.log('Liquid rendered OK (' + html.length + ' chars)');

  const m = html.match(/<script type="application\/json" data-psq-products>([\s\S]*?)<\/script>/);
  if (!m) { console.log('*** product index script tag missing ***'); process.exit(1); }

  let data;
  try { data = JSON.parse(m[1]); }
  catch (e) { console.log('*** product JSON is INVALID ***', e.message); console.log(m[1].slice(0,400)); process.exit(1); }

  console.log('product index parsed: ' + data.length + ' products');
  if (!data.length) { console.log('*** EMPTY INDEX — this is the bug the store reported ***'); process.exit(1); }
  data.forEach(p => console.log('   ' + p.t.slice(0,52).padEnd(54) +
    'inv ' + String(p.iv).padStart(4) + '  traits ' + JSON.stringify(p.c) +
    (p.rt ? '  ' + p.rt + '* x' + p.rc : '') + (p.cl ? '  colours "' + p.cl + '"' : '')));

  const jewellery = data.find(p => /bracelet/i.test(p.t));
  console.log('\nchecks:');
  console.log('  non-eyewear excluded          :', jewellery ? 'NO — leaked' : 'yes');
  console.log('  traits resolved from handles  :', data.some(p => p.c.includes('rect')) ? 'yes' : 'NO');
  console.log('  inventory summed from variants:', data.some(p => p.iv === 940) ? 'yes' : 'NO');
  console.log('  review metafields read        :', data.some(p => p.rt === 4.78) ? 'yes' : 'NO');
  console.log('  colourway text captured       :', data.some(p => p.cl) ? 'yes' : 'NO');
  console.log('  dedupe across pools           :', new Set(data.map(p=>p.h)).size === data.length ? 'yes' : 'NO');
})();
