/**
 * ═══════════════════════════════════════════════════════════════
 * MATTI v1 — Unified Interaction Engine (06_engine.js)
 * Rythu Mitra · "From the Earth" design system
 *
 * Handles ALL interactions across 4 screens:
 *   screen-home   → Morning Briefing (హోం)
 *   screen-dabbu  → Money / Dabbu (దబ్బు)
 *   screen-market → Market Prices (మార్కెట్)
 *   screen-panta  → Crop Journal (పంట)
 *
 * Architecture:
 *   01. Fibonacci constants
 *   02. Kolam background canvas
 *   03. Screen navigation system
 *   04. Intersection observer animations
 *   05. Ripple effect system
 *   06. Balance counter animation
 *   07. Voice FAB + bottom sheet
 *   08. Toast system
 *   09. Donut chart (Dabbu screen)
 *   10. Trend chart (Market screen)
 *   11. Waveform canvas (Voice sheet)
 *   12. Price bar animations
 *   13. Crop lifecycle auto-scroll
 *   14. Quick log inline forms (Panta)
 *   15. Navigation click handlers
 *   16. DOMContentLoaded bootstrap
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

// ──────────────────────────────────────────────────────────────
// 01. FIBONACCI CONSTANTS
//     All animation timings are Fibonacci numbers (ms).
//     Living Geometry invariant: no arbitrary values.
// ──────────────────────────────────────────────────────────────
const FIB = {
  89:   89,
  144:  144,
  233:  233,
  377:  377,
  610:  610,
  987:  987,
  1597: 1597,
};

// Golden angle in radians — used by Kolam arcs
const GOLDEN_ANGLE_RAD = 137.508 * (Math.PI / 180);

// Kolam dot grid spacing (Fibonacci: 34)
const KOLAM_SPACING = 34;

// ──────────────────────────────────────────────────────────────
// 02. KOLAM BACKGROUND CANVAS
//     Draws the Rangoli dot grid that floats behind all screens.
//     Dots at 34px (Fibonacci) with golden-angle connecting arcs
//     on every 3rd node. Very low opacity — purely atmospheric.
// ──────────────────────────────────────────────────────────────

/**
 * Draw the kolam dot grid onto #kolam-bg.
 * Safe to call repeatedly on resize.
 */
