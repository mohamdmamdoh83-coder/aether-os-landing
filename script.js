/* ============================================================
   AETHER OS — script.js
   Vanilla JavaScript only (no frameworks, no build step).
   - 3D parallax tilt on bento cards (mouse-follow)
   - Pointer-tracking card shine
   - Scroll-reveal animations
   - Animated counters + progress bars
   - Live terminal typing effect
   - Sticky header state + mobile menu
   - CTA form validation
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     0. ENVIRONMENT FLAGS
  ---------------------------------------------------------- */
  // Marks JS as active so .reveal elements start hidden (progressive enhancement).
  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ----------------------------------------------------------
     1. 3D PARALLAX TILT  (data-tilt + data-glow cards)
     Cards rotate toward the cursor and a radial shine follows
     the pointer via CSS custom properties.
  ---------------------------------------------------------- */
  function initTilt() {
    const cards = document.querySelectorAll('[data-tilt]');
    if (!cards.length) return;

    // Disable tilt on touch devices and for users who prefer reduced motion.
    if (isCoarsePointer || reduceMotion) {
      cards.forEach((card) => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
      return;
    }

    // EDIT: 3D parallax intensity — max degrees the card rotates.
    // 4 = subtle, 7 = balanced, 12 = extreme. (The active tilt
    // module at the bottom of this file uses TILT_DEGREES.)
    const MAX_TILT = 7;        // degrees on X/Y axes
    const SHINE = 420;         // px radius of the shine gradient (matches CSS)

    cards.forEach((card) => {
      let rafId = null;
      let targetX = 0;
      let targetY = 0;   // -1 .. 1 normalized
      let currentX = 0;
      let currentY = 0;
      let hovering = false;

      function render() {
        // Ease current toward target for a smooth, springy feel.
        currentX += (targetX - currentX) * 0.12;
        currentY += (targetY - currentY) * 0.12;

        const rx = (-currentY * MAX_TILT).toFixed(3) + 'deg';
        const ry = (currentX * MAX_TILT).toFixed(3) + 'deg';

        card.style.setProperty('--rx', rx);
        card.style.setProperty('--ry', ry);

        const settled =
          Math.abs(targetX - currentX) < 0.001 &&
          Math.abs(targetY - currentY) < 0.001;

        if (hovering || !settled) {
          rafId = requestAnimationFrame(render);
        } else {
          rafId = null;
        }
      }

      function kick() {
        if (rafId === null) rafId = requestAnimationFrame(render);
      }

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;   // 0..1
        const py = (e.clientY - rect.top) / rect.height;   // 0..1

        targetX = px * 2 - 1;
        targetY = py * 2 - 1;
        hovering = true;

        // Pointer shine + lift.
        card.style.setProperty('--mx', (px * 100).toFixed(2) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(2) + '%');
        card.style.setProperty('--lift', '-6px');

        kick();
      });

      card.addEventListener('mouseenter', () => {
        hovering = true;
        card.style.setProperty('--lift', '-6px');
        kick();
      });

      card.addEventListener('mouseleave', () => {
        hovering = false;
        targetX = 0;
        targetY = 0;
        card.style.setProperty('--lift', '0px');
        kick();
      });
    });
  }

  /* ----------------------------------------------------------
     2. SCROLL REVEAL  (.reveal → .in-view)
  ---------------------------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    items.forEach((el) => observer.observe(el));
  }

  /* ----------------------------------------------------------
     3. ANIMATED COUNTERS + PROGRESS BARS
  ---------------------------------------------------------- */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target || '0');
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const duration = 1600;
    const start = performance.now();

    if (reduceMotion) {
      el.textContent = target.toFixed(decimals);
      return;
    }

    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const value = target * easeOutExpo(progress);
      el.textContent = value.toFixed(decimals);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals);
    }

    requestAnimationFrame(step);
  }

  function initCounters() {
    const counters = document.querySelectorAll('.counter');
    const bars = document.querySelectorAll('.bar-fill');

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
      bars.forEach((b) => (b.style.width = (b.dataset.width || 100) + '%'));
      return;
    }

    const counterObs = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => counterObs.observe(c));

    const barObs = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.width = (entry.target.dataset.width || 100) + '%';
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    bars.forEach((b) => barObs.observe(b));
  }

  /* ----------------------------------------------------------
     4. LIVE TERMINAL TYPING EFFECT
     Replaces the static fallback markup inside #terminal.
  ---------------------------------------------------------- */
  function initTerminal() {
    const screen = document.getElementById('terminal');
    if (!screen || reduceMotion) return;

    const lines = [
      { html: '<span class="t-prompt">$</span> aether init --agents 128', cls: '' },
      { html: '<span class="t-ok">✓</span> neural fabric online', cls: '', pause: 250 },
      { html: '<span class="t-ok">✓</span> sandbox: zero-trust enforced', cls: '', pause: 250 },
      { html: '<span class="t-ok">✓</span> memory graph mounted <span class="t-dim">(4.2 GB)</span>', cls: '', pause: 400 },
      { html: '<span class="t-prompt">$</span> aether deploy ./mission.json', cls: '', pause: 350 },
      { html: '<span class="t-info">→</span> agent[01] planning… <span class="t-dim">12ms</span>', cls: '', pause: 200 },
      { html: '<span class="t-info">→</span> agent[64] executing… <span class="t-dim">8ms</span>', cls: '', pause: 200 },
      { html: '<span class="t-info">→</span> agent[128] reflecting… <span class="t-dim">9ms</span>', cls: '', pause: 350 },
      { html: '<span class="t-ok">MISSION COMPLETE</span> — 0 violations <span class="t-dim">· 4.2s</span>', cls: '', pause: 900 },
    ];

    const MAX_VISIBLE = 7;
    let lineIndex = 0;
    let charIndex = 0;
    let currentLineEl = null;
    let typing = false;

    function reset() {
      screen.innerHTML = '';
      lineIndex = 0;
      charIndex = 0;
      currentLineEl = null;
    }

    function ensureLine() {
      if (!currentLineEl) {
        currentLineEl = document.createElement('p');
        screen.appendChild(currentLineEl);
        // Trim old lines so the box never overflows.
        while (screen.children.length > MAX_VISIBLE) {
          screen.removeChild(screen.firstChild);
        }
      }
    }

    function typeStep() {
      const line = lines[lineIndex];
      ensureLine();

      // We type plain text for lines whose html is plain-ish; for simplicity
      // we reveal HTML in chunks by character count of the raw string.
      const raw = line.html;

      if (charIndex <= raw.length) {
        // Reveal progressively but keep tags intact: count only visible chars.
        currentLineEl.innerHTML = revealPartial(raw, charIndex);
        charIndex += 1;
        typing = true;
        setTimeout(typeStep, 14 + Math.random() * 26);
      } else {
        // Line finished — finalize and move on.
        currentLineEl.innerHTML = raw;
        currentLineEl = null;
        charIndex = 0;
        lineIndex += 1;
        typing = false;

        if (lineIndex >= lines.length) {
          // Loop the demo after a pause.
          setTimeout(() => {
            reset();
            setTimeout(typeStep, 300);
          }, 2600);
          return;
        }

        const pause = line.pause || 120;
        setTimeout(typeStep, pause);
      }
    }

    // Returns HTML of `raw` showing only the first `n` visible characters,
    // without breaking tags open.
    function revealPartial(raw, n) {
      let out = '';
      let visible = 0;
      let i = 0;
      while (i < raw.length && visible < n) {
        if (raw[i] === '<') {
          const close = raw.indexOf('>', i);
          if (close === -1) break;
          out += raw.slice(i, close + 1);
          i = close + 1;
        } else {
          out += raw[i];
          i += 1;
          visible += 1;
        }
      }
      // Close any tags we opened but haven't finished (safe minimal pass).
      const opens = out.match(/<[a-z]/gi);
      const closes = out.match(/<\/[a-z]+>/gi);
      if (opens && closes && opens.length > closes.length) {
        out += '</span>';
      }
      return out;
    }

    // Start typing when the terminal scrolls into view (saves CPU).
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !typing && lineIndex === 0 && !screen.dataset.started) {
              screen.dataset.started = '1';
              screen.innerHTML = '';
              setTimeout(typeStep, 400);
              obs.disconnect();
            }
          });
        },
        { threshold: 0.3 }
      );
      obs.observe(screen);
    } else {
      screen.innerHTML = '';
      setTimeout(typeStep, 400);
    }
  }

  /* ----------------------------------------------------------
     5. STICKY HEADER + MOBILE MENU
  ---------------------------------------------------------- */
  function initHeader() {
    const header = document.getElementById('site-header');
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('mobile-menu');

    // Scrolled state.
    function onScroll() {
      if (!header) return;
      if (window.scrollY > 24) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Mobile menu.
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        menu.hidden = open;
      });

      // Close when a link is tapped.
      menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          toggle.setAttribute('aria-expanded', 'false');
          menu.hidden = true;
        });
      });

      // Close on Escape.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          toggle.setAttribute('aria-expanded', 'false');
          menu.hidden = true;
          toggle.focus();
        }
      });
    }
  }

  /* ----------------------------------------------------------
     6. CTA FORM VALIDATION (demo — no backend)
  ---------------------------------------------------------- */
  function initForm() {
    const form = document.getElementById('signup-form');
    const email = document.getElementById('email');
    const status = document.getElementById('form-status');
    if (!form || !email || !status) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = email.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

      if (!valid) {
        email.classList.add('is-invalid');
        status.style.color = '#ff2fd6';
        status.textContent = 'ERROR: invalid email address';
        email.focus();
        return;
      }

      email.classList.remove('is-invalid');
      status.style.color = '#b6ff3d';
      status.textContent = '✓ ACCESS REQUEST QUEUED — check your inbox, operator.';
      form.reset();
    });

    email.addEventListener('input', () => {
      email.classList.remove('is-invalid');
      if (status.textContent.startsWith('ERROR')) status.textContent = '';
    });
  }

  /* ----------------------------------------------------------
     7. SUBTLE GRID PARALLAX (background reacts to mouse)
        Only the fixed mesh layer moves — cheap transform.
  ---------------------------------------------------------- */
  function initBackgroundParallax() {
    if (reduceMotion || isCoarsePointer) return;
    const blobs = document.querySelectorAll('.mesh-blob');
    if (!blobs.length) return;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

    function loop() {
      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      blobs.forEach((b, i) => {
        const depth = (i + 1) * 6; // px
        b.style.marginLeft = (cx * depth).toFixed(2) + 'px';
        b.style.marginTop = (cy * depth).toFixed(2) + 'px';
      });
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }

    window.addEventListener(
      'mousemove',
      (e) => {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;  // -1..1
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
        if (raf === null) raf = requestAnimationFrame(loop);
      },
      { passive: true }
    );
  }

  /* ----------------------------------------------------------
     BOOT
  ---------------------------------------------------------- */
  function boot() {
    initHeader();
    initReveal();
    initCounters();
    initTilt();
    initTerminal();
    initForm();
    initBackgroundParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ============================================================
   3D PARALLAX TILT — ACTIVE MODULE (appended)
   ------------------------------------------------------------
   A real Vanilla JS mousemove listener for the Bento grid cards.
   For every card with the `data-tilt` attribute it:
     1. Listens for `mousemove` and calculates where the cursor
        is inside the card (as a percentage).
     2. Applies a dynamic inline style:
          transform: perspective(1000px) rotateX(..) rotateY(..)
        so the card tilts toward the mouse.
     3. Listens for `mouseleave` and resets the card to flat —
        the CSS transition in style.css (section 19) animates
        that reset smoothly.

   EDIT — INTENSITY OF THE 3D EFFECT:
     TILT_DEGREES  → how far the card rotates.
                     4 = subtle, 7 = balanced (default),
                     12 = extreme. Range: 0–20.
     FOLLOW_SPEED  → how fast the card tracks the mouse.
                     0.05s = snappy, 0.15s = floaty.
     RESET_SPEED   → how slowly the card glides back to flat
                     when the mouse leaves (default 0.5s in CSS).

   EDIT — PERSPECTIVE:
     Change `perspective(1000px)` below (and in style.css
     section 19) to change the camera distance:
     smaller number = more dramatic depth.
   ============================================================ */
(function () {
  'use strict';

  // ===== EDIT HERE: 3D tilt intensity (degrees) =====
  var TILT_DEGREES = 7; // 4 = subtle · 7 = balanced · 12 = extreme

  // ===== EDIT HERE: follow & reset speed (seconds) =====
  var FOLLOW_SPEED = '0.1s'; // how fast the card tracks the mouse
  // (the smooth mouseleave reset speed lives in style.css → 0.5s)

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Touch devices and reduced-motion users get no tilt.
  if (reduceMotion || isCoarsePointer) return;

  // Every card marked with data-tilt inside the Bento grid.
  var cards = document.querySelectorAll('.bento-grid [data-tilt]');

  cards.forEach(function (card) {
    // --- MOUSEMOVE: calculate position → apply 3D transform ---
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();

      // Cursor position inside the card, from 0.0 (top/left)
      // to 1.0 (bottom/right).
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;

      // Convert to degrees: rotateX reacts to vertical movement,
      // rotateY to horizontal movement. Both centre on 0.
      var rotateX = (0.5 - py) * 2 * TILT_DEGREES; // negative = tilt up
      var rotateY = (px - 0.5) * 2 * TILT_DEGREES; // positive = tilt right

      // Fast transition while tracking the mouse…
      card.style.setProperty('--tilt-speed', FOLLOW_SPEED);

      // …and the dynamic 3D transform itself.
      // (Inline style beats every stylesheet rule, so this is
      //  guaranteed to apply — see the specificity note in CSS.)
      card.style.transform =
        'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg)' +
        ' rotateY(' + rotateY.toFixed(2) + 'deg)';

      // Bonus: move the glass "shine" highlight to the cursor.
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    });

    // --- MOUSELEAVE: reset to flat (CSS transition does the easing) ---
    card.addEventListener('mouseleave', function () {
      // Remove the fast speed → CSS falls back to the slower
      // reset speed (0.5s), so the card glides back smoothly.
      card.style.removeProperty('--tilt-speed');

      // Reset transform to neutral — style.css section 19
      // transitions this over ~0.5s for a smooth landing.
      card.style.transform =
        'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  });
})();
