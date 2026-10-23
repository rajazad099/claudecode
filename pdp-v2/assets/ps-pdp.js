/* Project Shades product page: delivery-date check only.
   Runs once on load and on pincode submit. It never observes or touches the cart drawer or checkout. */
(() => {
  const boxes = Array.from(document.querySelectorAll('[data-ps-ship]'));
  if (!boxes.length) return;

  // Fallback = transit table measured from 6,227 delivered orders (p25-p85 working days after dispatch).
  const FALLBACK = {
    zones: [
      { prefixes: ['400', '401'], min: 1, max: 2 },
      { prefixes: ['411', '412'], min: 1, max: 2 },
      { prefixes: ['422', '423'], min: 2, max: 3 },
      { prefixes: ['110', '121', '122', '201'], min: 2, max: 4 },
      { prefixes: ['560', '561', '562'], min: 2, max: 4 },
      { prefixes: ['500', '501', '502'], min: 2, max: 3 },
      { prefixes: ['600', '601', '602', '603'], min: 3, max: 4 },
      { prefixes: ['67', '68', '69'], min: 3, max: 6 },
      { prefixes: ['40', '41', '42', '43', '44', '36', '37', '38', '39'], min: 2, max: 3 },
      { prefixes: ['18', '19', '744', '78', '79'], min: 5, max: 8 },
      { prefixes: ['70', '71', '72', '73', '74', '75', '76', '77', '80', '81', '82', '83', '84', '85'], min: 3, max: 5 },
      { prefixes: ['1', '2', '3', '4', '5', '6'], min: 3, max: 5 }
    ],
    fallback: { min: 2, max: 4 }
  };
  let table = FALLBACK;
  const src = document.querySelector('[data-ps-delivery]');
  if (src) {
    try { const t = JSON.parse(src.textContent); if (t && t.zones) table = t; } catch (_) {}
  }
  const holidays = new Set((boxes[0].dataset.holidays || '').split(',').map((d) => d.trim()).filter(Boolean));
  const CUTOFF = 10; // 10:00 IST

  // India time regardless of the device timezone: shift to UTC+5:30 and use UTC getters.
  const istNow = () => new Date(Date.now() + 330 * 60000);
  const key = (d) => d.toISOString().slice(0, 10);
  const plusDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const isWorkingDay = (d) => d.getUTCDay() !== 0 && !holidays.has(key(d));
  const atCutoff = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), CUTOFF));
  const nextDispatch = (now) => {
    let day = atCutoff(now);
    if (!(isWorkingDay(day) && now < day)) {
      day = plusDays(day, 1);
      while (!isWorkingDay(day)) day = plusDays(day, 1);
    }
    return day;
  };
  const addTransit = (from, n) => {
    let d = from;
    for (let left = n; left > 0;) { d = plusDays(d, 1); if (isWorkingDay(d)) left -= 1; }
    return d;
  };
  const zoneFor = (pin) => {
    let best = null;
    for (const z of table.zones) for (const p of z.prefixes) if (pin.startsWith(p) && (!best || p.length > best.len)) best = { z, len: p.length };
    return best ? best.z : null;
  };
  const day = (d) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).replace(',', '');
  const full = (d) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

  const estimate = (pin) => {
    const ship = nextDispatch(istNow());
    const range = zoneFor(pin) || table.fallback || FALLBACK.fallback;
    const from = addTransit(ship, range.min);
    const to = addTransit(ship, range.max);
    if (key(from) === key(to)) return full(from);
    return `${from.getUTCMonth() === to.getUTCMonth() ? day(from) : full(from)} – ${full(to)}`;
  };

  const show = (box, pin) => {
    const out = box.querySelector('[data-ps-eta]');
    if (!out) return;
    out.textContent = '';
    if (!pin) { out.textContent = 'Enter your pincode to check estimated delivery'; return; }
    out.append(`Estimated delivery to ${pin}: `);
    const b = document.createElement('b');
    b.textContent = estimate(pin);
    out.append(b);
  };

  let saved = '';
  try { saved = localStorage.getItem('ps:pin') || ''; } catch (_) {}
  if (!/^[1-9]\d{5}$/.test(saved)) saved = '';

  boxes.forEach((box) => {
    const form = box.querySelector('[data-ps-pin]');
    const input = form && form.querySelector('input');
    if (input && saved) input.value = saved;
    show(box, saved);
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = input.value.trim();
      if (!/^[1-9]\d{5}$/.test(pin)) {
        input.setCustomValidity('Enter a valid 6-digit pincode');
        input.reportValidity();
        input.setCustomValidity('');
        return;
      }
      try { localStorage.setItem('ps:pin', pin); } catch (_) {}
      show(box, pin);
    });
  });
})();
