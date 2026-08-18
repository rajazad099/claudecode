/* Encore Worldwide — hero section behaviour.
   Progressive enhancement only: the section is fully usable without this file.
   - pointer parallax on the product visual
   - conic border angle for ghost buttons
   - pauses ambient work when the hero scrolls out of view */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initHero(hero) {
    if (hero.dataset.ewHeroReady === 'true') return;
    hero.dataset.ewHeroReady = 'true';

    var visual = hero.querySelector('.ew-hero__visual');
    var frame = null;
    var visible = true;
    var target = { x: 0, y: 0 };

    function apply() {
      frame = null;
      hero.style.setProperty('--ew-px', target.x.toFixed(3));
      hero.style.setProperty('--ew-py', target.y.toFixed(3));
    }

    function onPointerMove(event) {
      if (!visible || reduceMotion.matches) return;
      var rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      target.x = (event.clientX - rect.left) / rect.width - 0.5;
      target.y = (event.clientY - rect.top) / rect.height - 0.5;
      if (frame === null) frame = window.requestAnimationFrame(apply);
    }

    function reset() {
      target.x = 0;
      target.y = 0;
      if (frame === null) frame = window.requestAnimationFrame(apply);
    }

    if (visual && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hero.addEventListener('pointermove', onPointerMove);
      hero.addEventListener('pointerleave', reset);
    }

    // Stop ambient animation work while the hero is off-screen.
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          hero.classList.toggle('ew-hero--offscreen', !visible);
          if (!visible) reset();
        },
        { threshold: 0 }
      );
      observer.observe(hero);
    }
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

  // Shopify theme editor: re-init when the section is added or re-rendered.
  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
