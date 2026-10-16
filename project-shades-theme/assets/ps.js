/* Project Shades — storefront behaviour. No dependencies, ~10KB. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const PS = window.PS || {};
  const routes = PS.routes || {};

  /* ---------- Money ---------- */
  const formatMoney = (cents) => {
    const fmt = PS.moneyFormat || '₹{{amount}}';
    const value = Number(cents) / 100;
    const whole = Number.isInteger(value);
    const num = value.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, num);
  };

  /* ---------- Toast ---------- */
  let toastEl;
  const toast = (msg) => {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  };

  /* ---------- Overlays: drawers, search, modals ---------- */
  const scrim = $('[data-scrim]');
  let openEl = null;
  let lastFocus = null;
  const open = (el) => {
    if (!el) return;
    if (openEl && openEl !== el) close(true);
    lastFocus = document.activeElement;
    openEl = el;
    if (scrim) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('is-on')); }
    el.classList.add('is-open');
    document.body.classList.add('is-locked');
    const focusable = el.querySelector('input, button, a');
    setTimeout(() => (el.matches('.search-pop') ? el.querySelector('input') : el).focus({ preventScroll: true }), 50);
    if (!focusable) el.focus();
  };
  const close = (silent) => {
    if (!openEl) return;
    openEl.classList.remove('is-open');
    openEl = null;
    document.body.classList.remove('is-locked');
    if (scrim) { scrim.classList.remove('is-on'); setTimeout(() => { if (!openEl) scrim.hidden = true; }, 250); }
    if (!silent && lastFocus) lastFocus.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-drawer], [data-open-modal]');
    if (opener) {
      e.preventDefault();
      const id = opener.dataset.openDrawer || opener.dataset.openModal;
      open(document.getElementById(id));
      return;
    }
    if (e.target.closest('[data-close]') || e.target === scrim) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  /* ---------- Cart ---------- */
  const cartSection = 'cart-drawer';
  const enableGokwik = () => {
    // GoKwik's own observer re-enables its buttons ~700ms after DOM changes; do it now if the SDK is ready.
    if (!window.gokwikSdk) return;
    $$('.gokwik-checkout button').forEach((b) => { b.disabled = false; b.classList.remove('disabled'); });
  };
  const paintCart = (html) => {
    if (!html) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fresh = doc.querySelector('[data-cart-drawer]');
    const current = $('[data-cart-drawer]');
    if (!fresh || !current) return;
    const wasOpen = current.classList.contains('is-open');
    current.innerHTML = fresh.innerHTML;
    current.dataset.count = fresh.dataset.count;
    if (wasOpen) current.classList.add('is-open');
    $$('[data-cart-count]').forEach((el) => { el.textContent = fresh.dataset.count; el.dataset.count = fresh.dataset.count; });
    $$('[data-tiers-status]').forEach((el) => { const c = Number(fresh.dataset.count); el.textContent = c > 0 ? `${c} in bag` : 'Auto-applied'; });
    paintEta();
    enableGokwik();
  };
  const cartRequest = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, sections: [cartSection], sections_url: window.location.pathname })
    });
    const data = await res.json();
    if (!res.ok || data.status) throw new Error(data.description || data.message || 'Something went wrong. Please try again.');
    return data;
  };
  const addToCart = async (items, trigger) => {
    trigger && trigger.classList.add('is-loading');
    try {
      const data = await cartRequest(`${routes.cartAdd}.js`, { items });
      paintCart(data.sections && data.sections[cartSection]);
      if (document.body.dataset.template !== 'cart') open($('[data-cart-drawer]'));
      return true;
    } catch (err) {
      toast(err.message);
      return false;
    } finally {
      trigger && trigger.classList.remove('is-loading');
    }
  };
  const changeLine = async (key, quantity) => {
    const drawer = $('[data-cart-drawer]');
    drawer && drawer.setAttribute('aria-busy', 'true');
    try {
      const data = await cartRequest(`${routes.cartChange}.js`, { id: key, quantity });
      paintCart(data.sections && data.sections[cartSection]);
    } catch (err) {
      toast(err.message);
    } finally {
      drawer && drawer.removeAttribute('aria-busy');
    }
  };
  document.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-quick-add]');
    if (quick) {
      e.preventDefault();
      addToCart([{ id: Number(quick.dataset.quickAdd), quantity: 1 }], quick).then((ok) => {
        if (ok && quick.classList.contains('card__add')) { quick.classList.add('is-done'); setTimeout(() => quick.classList.remove('is-done'), 1600); }
      });
      return;
    }
    const line = e.target.closest('[data-line-change]');
    if (line) { e.preventDefault(); changeLine(line.dataset.lineChange, Number(line.dataset.qty)); return; }
    const cartLink = e.target.closest('[data-cart-toggle]');
    if (cartLink && $('[data-cart-drawer]') && document.body.dataset.template !== 'cart') { e.preventDefault(); open($('[data-cart-drawer]')); }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-product-form]');
    if (!form) return;
    e.preventDefault();
    const id = Number(new FormData(form).get('id'));
    addToCart([{ id, quantity: 1 }], form.querySelector('[data-add-button]'));
  });

  /* ---------- Delivery estimate ----------
     Source of truth is the store FAQ: orders ship the next working day (no Sunday dispatch);
     Mumbai & Pune ~2 days after dispatch, Delhi & Ahmedabad 3–4, Bangalore & Hyderabad 4–5,
     everywhere else 3–7. */
  const zones = [
    { re: /^(40[0-1]|41[0-2])/, min: 2, max: 3, name: 'Mumbai & Pune' },
    { re: /^(11|38[0-2])/, min: 3, max: 4, name: 'Delhi & Ahmedabad' },
    { re: /^(56[0-2]|50[0-2])/, min: 4, max: 5, name: 'Bangalore & Hyderabad' }
  ];
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dispatchDay = () => {
    let d = addDays(new Date(), 1);
    if (d.getDay() === 0) d = addDays(d, 1);
    return d;
  };
  const fmtDay = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const eta = (pin) => {
    const z = pin && zones.find((zone) => zone.re.test(pin));
    const ship = dispatchDay();
    const min = z ? z.min : 3;
    const max = z ? z.max : 7;
    return { ship, from: addDays(ship, min), to: addDays(ship, max), zone: z };
  };
  const readPin = () => { try { return localStorage.getItem('ps:pin') || ''; } catch (_) { return ''; } };
  const paintEta = () => {
    const pin = readPin();
    const e = eta(pin);
    $$('[data-eta]').forEach((el) => {
      el.innerHTML = pin
        ? `Delivery to <b>${pin}</b> by <b>${fmtDay(e.to)}</b>${e.zone ? '' : ' (3–7 days)'}. Ships ${fmtDay(e.ship)}.`
        : `Order now, ships <b>${fmtDay(e.ship)}</b>. Delivered in 3–7 days across India.`;
    });
    $$('[data-eta-short]').forEach((el) => { el.textContent = `Ships ${fmtDay(e.ship)}`; });
    $$('[data-pincode-form] input').forEach((i) => { if (pin && !i.value) i.value = pin; });
  };
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-pincode-form]');
    if (!form) return;
    e.preventDefault();
    const pin = form.querySelector('input').value.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) { toast('Enter a valid 6-digit pincode'); return; }
    try { localStorage.setItem('ps:pin', pin); } catch (_) {}
    paintEta();
  });
  paintEta();

  /* ---------- Product page ---------- */
  const section = $('[data-product-section]');
  if (section) {
    const jsonEl = $('[data-product-json]');
    const product = jsonEl ? JSON.parse(jsonEl.textContent) : null;
    const form = $('[data-product-form]', section);
    const idInput = form && form.querySelector('[data-variant-id]');
    const addBtn = form && form.querySelector('[data-add-button]');
    const addLabel = form && form.querySelector('[data-add-label]');
    const track = $('[data-gallery-track]', section);
    const dots = $$('.gallery__dots i', section);

    // Gallery dots follow the swipe.
    if (track && dots.length) {
      track.addEventListener('scroll', () => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((d, n) => d.classList.toggle('is-on', n === i));
      }, { passive: true });
    }
    const showMedia = (mediaId) => {
      if (!track || !mediaId) return;
      const slide = track.querySelector(`[data-media-id="${mediaId}"]`);
      if (!slide) return;
      if (window.matchMedia('(min-width: 990px)').matches) {
        track.prepend(slide);
      } else {
        track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
      }
    };

    // Variant selection.
    const inputs = $$('[data-option-input]', section);
    if (product && inputs.length) {
      section.addEventListener('change', (e) => {
        if (!e.target.matches('[data-option-input]')) return;
        const fieldsets = $$('[data-option-index]', section);
        const selected = fieldsets.map((fs) => { const c = fs.querySelector('input:checked'); return c ? c.value : null; });
        fieldsets.forEach((fs, i) => { const lab = fs.querySelector('[data-option-selected]'); if (lab) lab.textContent = selected[i]; });
        const variant = product.variants.find((v) => v.options.every((o, i) => o === selected[i]));
        if (!variant) {
          addBtn.disabled = true; addLabel.textContent = 'Unavailable';
          return;
        }
        idInput.value = variant.id;
        addBtn.disabled = !variant.available;
        addLabel.textContent = variant.available ? 'Add to bag' : 'Sold out';
        const sticky = $('[data-sticky-add]'); if (sticky) sticky.disabled = !variant.available;
        const price = $('[data-price-wrap] [data-price]', section);
        if (price) {
          const save = variant.compare_at_price > variant.price ? variant.compare_at_price - variant.price : 0;
          price.innerHTML = `<span>${formatMoney(variant.price)}</span>${save ? `<s>${formatMoney(variant.compare_at_price)}</s><span class="price__save">Save ${formatMoney(save)}</span>` : ''}`;
        }
        const sp = $('[data-sticky-price]'); if (sp) sp.textContent = formatMoney(variant.price);
        if (variant.featured_media) showMedia(variant.featured_media.id);
        const url = new URL(window.location.href); url.searchParams.set('variant', variant.id);
        history.replaceState({}, '', url.toString());
      });
    }

    // Sticky add-to-bag appears once the real buttons scroll away.
    const sticky = $('[data-sticky-buy]');
    const buyBlock = $('[data-buy-block]', section);
    if (sticky && buyBlock && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sticky.classList.toggle('is-on', past);
        sticky.setAttribute('aria-hidden', String(!past));
      }).observe(buyBlock);
      $('[data-sticky-add]', sticky).addEventListener('click', () => form && form.requestSubmit());
    }
  }

  /* ---------- Announcement ticker ---------- */
  $$('[data-announce]').forEach((bar) => {
    const trackEl = bar.querySelector('.announce__track');
    const n = trackEl ? trackEl.children.length : 0;
    if (n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    setInterval(() => { i = (i + 1) % n; trackEl.style.transform = `translateY(-${i * 34}px)`; }, 4000);
  });

  /* ---------- Predictive search ---------- */
  const searchInput = $('[data-predictive]');
  if (searchInput) {
    const out = $('[data-predictive-results]');
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      const q = searchInput.value.trim();
      if (q.length < 2) { out.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        try {
          const res = await fetch(`${routes.predictive}.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=6`);
          const data = await res.json();
          const items = (data.resources && data.resources.results.products) || [];
          out.innerHTML = items.length
            ? items.map((p) => `<a class="search-hit" href="${p.url}"><img src="${p.image || ''}" alt="" loading="lazy" width="56" height="56"><span>${p.title.replace(/</g, '&lt;')}</span><span class="price">${formatMoney(Math.round(parseFloat(p.price) * 100))}</span></a>`).join('')
            : `<p class="label label--muted">No frames match “${q.replace(/</g, '&lt;')}”. Try “aviator” or “round”.</p>`;
        } catch (_) { /* search page still works on submit */ }
      }, 220);
    });
  }

  /* ---------- Collection: sort & filters submit themselves ---------- */
  $$('[data-autosubmit]').forEach((el) => el.addEventListener('change', () => el.form.submit()));

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
  } else {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Videos play only while visible ---------- */
  if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => entries.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) { v.play && v.play().catch(() => {}); } else { v.pause && v.pause(); }
    }), { threshold: 0.2 });
    $$('video[data-autoplay]').forEach((v) => vio.observe(v));
  }

  window.addEventListener('gokwikLoaded', enableGokwik);
})();
