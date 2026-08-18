/* ENCORE WORLDWIDE — storefront hero
   Progressive enhancement only. The room, the lighting and every animation are
   CSS; without this file you lose the running clock and the off-screen pause,
   and nothing else. */
(function () {
  'use strict';

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function startClock(hero) {
    var el = hero.querySelector('[data-ew-clock]');
    if (!el) return null;

    var frame = null;
    var last = '';

    function tick() {
      var now = new Date();
      var text = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      if (text !== last) {
        last = text;
        el.textContent = text;
      }
      frame = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    }

    tick();

    return {
      stop: function () {
        if (frame !== null) window.clearTimeout(frame);
        frame = null;
      },
      start: function () {
        if (frame === null) tick();
      }
    };
  }

  function initHero(hero) {
    if (hero.dataset.ewReady === 'true') return;
    hero.dataset.ewReady = 'true';

    var clock = startClock(hero);

    if (!('IntersectionObserver' in window)) return;

    new IntersectionObserver(
      function (entries) {
        var visible = entries[0].isIntersecting;
        hero.classList.toggle('ew-hero--offscreen', !visible);
        if (!clock) return;
        if (visible) clock.start();
        else clock.stop();
      },
      { threshold: 0 }
    ).observe(hero);
  }

  function initAll(root) {
    (root || document).querySelectorAll('.ew-hero').forEach(initHero);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
    });
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