function drawKolam() {
  const canvas = document.getElementById('kolam-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Resize canvas to full viewport
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const spacing = KOLAM_SPACING;
  const dotR    = 1.5;

  for (let x = spacing; x < canvas.width; x += spacing) {
    const col = Math.floor(x / spacing);

    for (let y = spacing; y < canvas.height; y += spacing) {
      const row = Math.floor(y / spacing);

      // Base dot
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#8B4513';
      ctx.fill();

      // Golden-angle arc on every 3rd dot (col + row divisible by 3)
      if ((col + row) % 3 === 0) {
        const startAngle = GOLDEN_ANGLE_RAD * col;
        ctx.beginPath();
        ctx.arc(x, y, spacing * 0.3, startAngle, startAngle + Math.PI * 0.8);
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// 03. SCREEN NAVIGATION SYSTEM
//     The prototype is a single HTML with 4 .screen divs.
//     Only one has class .active at a time.
//     Transitions: fade-out current (144ms), fade-in next (233ms).
//     Scroll position is remembered per screen.
// ──────────────────────────────────────────────────────────────

/** Map: screenId → remembered scroll position */
const _scrollPositions = {};

/** Currently visible screen ID */
let _currentScreenId = null;

/**
 * Switch to a screen by ID.
 * @param {string} screenId  e.g. 'screen-home'
 */
function switchScreen(screenId) {
  const next = document.getElementById(screenId);
  if (!next) return;
  if (_currentScreenId === screenId) return;

  const current = _currentScreenId
    ? document.getElementById(_currentScreenId)
    : null;

  // Save current scroll position
  if (current) {
    _scrollPositions[_currentScreenId] = current.scrollTop || window.scrollY;
  }

  // Fade-out current screen (144ms)
  if (current) {
    current.style.transition = `opacity ${FIB[144]}ms ease, transform ${FIB[144]}ms ease`;
    current.style.opacity    = '0';
    current.style.transform  = 'translateY(8px)';

    setTimeout(() => {
      current.classList.remove('active');
      current.style.transition = '';
      current.style.opacity    = '';
      current.style.transform  = '';
    }, FIB[144]);
  }

  // Fade-in next screen (233ms) — starts after fade-out completes
  setTimeout(() => {
    // Show the screen
    next.classList.add('active');
    next.style.opacity   = '0';
    next.style.transform = 'translateY(8px)';

    // Restore scroll position
    const savedScroll = _scrollPositions[screenId] || 0;
    next.scrollTop = savedScroll;

    // Trigger reflow then animate in
    requestAnimationFrame(() => {
      next.style.transition = `opacity ${FIB[233]}ms ease, transform ${FIB[233]}ms ease`;
      next.style.opacity    = '1';
      next.style.transform  = 'translateY(0)';

      setTimeout(() => {
        next.style.transition = '';
        next.style.opacity    = '';
        next.style.transform  = '';

        // Re-trigger screen-specific animations on entry
        onScreenEnter(screenId);
      }, FIB[233]);
    });
  }, current ? FIB[144] : 0);

  _currentScreenId = screenId;

  // Update bottom nav active state
  _updateNavActive(screenId);
}

/**
 * Called every time a screen becomes visible.
 * Re-initialises animations, charts, etc.
 * @param {string} screenId
 */
function onScreenEnter(screenId) {
  const container = document.getElementById(screenId);
  if (!container) return;

  // Re-init stagger animations for newly visible cards
  initAnimations(container);
  // Re-attach ripples (idempotent)
  initRipples(container);
  // Animate price bars for this screen
  animatePriceBars(container);

  switch (screenId) {
    case 'screen-home':
      animateHomeCounters();
      break;

    case 'screen-dabbu':
      drawDonutChart();
      animateDabbuCounters();
      break;

    case 'screen-market':
      drawTrendChart();
      animateMandiBarFills(container);
      break;

    case 'screen-panta':
      scrollToCurrentStage();
      break;
  }
}

/**
 * Update the .nav-item active indicator to match screenId.
 * Nav items carry data-screen attributes.
 * @param {string} screenId
 */
function _updateNavActive(screenId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const target = item.dataset.screen || item.id?.replace('nav-', 'screen-');
    item.classList.toggle('active', target === screenId);
  });
}

// ──────────────────────────────────────────────────────────────
// 04. INTERSECTION OBSERVER ANIMATION SYSTEM
//     Watches scroll-in of animated elements and stamps
//     the .animate-in class to trigger CSS keyframes.
//     data-delay on the element gives stagger offset (ms).
// ──────────────────────────────────────────────────────────────

/**
 * Set up IntersectionObserver for a given container.
 * Safe to call multiple times — uses a WeakSet to avoid re-observing.
 * @param {HTMLElement} container
 */
const _observed = new WeakSet();

function initAnimations(container) {
  if (!container) return;

  const selector = [
    '.briefing-card',
    '.txn-item',
    '.mandi-row',
    '.journal-event',
    '.matti-card',
  ].join(', ');

  const elements = container.querySelectorAll(selector);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el    = entry.target;
      const delay = parseInt(el.dataset.delay || '0', 10);
      setTimeout(() => el.classList.add('animate-in'), delay);
      observer.unobserve(el);
    });
  }, { threshold: 0.1 });

  elements.forEach(el => {
    if (_observed.has(el)) return;
    _observed.add(el);
    observer.observe(el);
  });
}

// ──────────────────────────────────────────────────────────────
// 05. RIPPLE EFFECT SYSTEM
//     Brass-gold radial gradient ripple on tap/click.
//     Expands and fades over 610ms (Fibonacci).
// ──────────────────────────────────────────────────────────────

/** Set of elements that already have ripple attached */
const _rippled = new WeakSet();

/**
 * Attach ripple click handlers to interactive elements in a container.
 * @param {HTMLElement} container
 */
