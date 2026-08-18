/* ENCORE WORLDWIDE — hero
   Progressive enhancement. The hero is complete without this file: the still
   is the LCP image and every animation is CSS. This only:
     - picks the phone or desktop video and fades it in over the still
     - skips video entirely on reduced-motion, save-data or slow connections
     - pauses ambient motion when the hero is off-screen */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function wantsHeavyMedia() {
    if (reduceMotion.matches) return false;
    var c = navigator.connection;
    if (!c) return true;
    if (c.saveData) return false;
    return !/(^|-)2g$/.test(c.effectiveType || '');
  }

  function initVideo(hero) {
    var video = hero.querySelector('.ew-hero__video');
    if (!video) return null;

    if (!wantsHeavyMedia()) {
      video.remove();
      return null;
    }

    var desktop = window.matchMedia('(min-width: 750px)').matches;
    var src = (desktop && video.dataset.srcDesktop) || video.dataset.srcMobile || video.dataset.srcDesktop;

    if (!src) {
      video.remove();
      return null;
    }

    video.addEventListener(
      'canplay',
      function () {
        video.classList.add('is-playing');
      },
      { once: true }
    );

    video.src = src;

    var attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      // Autoplay refused (low power mode, for one) — the still already carries the hero.
      attempt.catch(function () {
        video.remove();
      });
    }

    return video;
  }

  function initHero(hero) {
    if (hero.dataset.ewReady === 'true') return;
    hero.dataset.ewReady = 'true';

    var video = initVideo(hero);

    if (!('IntersectionObserver' in window)) return;

    new IntersectionObserver(
      function (entries) {
        var visible = entries[0].isIntersecting;
        hero.classList.toggle('ew-hero--offscreen', !visible);
        if (!video) return;
        if (visible) {
          var attempt = video.play();
          if (attempt && typeof attempt.catch === 'function') attempt.catch(function () {});
        } else {
          video.pause();
        }
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
