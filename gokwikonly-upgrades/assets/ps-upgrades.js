/* Project Shades upgrades: fit sheet, delivery dates, one-tap add in the cart drawer. */
(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CFG = window.PS_CFG || {};

  /* ---------- Fit sheet (native <dialog>) ---------- */
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-ps-open]');
    if (opener) {
      const d = document.getElementById(opener.dataset.psOpen);
      if (d && d.showModal) { d.showModal(); document.body.style.overflow = 'hidden'; }
      return;
    }
    const closer = e.target.closest('[data-ps-close]');
    const dlg = closer ? closer.closest('dialog') : (e.target.tagName === 'DIALOG' ? e.target : null);
    if (dlg) { dlg.close(); }
  });
  document.addEventListener('close', (e) => { if (e.target.matches && e.target.matches('dialog.ps-sheet')) document.body.style.overflow = ''; }, true);

  /* ---------- Delivery dates ----------
     Rules (from Project Shades ops):
     - Dispatch from Nashik (422101) at 10:00 IST every working day.
     - Ordered before 10:00 on a working day -> ships that day; otherwise the next working day.
     - No dispatch on Sundays or listed holidays. Couriers don't deliver on Sundays.
     - Transit days per destination come from the shop metafield (refreshed from real
       delivered orders); the table below is the fallback. Always shown as a range. */
  // Fallback = the table measured from delivered orders on 2026-10-16 (p25-p85 working days).
  const FALLBACK = {
    zones: [
      { name: 'Mumbai', prefixes: ['400',  '401'], min: 1, max: 2 },
      { name: 'Pune', prefixes: ['411',  '412'], min: 1, max: 2 },
      { name: 'Nashik', prefixes: ['422',  '423'], min: 2, max: 3 },
      { name: 'Delhi NCR', prefixes: ['110',  '121',  '122',  '201'], min: 2, max: 4 },
      { name: 'Bangalore', prefixes: ['560',  '561',  '562'], min: 2, max: 4 },
      { name: 'Hyderabad', prefixes: ['500',  '501',  '502'], min: 2, max: 3 },
      { name: 'Chennai', prefixes: ['600',  '601',  '602',  '603'], min: 3, max: 4 },
      { name: 'Kerala', prefixes: ['67',  '68',  '69'], min: 3, max: 6 },
      { name: 'Maharashtra & Gujarat', prefixes: ['40',  '41',  '42',  '43',  '44',  '36',  '37',  '38',  '39'], min: 2, max: 3 },
      { name: 'North-East, J&K & islands', prefixes: ['18',  '19',  '744',  '78',  '79'], min: 5, max: 8 },
      { name: 'East India', prefixes: ['70',  '71',  '72',  '73',  '74',  '75',  '76',  '77',  '80',  '81',  '82',  '83',  '84',  '85'], min: 3, max: 5 },
      { name: 'North & South India', prefixes: ['1',  '2',  '3',  '4',  '5',  '6'], min: 3, max: 5 }
    ],
    fallback: { min: 2, max: 4 }
  };
  const table = (window.PS_DELIVERY && window.PS_DELIVERY.zones) ? window.PS_DELIVERY : FALLBACK;
  const holidays = new Set((CFG.holidays || []).map((d) => d.trim()).filter(Boolean));
  const CUTOFF = 10; // 10:00 IST

  // Work in IST regardless of the visitor's device timezone: shift to UTC+5:30 and use UTC getters.
  const istNow = () => new Date(Date.now() + 330 * 60000);
  const key = (d) => d.toISOString().slice(0, 10);
  const plusDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const isSunday = (d) => d.getUTCDay() === 0;
  const isWorkingDay = (d) => !isSunday(d) && !holidays.has(key(d));
  const atCutoff = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), CUTOFF, 0, 0));

  const nextDispatch = (now) => {
    let day = atCutoff(now);
    if (!(isWorkingDay(day) && now < day)) {
      day = plusDays(day, 1);
      while (!isWorkingDay(day)) day = plusDays(day, 1);
    }
    return day;
  };
  // Add courier transit days, skipping Sundays and holidays.
  const addTransit = (from, n) => {
    let d = from;
    let left = n;
    while (left > 0) { d = plusDays(d, 1); if (isWorkingDay(d)) left -= 1; }
    return d;
  };
  const zoneFor = (pin) => {
    if (!/^[1-9]\d{5}$/.test(pin || '')) return null;
    let best = null;
    for (const z of table.zones) for (const p of z.prefixes) if (pin.startsWith(p) && (!best || p.length > best.len)) best = { z, len: p.length };
    return best ? best.z : null;
  };
  const fmt = (d, withWeekday = true) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: withWeekday ? 'short' : undefined, day: 'numeric', month: 'short' });
  const sameDay = (a, b) => key(a) === key(b);

  const readPin = () => { try { return localStorage.getItem('ps:pin') || ''; } catch (_) { return ''; } };
  const paint = () => {
    const now = istNow();
    const ship = nextDispatch(now);
    const pin = readPin();
    const zone = zoneFor(pin);
    const range = zone || table.fallback || FALLBACK.fallback;
    const from = addTransit(ship, range.min);
    const to = addTransit(ship, range.max);
    const shipTxt = sameDay(ship, now) ? 'today' : fmt(ship);
    const short = (d) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
    const full = (d) => fmt(d).replace(',', '');
    const arrive = sameDay(from, to)
      ? `<b>${full(from)}</b>`
      : `<b>${from.getUTCMonth() === to.getUTCMonth() ? short(from).replace(',', '') : full(from)} – ${full(to)}</b>`;

    // Minimal: nothing until a pincode is entered, then one line with the estimated range.
    $$('[data-ps-eta]').forEach((el) => {
      const line = el.closest('.ps-ship__eta');
      if (!pin) { if (line) line.hidden = true; el.innerHTML = ''; return; }
      if (line) line.hidden = false;
      el.innerHTML = `Estimated delivery to ${pin}: ${arrive}`;
    });

    // Countdown only when dispatch is less than 8 hours away.
    const mins = Math.floor((ship - now) / 60000);
    $$('[data-ps-countdown]').forEach((el) => { el.hidden = true; });
    $$('[data-ps-ship-short]').forEach((el) => { el.textContent = sameDay(ship, now) ? 'Ships today' : `Ships ${fmt(ship)}`; });
    $$('[data-ps-pin] input').forEach((i) => { if (pin && !i.value) i.value = pin; });
  };
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-ps-pin]');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input');
    const pin = input.value.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) { input.setCustomValidity('Enter a valid 6-digit pincode'); input.reportValidity(); input.setCustomValidity(''); return; }
    try { localStorage.setItem('ps:pin', pin); } catch (_) {}
    paint();
  });
  paint();
  setInterval(paint, 60000);
  // The cart drawer re-renders its HTML after every change; repaint our bits when it does.
  const drawer = document.querySelector('cart-drawer');
  if (drawer && 'MutationObserver' in window) {
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(paint, 50); }).observe(drawer, { childList: true, subtree: true });
  }

  /* ---------- One-tap add from "Pairs well with" ---------- */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ps-add]');
    if (!btn) return;
    e.preventDefault();
    const cart = document.querySelector('cart-drawer');
    btn.classList.add('is-loading');
    try {
      const sections = cart && cart.getSectionsToRender ? cart.getSectionsToRender().map((s) => s.id) : [];
      const res = await fetch(`${(window.routes && window.routes.cart_add_url) || '/cart/add'}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(btn.dataset.psAdd), quantity: 1 }], sections, sections_url: window.location.pathname })
      });
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || 'Could not add this pair.');
      if (cart && cart.renderContents) cart.renderContents(data);
      else window.location.href = (window.routes && window.routes.cart_url) || '/cart';
    } catch (err) {
      btn.classList.remove('is-loading');
      btn.textContent = 'Sold out';
      btn.disabled = true;
    }
  });
})();