function initRipples(container) {
  if (!container) return;

  const selector = [
    '.briefing-card',
    '.txn-item',
    '.nav-item',
    '.quick-btn',
    '.log-btn',
    '.crop-pill',
    '.mandi-row',
  ].join(', ');

  container.querySelectorAll(selector).forEach(el => {
    if (_rippled.has(el)) return;
    _rippled.add(el);

    // Ensure position context for the ripple span
    const pos = window.getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';

    el.addEventListener('click', function(e) {
      const rect   = this.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = `
        position: absolute;
        width:  ${size}px;
        height: ${size}px;
        left:   ${x}px;
        top:    ${y}px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          rgba(184, 134, 11, 0.18) 0%,
          transparent 70%
        );
        transform: scale(0);
        animation: rippleExpand ${FIB[610]}ms linear forwards;
        pointer-events: none;
      `;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), FIB[610]);
    });
  });
}

// ──────────────────────────────────────────────────────────────
// 06. BALANCE COUNTER ANIMATION
//     Counts up from 0 → target with ease-out-cubic.
//     Uses Indian locale formatting (en-IN).
// ──────────────────────────────────────────────────────────────

/**
 * Animate a numeric counter with ease-out-cubic.
 * @param {HTMLElement} element   Target DOM element
 * @param {number}      target    End value (integer)
 * @param {number}      duration  ms — use Fibonacci
 * @param {string}      prefix    e.g. '₹', '+₹', '−₹'
 */
function animateCounter(element, target, duration, prefix = '₹') {
  if (!element) return;

  const startTime = performance.now();
  const startVal  = 0;

  function tick(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic: 1 - (1 - t)³
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = Math.round(startVal + (target - startVal) * eased);

    element.textContent = prefix + current.toLocaleString('en-IN');

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/**
 * Animate the balance counters on the Home screen.
 * Reads actual text values from the DOM.
 */
function animateHomeCounters() {
  // Main balance amount — contains a .currency span, reconstruct after
  const balanceEl = document.querySelector('#screen-home .balance-amount');
  if (balanceEl) {
    balanceEl.innerHTML = '<span class="currency">₹</span>0';
    const numEl = document.createElement('span');
    numEl.className = 'balance-count';
    balanceEl.appendChild(numEl);

    setTimeout(() => {
      animateCounter(numEl, 6200, FIB[987], '');
    }, FIB[610]);
  }

  // Breakdown items
  const incomeEl  = document.querySelector('#screen-home .balance-item-value.income');
  const expenseEl = document.querySelector('#screen-home .balance-item-value.expense');

  if (incomeEl) {
    setTimeout(() => animateCounter(incomeEl, 12400, FIB[987], '+₹'), FIB[610] + 100);
  }
  if (expenseEl) {
    setTimeout(() => animateCounter(expenseEl, 6200, FIB[987], '−₹'), FIB[610] + 200);
  }
}

/**
 * Animate counters on the Dabbu (Money) screen.
 */
function animateDabbuCounters() {
  const totalIncomeEl  = document.getElementById('totalIncome');
  const totalExpenseEl = document.getElementById('totalExpense');
  const seasonNetEl    = document.getElementById('seasonNet');
  const headerBalEl    = document.getElementById('headerBalance');

  if (totalIncomeEl)  animateCounter(totalIncomeEl,  12400, FIB[987], '+₹');
  if (totalExpenseEl) animateCounter(totalExpenseEl, 6200,  FIB[987], '−₹');
  if (seasonNetEl)    animateCounter(seasonNetEl,    42600, FIB[1597], '+₹');
  if (headerBalEl)    animateCounter(headerBalEl,    6200,  FIB[987], '+₹');
}

// ──────────────────────────────────────────────────────────────
// 07. VOICE FAB SYSTEM
//     Single mic button used across all screens.
//     On the Dabbu screen: opens bottom sheet with waveform.
//     On other screens: shows a toast then a parsed result.
// ──────────────────────────────────────────────────────────────

let _voiceListening = false;
let _voiceTimeout   = null;

function initVoiceFab() {
  const fab = document.getElementById('voiceFab');
  if (!fab) return;

  fab.addEventListener('click', () => {
    if (_voiceListening) {
      _cancelVoice();
    } else {
      _startVoice();
    }
  });

  // Voice sheet confirm / edit buttons
  const confirmBtn = document.getElementById('voiceConfirm');
  const editBtn    = document.getElementById('voiceEdit');
  const overlay    = document.getElementById('voiceOverlay');

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      _closeVoiceSheet();
      showToast('✓ "రెండు కూలీలకు నాలుగు వందలు" — ₹800 నమోదు అయింది', 'default', 4000);
    });
  }
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      _closeVoiceSheet();
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => _closeVoiceSheet());
  }
}

function _startVoice() {
  const fab = document.getElementById('voiceFab');
  if (!fab) return;

  _voiceListening = true;
  fab.classList.add('listening');

  // On Dabbu screen: open the bottom sheet
  if (_currentScreenId === 'screen-dabbu') {
    _openVoiceSheet();
  } else {
    // Other screens: toast then parsed result
    showToast('🎙️ వింటున్నాను... చెప్పండి', 'default', 3000);

    _voiceTimeout = setTimeout(() => {
      if (!_voiceListening) return;
      _cancelVoice();
      showToast('✓ "రెండు కూలీలకు నాలుగు వందలు" — ₹800 కూలి నమోదు', 'default', 4000);
    }, 3000);
  }
}

function _cancelVoice() {
  const fab = document.getElementById('voiceFab');
  if (fab) fab.classList.remove('listening');
  _voiceListening = false;
  if (_voiceTimeout) {
    clearTimeout(_voiceTimeout);
    _voiceTimeout = null;
  }
  _closeVoiceSheet();
}

function _openVoiceSheet() {
  const overlay = document.getElementById('voiceOverlay');
  const sheet   = document.getElementById('voiceSheet');
  if (!sheet) return;

  if (overlay) {
    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  sheet.style.display = 'flex';
  requestAnimationFrame(() => {
    sheet.style.transition = `transform ${FIB[377]}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    sheet.classList.add('open');
  });

  // Reset parsed card visibility
  const parsedCard   = document.getElementById('parsedCard');
  const voiceActions = document.getElementById('voiceActions');
  const sheetTitle   = document.getElementById('sheetTitle');
  if (parsedCard)   parsedCard.style.display   = 'none';
  if (voiceActions) voiceActions.style.display = 'none';
  if (sheetTitle)   sheetTitle.textContent = 'వింటున్నాను...';

  startWaveform();

  // After 2500ms: show parsed result
  _voiceTimeout = setTimeout(() => {
    if (!_voiceListening) return;
    stopWaveform();
    if (parsedCard)   parsedCard.style.display   = 'block';
    if (voiceActions) voiceActions.style.display = 'flex';
    if (sheetTitle)   sheetTitle.textContent = 'ఇది సరైనదా?';
    fab_stopListeningPulse();
  }, 2500);
}

function _closeVoiceSheet() {
  const overlay = document.getElementById('voiceOverlay');
  const sheet   = document.getElementById('voiceSheet');
  if (!sheet) return;

  sheet.style.transition = `transform ${FIB[377]}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  sheet.classList.remove('open');

  setTimeout(() => {
    sheet.style.display = '';
  }, FIB[377]);

  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = ''; }, FIB[377]);
  }

  stopWaveform();
  _voiceListening = false;
  const fab = document.getElementById('voiceFab');
  if (fab) fab.classList.remove('listening');
}

function fab_stopListeningPulse() {
  const fab = document.getElementById('voiceFab');
  if (fab) fab.classList.remove('listening');
  _voiceListening = false;
}

// ──────────────────────────────────────────────────────────────
// 08. TOAST SYSTEM
//     Three flavour types mapped to border colors.
//     Entry: toastIn (slide + 3° rotation).
//     Floating: gentle 3px bob after entry.
//     Auto-dismiss with fade-up exit.
// ──────────────────────────────────────────────────────────────

/**
 * Show a mango-leaf toast notification.
 * @param {string} message   HTML string content
 * @param {'default'|'warning'|'alert'} type
 * @param {number} duration  ms until auto-dismiss (default 4000)
 */
function showToast(message, type = 'default', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const iconMap = { default: '🍃', warning: '⚠️', alert: '🔔' };
  const icon    = iconMap[type] || '🍃';

  const toast = document.createElement('div');
  toast.className  = `mango-toast ${type}`;
  toast.innerHTML  = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${message}</span>
  `;

  // toastIn animation is defined in CSS: slide + 3° rotation → settle
  container.appendChild(toast);

  // Switch to toastFloat (gentle bob) after entry completes (610ms)
  setTimeout(() => {
    toast.style.animation = `toastFloat 2s ease-in-out infinite`;
  }, FIB[610]);

  // Auto-dismiss
  const dismissAt = duration > FIB[610] ? duration : FIB[610] + 100;
  setTimeout(() => {
    toast.style.transition = `opacity ${FIB[377]}ms ease, transform ${FIB[377]}ms ease`;
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateY(-12px) rotate(-2deg)';
    setTimeout(() => toast.remove(), FIB[377]);
  }, dismissAt);
}

// ──────────────────────────────────────────────────────────────
// 09. DONUT CHART (Dabbu / Money screen)
//     6 expense segments with 3° gaps drawn on #donutChart.
//     Animated via requestAnimationFrame over 987ms.
// ──────────────────────────────────────────────────────────────

const DONUT_SEGMENTS = [
  { label: 'కూలి',          pct: 0.32, color: '#8B4513' },  // matti
  { label: 'విత్తనాలు',      pct: 0.22, color: '#2D6A4F' },  // pacchi
  { label: 'ఎరువులు',        pct: 0.18, color: '#1B4F72' },  // neeli
  { label: 'నీటిపారుదల',    pct: 0.13, color: '#2980B9' },  // neeli-light
  { label: 'రవాణా',          pct: 0.09, color: '#E8A317' },  // pasupu
  { label: 'ఇతర',            pct: 0.06, color: '#B8A99A' },  // ink-tertiary
];

const DONUT_GAP_RAD  = (3 * Math.PI) / 180; // 3° gap between segments
const DONUT_TOTAL_RS = 8200;

function drawDonutChart() {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const cx     = W / 2;
  const cy     = H / 2;
  const radius = Math.min(W, H) / 2 - 8;
  const inner  = radius * 0.62;

  const startTime  = performance.now();
  const duration   = FIB[987];
  const startAngle = -Math.PI / 2; // 12 o'clock

  // Pre-compute final angles
  const segAngles = DONUT_SEGMENTS.map(s => s.pct * (Math.PI * 2 - DONUT_SEGMENTS.length * DONUT_GAP_RAD));

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOutCubic(progress);

    ctx.clearRect(0, 0, W, H);

    let angle = startAngle;

    DONUT_SEGMENTS.forEach((seg, i) => {
      const targetAngle = segAngles[i];
      const sweepAngle  = targetAngle * eased;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + sweepAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Punch out inner hole to make it a donut
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.fillStyle = canvas.closest('.overview-card')
        ? getComputedStyle(document.documentElement).getPropertyValue('--patti-warm').trim() || '#F5F0E6'
        : '#FAF7F0';
      ctx.fill();

      angle += sweepAngle + DONUT_GAP_RAD;
    });

    // Centre text
    ctx.fillStyle = '#1C1410';
    ctx.font      = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayed = Math.round(DONUT_TOTAL_RS * eased).toLocaleString('en-IN');
    ctx.fillText('₹' + displayed, cx, cy);

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ──────────────────────────────────────────────────────────────
// 10. TREND CHART (Market screen)
//     Draws a turmeric-wash brush-stroke price line on #price-chart.
//     Variable stroke width based on slope (calligraphy effect).
//     Includes MSP dashed reference line, gradient fill, axis labels.
//     Progressive left-to-right draw over 1200ms.
// ──────────────────────────────────────────────────────────────

// 30 mock price data points fluctuating around 5700–6100
const TREND_DATA = [
  5720, 5740, 5780, 5820, 5800, 5760, 5810, 5850, 5870, 5840,
  5900, 5920, 5890, 5870, 5910, 5950, 5980, 5960, 5940, 5920,
  5880, 5900, 5930, 5960, 6000, 6020, 5990, 5970, 6050, 6080,
];
const TREND_MSP = 5850;

function drawTrendChart() {
  const canvas = document.getElementById('price-chart');
  if (!canvas) return;

  // canvas size is set by CSS — ensure pixel match
  canvas.width  = canvas.offsetWidth  || 330;
  canvas.height = canvas.offsetHeight || 140;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const padL   = 10;
  const padR   = 10;
  const padT   = 20;
  const padB   = 24;

  const drawW  = W - padL - padR;
  const drawH  = H - padT - padB;

  const prices = TREND_DATA;
  const minP   = Math.min(...prices) - 50;
  const maxP   = Math.max(...prices) + 50;
  const range  = maxP - minP;

  // Map a price → canvas Y
  function py(price) {
    return padT + drawH - ((price - minP) / range) * drawH;
  }

  // Map index → canvas X
  function px(i) {
    return padL + (i / (prices.length - 1)) * drawW;
  }

  const duration  = 1200; // ms (not strict Fibonacci, but close to 1597/2)
  const startTime = performance.now();

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out: 1 - (1-t)^2
    const eased    = 1 - Math.pow(1 - progress, 2);
    const drawUpTo = Math.floor(eased * (prices.length - 1));

    ctx.clearRect(0, 0, W, H);

    if (drawUpTo < 1) {
      if (progress < 1) requestAnimationFrame(frame);
      return;
    }

    // ── Gradient fill under curve ──
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + drawH);
    gradient.addColorStop(0,   'rgba(232, 163, 23, 0.18)');
    gradient.addColorStop(1,   'rgba(232, 163, 23, 0)');

    ctx.beginPath();
    ctx.moveTo(px(0), py(prices[0]));
    for (let i = 1; i <= drawUpTo; i++) {
      ctx.lineTo(px(i), py(prices[i]));
    }
    ctx.lineTo(px(drawUpTo), H - padB);
    ctx.lineTo(px(0),        H - padB);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // ── Turmeric brush-stroke line (variable width) ──
    for (let i = 1; i <= drawUpTo; i++) {
      const x0    = px(i - 1);
      const y0    = py(prices[i - 1]);
      const x1    = px(i);
      const y1    = py(prices[i]);
      const slope = Math.abs(y1 - y0) / Math.max(Math.abs(x1 - x0), 1);

      // Older segments more transparent (impermanence / wabi-sabi)
      const alpha   = 0.4 + 0.6 * (i / drawUpTo);
      const lineW   = Math.max(1.5, 5 - slope * 0.3);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = `rgba(232, 163, 23, ${alpha})`;
      ctx.lineWidth   = lineW;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    // ── MSP reference line (dashed, neeli) ──
    const mspY = py(TREND_MSP);
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(padL, mspY);
    ctx.lineTo(padL + drawW, mspY);
    ctx.strokeStyle = '#1B4F72';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // MSP label
    ctx.fillStyle    = '#1B4F72';
    ctx.font         = '9px "Courier New", monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('MSP', padL + 2, mspY - 2);

    // ── Axis labels ──
    ctx.fillStyle    = '#8B7D6B';
    ctx.font         = '9px "Courier New", monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('30 రోజులు', padL, H - padB + 4);

    ctx.textAlign = 'right';
    ctx.fillText('నేడు', padL + drawW, H - padB + 4);

    // Price min/max labels
    const minIdx = prices.indexOf(Math.min(...prices));
    const maxIdx = prices.indexOf(Math.max(...prices));
    if (minIdx <= drawUpTo) {
      ctx.fillStyle    = '#C0392B';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('₹' + prices[minIdx].toLocaleString('en-IN'), px(minIdx), py(prices[minIdx]) + 4);
    }
    if (maxIdx <= drawUpTo) {
      ctx.fillStyle    = '#2D6A4F';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('₹' + prices[maxIdx].toLocaleString('en-IN'), px(maxIdx), py(prices[maxIdx]) - 4);
    }

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ──────────────────────────────────────────────────────────────
// 11. WAVEFORM CANVAS (Voice bottom sheet)
//     Organic multi-sine waveform in pasupu (#E8A317).
//     60fps via requestAnimationFrame. Start/stop controlled.
// ──────────────────────────────────────────────────────────────

let _waveformRAF  = null;
let _waveformTime = 0;

function startWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;

  canvas.width  = canvas.offsetWidth  || 330;
  canvas.height = canvas.offsetHeight || 55;

  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  const cx  = H / 2;

  // Define three overlapping sine waves
  const waves = [
    { freq: 0.045, amp: cx * 0.55, phase: 0,         speed: 2.1, alpha: 0.7 },
    { freq: 0.030, amp: cx * 0.35, phase: Math.PI,   speed: 1.4, alpha: 0.45 },
    { freq: 0.070, amp: cx * 0.25, phase: Math.PI/2, speed: 3.0, alpha: 0.3 },
  ];

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    _waveformTime += 0.04;

    waves.forEach(wave => {
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const y = cx + Math.sin(x * wave.freq + _waveformTime * wave.speed + wave.phase) * wave.amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(232, 163, 23, ${wave.alpha})`;
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.stroke();
    });

    _waveformRAF = requestAnimationFrame(drawFrame);
  }

  stopWaveform();
  drawFrame();
}

function stopWaveform() {
  if (_waveformRAF) {
    cancelAnimationFrame(_waveformRAF);
    _waveformRAF = null;
  }
  const canvas = document.getElementById('waveformCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ──────────────────────────────────────────────────────────────
// 12. PRICE BAR ANIMATIONS
//     Vertical .price-bar[data-height] elements → animate height.
//     Horizontal .mandi-bar-fill[data-width] elements → animate width.
//     Spring easing over 987ms.
// ──────────────────────────────────────────────────────────────

/**
 * Animate all .price-bar and .mandi-bar-fill elements in a container.
 * @param {HTMLElement} container
 */
function animatePriceBars(container) {
  if (!container) return;

  // Vertical bars (height, used on Home screen cards)
  container.querySelectorAll('.price-bar[data-height]').forEach(bar => {
    if (bar.dataset.animated) return;
    bar.dataset.animated = '1';
    bar.style.height = '0';

    setTimeout(() => {
      bar.style.transition = `height ${FIB[987]}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      bar.style.height     = bar.dataset.height + 'px';
    }, FIB[377]);
  });
}

/**
 * Animate .mandi-bar-fill[data-width] horizontal fills (Market screen).
 * @param {HTMLElement} container
 */
function animateMandiBarFills(container) {
  if (!container) return;

  container.querySelectorAll('.mandi-bar-fill[data-width], [data-width]').forEach(fill => {
    if (fill.dataset.fillAnimated) return;
    fill.dataset.fillAnimated = '1';
    fill.style.width = '0';

    setTimeout(() => {
      fill.style.transition = `width ${FIB[987]}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      fill.style.width      = fill.dataset.width + '%';
    }, FIB[233]);
  });

  // Also handle history bar fills on the Market screen
  ['histBarCurrent', 'histBarLast'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.fillAnimated) return;
    el.dataset.fillAnimated = '1';
    const targetW = el.dataset.width || '0';
    el.style.width = '0';
    setTimeout(() => {
      el.style.transition = `width ${FIB[987]}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      el.style.width      = targetW + '%';
    }, FIB[610]);
  });
}

// ──────────────────────────────────────────────────────────────
// 13. CROP LIFECYCLE AUTO-SCROLL
//     Centre the active stage in the horizontal scroll strip.
// ──────────────────────────────────────────────────────────────

/**
 * Smooth-scroll the lifecycle strip so the active stage is centred.
 */
function scrollToCurrentStage() {
  const strip  = document.getElementById('lifecycleScroll');
  if (!strip) return;

  const active = strip.querySelector('.lifecycle-stage.active, .lifecycle-stage.current');
  if (!active) return;

  const stripRect  = strip.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const targetScroll = active.offsetLeft - (strip.offsetWidth / 2) + (active.offsetWidth / 2);

  strip.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
}

// ──────────────────────────────────────────────────────────────
// 14. QUICK LOG INLINE FORMS (Panta screen)
//     Toggle the quick-form panels below the quick-btn row.
//     Only one form open at a time.
//     CSS scaleY: 0→1 expand, 1→0 collapse.
// ──────────────────────────────────────────────────────────────

let _openForm = null;

/**
 * Toggle a quick-log inline form.
 * @param {string} formId  e.g. 'form-photo', 'form-water'
 */
function toggleLogForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const isOpen = _openForm === formId;

  // Close any currently open form
  if (_openForm) {
    const prev = document.getElementById(_openForm);
    if (prev) {
      prev.style.transition = `transform ${FIB[233]}ms ease, opacity ${FIB[233]}ms ease`;
      prev.style.transform  = 'scaleY(0)';
      prev.style.opacity    = '0';
      setTimeout(() => { prev.style.display = 'none'; }, FIB[233]);
    }
    _openForm = null;
  }

  if (!isOpen) {
    // Open this form
    form.style.display    = 'block';
    form.style.transform  = 'scaleY(0)';
    form.style.opacity    = '0';
    form.style.transformOrigin = 'top center';

    requestAnimationFrame(() => {
      form.style.transition = `transform ${FIB[377]}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${FIB[377]}ms ease`;
      form.style.transform  = 'scaleY(1)';
      form.style.opacity    = '1';
    });

    _openForm = formId;
  }
}

/**
 * Attach handlers to all .quick-btn elements (data-form attribute).
 * Also attaches save-button handlers inside each form.
 */
function initQuickLogForms() {
  const container = document.getElementById('screen-panta');
  if (!container) return;

  // Quick-log buttons
  container.querySelectorAll('.quick-btn[data-form]').forEach(btn => {
    btn.addEventListener('click', () => toggleLogForm(btn.dataset.form));
  });

  // Save buttons inside forms
  container.querySelectorAll('.quick-form .save-btn, .quick-form button[type="submit"]').forEach(saveBtn => {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const form = saveBtn.closest('.quick-form');
      if (form && _openForm === form.id) {
        toggleLogForm(form.id); // close
      }
      showToast('✓ నమోదు పూర్తయింది', 'default', 3000);
    });
  });
}

// ──────────────────────────────────────────────────────────────
// 15. NAVIGATION CLICK HANDLERS
//     Maps each .nav-item to its screen ID via data-screen attr
//     or falls back to position-based mapping.
// ──────────────────────────────────────────────────────────────

// Fallback mapping in case data-screen is absent
// (matches the order: home, dabbu, [FAB spacer], market, crop)
const NAV_FALLBACK_SCREENS = [
  'screen-home',
  'screen-dabbu',
  null,           // FAB spacer slot — no screen
  'screen-market',
  'screen-panta',
];

function initNavigation() {
  const navItems = Array.from(document.querySelectorAll('.nav-item'));

  navItems.forEach((item, index) => {
    // Determine target screen
    const screenId = item.dataset.screen
      || (item.id ? 'screen-' + item.id.replace('nav-', '') : null)
      || NAV_FALLBACK_SCREENS[index]
      || null;

    if (!screenId) return; // FAB spacer slot

    // Stamp for _updateNavActive
    if (!item.dataset.screen) item.dataset.screen = screenId;

    item.addEventListener('click', () => switchScreen(screenId));
  });
}

// ──────────────────────────────────────────────────────────────
// 16. DOMCONTENTLOADED BOOTSTRAP
//     Wire everything up once the DOM is ready.
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // ── Kolam background ──────────────────────────────────────
  drawKolam();
  window.addEventListener('resize', drawKolam);

  // ── Voice FAB ─────────────────────────────────────────────
  initVoiceFab();

  // ── Bottom navigation ─────────────────────────────────────
  initNavigation();

  // ── Quick log forms (Panta screen) ────────────────────────
  initQuickLogForms();

  // ── Detect the initially active screen ───────────────────
  let initialScreen = null;

  // Check which screen is marked active in HTML
  const activeScreenEl = document.querySelector('.screen.active');
  if (activeScreenEl) {
    initialScreen = activeScreenEl.id;
  } else {
    // Default to home
    initialScreen = 'screen-home';
    const homeEl = document.getElementById('screen-home');
    if (homeEl) homeEl.classList.add('active');
  }

  _currentScreenId = initialScreen;
  _updateNavActive(initialScreen);

  // ── Bootstrap the initial screen ─────────────────────────
  const initialContainer = document.getElementById(initialScreen);
  if (initialContainer) {
    initAnimations(initialContainer);
    initRipples(initialContainer);
    animatePriceBars(initialContainer);
  }

  // Also init ripples on nav items (they live outside screens)
  initRipples(document.querySelector('.bottom-nav') || document.body);

  // Screen-specific bootstrap
  onScreenEnter(initialScreen);

  // ── Welcome toast (2500ms delay — after load animations) ──
  setTimeout(() => {
    showToast('🌅 శుభోదయం! 3 కొత్త అప్‌డేట్‌లు', 'default', 5000);
  }, 2500);
});
