(function () {
  var POPUP_ORIGIN = 'https://am-ford-otp-popup.vercel.app/';
  var VINS_STORAGE_KEY = 'otp_popup_unlocked_vins_v1';
  var GLOBAL_VERIFY_KEY = 'otp_popup_user_verified_v1';
  var PRICE_TEASER_IMAGE_URL = 'https://www.irwinzone.com/static/dealer-5520/start_lower_price_here_green.png';

  function getUnlockedKeys() {
    try { 
      var r = localStorage.getItem(VINS_STORAGE_KEY); 
      if (!r) return [];
      var data = JSON.parse(r);
      if (Array.isArray(data)) {
        localStorage.removeItem(VINS_STORAGE_KEY);
        return [];
      } else if (data && data.vins) {
        if (Date.now() > data.expiry) {
          localStorage.removeItem(VINS_STORAGE_KEY);
          return [];
        }
        return data.vins;
      }
      return [];
    } catch (e) { return []; }
  }
  function isKeyUnlocked(k) { return k && getUnlockedKeys().indexOf(k) >= 0; }
  function addUnlockedKey(k) {
    if (!k) return;
    try {
      var a = getUnlockedKeys();
      if (a.indexOf(k) < 0) { 
        a.push(k); 
        var expiry = Date.now() + (3 * 24 * 60 * 60 * 1000);
        localStorage.setItem(VINS_STORAGE_KEY, JSON.stringify({ vins: a, expiry: expiry })); 
      }
    } catch (e) {}
  }
  function isGloballyVerified() {
    if (window.__otpGloballyVerified) return true;
    try { 
      var val = localStorage.getItem(GLOBAL_VERIFY_KEY);
      if (!val) return false;
      if (val === '1') {
        localStorage.removeItem(GLOBAL_VERIFY_KEY);
        return false;
      }
      if (Date.now() > parseInt(val, 10)) {
        localStorage.removeItem(GLOBAL_VERIFY_KEY);
        return false;
      }
      return true;
    } catch (e) { return false; }
  }
  function setGloballyVerified() {
    try {
      window.__otpGloballyVerified = true;
      var expiry = Date.now() + (3 * 24 * 60 * 60 * 1000);
      localStorage.setItem(GLOBAL_VERIFY_KEY, expiry.toString());
    } catch (e) {}
  }

  function unlockKeyFromContext(ctx) {
    if (!ctx) return '';
    var v = (ctx.vin || '').trim().toUpperCase(); if (v) return 'V:' + v;
    var s = (ctx.stock || '').trim().toUpperCase(); if (s) return 'S:' + s;
    return '';
  }
  function unlockKeyFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return '';
    var src = payload.car || payload;
    var v = (src.vin || '').trim().toUpperCase(); if (v) return 'V:' + v;
    var s = (src.stock || '').trim().toUpperCase(); if (s) return 'S:' + s;
    return '';
  }

  function matchesGetTodaysPriceLabel(text) {
    var t = String(text || '').toLowerCase();
    var cleaned = '';
    var sawSpace = false;
    var i = 0;
    for (i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (ch === '\u2019') ch = "'";
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        if (!sawSpace) {
          cleaned += ' ';
          sawSpace = true;
        }
      } else {
        cleaned += ch;
        sawSpace = false;
      }
    }
    t = cleaned.replace(/^\s+|\s+$/g, '');
    if (t.length > 28) return false;
    return t.indexOf("get today's price") !== -1 || t.indexOf('get todays price') !== -1;
  }
  function removePopupOverlay() {
    var o1 = document.getElementById('custom-price-popup');
    if (o1 && o1.parentNode) o1.parentNode.removeChild(o1);
    var o2 = document.getElementById('otp-vdp-popup');
    if (o2 && o2.parentNode) o2.parentNode.removeChild(o2);
    try {
      if (typeof window.__otpScrollY === 'number') {
        window.scrollTo(0, window.__otpScrollY);
      }
    } catch (e) {}
  }

  function getMainPopupPageType() {
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('/inventory/') !== -1) {
      return 'VDP';
    }
    if (path.indexOf('/used-vehicles') !== -1 || path.indexOf('/new-vehicles') !== -1) {
      return 'SRP';
    }
    return 'Other';
  }

  function getMainPopupSourceLabel(pageType) {
    if (pageType === 'VDP') {
      return 'VDP Unlock';
    }
    if (pageType === 'SRP') {
      return 'SRP Unlock';
    }
    return 'Instant Price Unlock';
  }

  function imgEffectiveSrcCard(img) {
    try {
      if (img.currentSrc) {
        return String(img.currentSrc).trim();
      }
    } catch (e) {}
    return (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
  }

  function findInstantPriceBlock(wrap) {
    if (!wrap) return null;
    var blocks = wrap.querySelectorAll('.price-block');
    for (var i = 0; i < blocks.length; i++) {
      var label = blocks[i].querySelector('.price-label');
      if (label && label.textContent.replace(/\s+/g, ' ').trim().toLowerCase().indexOf('instant price') !== -1) {
        return blocks[i];
      }
    }
    return null;
  }

  function hideInstantPrice(wrap) {
    var block = findInstantPriceBlock(wrap);
    if (!block || block.getAttribute('data-otp-ip-hidden')) return;
    block.setAttribute('data-otp-ip-hidden', '1');
    block.style.setProperty('display', 'none', 'important');
  }

  function revealInstantPrice(wrap) {
    var block = findInstantPriceBlock(wrap);
    if (!block) return;
    block.removeAttribute('data-otp-ip-hidden');
    block.style.removeProperty('display');
    block.style.opacity = '0';
    block.style.transform = 'translateY(6px)';
    block.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        block.style.opacity = '1';
        block.style.transform = 'translateY(0)';
      });
    });
  }

  function hideLegacyCtasInCard(wrap) {
    if (!wrap) return;
    var nodes = wrap.querySelectorAll('.lightning-custom-cta.stat-button-link');
    for (var i = 0; i < nodes.length; i++) {
      var txt = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!matchesGetTodaysPriceLabel(txt)) continue;
      nodes[i].setAttribute('data-otp-legacy-hidden', '1');
      nodes[i].style.setProperty('display', 'none', 'important');
      nodes[i].style.setProperty('visibility', 'hidden', 'important');
      nodes[i].style.setProperty('pointer-events', 'none', 'important');
    }
  }

  function injectStylesOnce() {
    if (document.getElementById('otp-ip-styles')) return;
    var st = document.createElement('style');
    st.id = 'otp-ip-styles';
    st.textContent =
      /* ── Teaser image host ── */
      '.otp-teaser-host{' +
      'width:100%;box-sizing:border-box;' +
      'cursor:pointer;' +
      'margin-bottom:0;' +
      'display:flex;justify-content:center;' +
      '}' +
      '.otp-teaser-host img{' +
      'display:block;width:100%;max-width:100%;' +
      'height:auto;object-fit:contain;' +
      '}' +
      /* Mobile: 20% smaller teaser image, centered */
      '@media(max-width:767px){' +
      '.otp-teaser-host img{' +
      'width:80%;max-width:80%;' +
      '}' +
      '}' +
      /* ── Wrapper (mobile layout) ── */
      '.otp-unlock-ip-wrapper{' +
      'width:100%;box-sizing:border-box;' +
      '}' +
      /* ── Unlock button ── */
      '.otp-unlock-ip-btn{' +
      'display:flex;align-items:center;justify-content:center;gap:10px;' +
      'width:100%;box-sizing:border-box;' +
      'padding:14px 16px;' +
      'background:#05214F;color:#fff;' +
      'border:none;cursor:pointer;' +
      'font-weight:600;font-size:15px;' +
      'font-family:system-ui,-apple-system,sans-serif;' +
      'position:relative;overflow:hidden;' +
      'animation:otpGlowPulse 2.8s ease-in-out infinite;' +
      'box-shadow:none!important;' +
      '}' +
      /* Desktop: margin-bottom */
      '@media(min-width:768px){' +
      '.otp-unlock-ip-btn{margin-bottom:10px;}' +
      '}' +
      /* Mobile: wrapper flex layout + button width */
      '@media(max-width:767px){' +
      '.otp-unlock-ip-wrapper{' +
      'width:100%;' +
      'margin-bottom:10px;' +
      'margin-top:0;' +
      'display:flex;' +
      'flex-direction:row;' +
      'justify-content:center;' +
      'align-items:center;' +
      '}' +
      '.otp-unlock-ip-wrapper .otp-unlock-ip-btn{width:98%;}' +
      '}' +
      /* Shimmer sweep */
      '.otp-unlock-ip-btn::before{' +
      'content:"";position:absolute;top:0;left:-100%;width:60%;height:100%;' +
      'background:linear-gradient(120deg,transparent,rgba(255,255,255,0.3),transparent);' +
      'filter:blur(8px);animation:otpFogSweep 3.5s ease-in-out infinite;' +
      '}' +
      '@keyframes otpGlowPulse{' +
      '0%{transform:scale(1);}' +
      '50%{transform:scale(1.02);}' +
      '100%{transform:scale(1);}' +
      '}' +
      '@keyframes otpFogSweep{0%{left:-100%;}50%{left:120%;}100%{left:120%;}}' +
      '.otp-unlock-ip-btn:hover{filter:brightness(1.1);}' +
      '.otp-unlock-ip-btn:active{transform:scale(0.97);}' +
      /* Hide entire wrapper once revealed */
      '.otp-price-revealed .otp-unlock-ip-wrapper{display:none!important;}' +
      '.otp-price-revealed .otp-teaser-host{display:none!important;}' +
      '.lightning-custom-cta.stat-button-link[data-otp-legacy-hidden="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;}';
    document.head.appendChild(st);
  }

  function safeParseDataVehicle(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { try { return JSON.parse(raw.replace(/&quot;/g, '"')); } catch (e2) { return null; } }
  }
  function findVehicleCardRoot(el) {
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('.result-wrap') || el.closest('[data-vehicle]') || null;
  }
  function parseVehicleFromClick(clickTarget) {
    var el = clickTarget && clickTarget.nodeType === 1 ? clickTarget : document.body;
    var root = findVehicleCardRoot(el);
    var vin = '', stock = '', price = '', vehicle = '', vehicleData = null;
    if (root) {
      var raw = root.getAttribute('data-vehicle');
      if (raw) {
        vehicleData = safeParseDataVehicle(raw);
        if (vehicleData) {
          vin = String(vehicleData.vin || '');
          stock = vehicleData.stock != null ? String(vehicleData.stock) : '';
          price = vehicleData.price != null ? String(vehicleData.price) : '';
          var parts = [vehicleData.year, vehicleData.make, vehicleData.model, vehicleData.trim].filter(Boolean);
          if (parts.length) vehicle = parts.join(' ');
        }
      }
      if (!vin) vin = root.getAttribute('data-vehicle-vin') || '';
    }
    return { vin: vin, stock: stock, price: price, vehicle: vehicle, vehicleData: vehicleData };
  }
  function imgEffectiveSrcCardFallback(img) {
    try {
      if (img.currentSrc) {
        return String(img.currentSrc).trim();
      }
    } catch (e) {}
    return (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
  }
  function findHeroImageUrl(root) {
    if (!root) return '';
    var imgs = root.querySelectorAll('img[data-testid^="vehicle-image"], .hit-image img');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgEffectiveSrcCardFallback(imgs[i]);
      if (src && src.indexOf('http') === 0) return src;
    }
    return '';
  }

  function openOtpPopupFromRoot(root) {
    try { window.__otpScrollY = window.scrollY || window.pageYOffset; } catch (e) {}
    removePopupOverlay();
    var pageUrl = window.location.href;
    var pageType = getMainPopupPageType();
    var sourceLabel = getMainPopupSourceLabel(pageType);
    var ctx = parseVehicleFromClick(root || document.body);
    try { window.__otpLastUnlockCtx = { vin: ctx.vin || '', stock: ctx.stock || '' }; } catch (e) {}

    var overlay = document.createElement('div');
    overlay.id = 'custom-price-popup';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:linear-gradient(165deg,rgba(5,33,79,0.5) 0%,rgba(15,23,42,0.55) 100%);' +
      'backdrop-filter:saturate(115%) blur(12px);-webkit-backdrop-filter:saturate(115%) blur(12px);' +
      'z-index:2147483647;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'position:relative;width:100%;max-width:1000px;height:100vh;background:transparent;overflow:hidden;';

    var iframe = document.createElement('iframe');
    iframe.src = POPUP_ORIGIN + '/?vin=' + encodeURIComponent(ctx.vin) +
      '&stock=' + encodeURIComponent(ctx.stock) +
      '&price=' + encodeURIComponent(ctx.price) +
      '&vehicle=' + encodeURIComponent(ctx.vehicle) +
      '&page_url=' + encodeURIComponent(pageUrl) +
      '&source=' + encodeURIComponent(sourceLabel) +
      '&_=' + Date.now();
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;background:transparent;overflow:hidden;';

    iframe.addEventListener('load', function () {
      try {
        var heroImg = findHeroImageUrl(root && root.nodeType === 1 ? root : document.body);
        var snap = ctx.vehicleData
          ? Object.assign({}, ctx.vehicleData, { embed_page_url: pageUrl })
          : { vin: ctx.vin, stock: ctx.stock, price: ctx.price, vehicle_heading: ctx.vehicle, embed_page_url: pageUrl };
        if (heroImg) snap = Object.assign({}, snap, { photoUrl: heroImg, imageUrl: heroImg, heroImage: heroImg });
        iframe.contentWindow.postMessage({
          type: 'OTP_EMBED_CONTEXT', pageUrl: pageUrl, source: sourceLabel,
          vin: ctx.vin, stock: ctx.stock, price: ctx.price, vehicle: ctx.vehicle, vehicleData: snap
        }, '*');
      } catch (err) {}
    });

    // Listen for close messages from iframe
    window.addEventListener('message', function(e) {
      if ((e.data && e.data.type === 'OTP_CLOSE') || e.data === 'close-popup') {
        removePopupOverlay();
      }
    });

    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) removePopupOverlay(); });
    box.appendChild(iframe);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  var __celebGuard = { key: '', t: 0 };
  function otpReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function playConfetti(wrap) {
    if (!wrap || otpReducedMotion()) return;
    var computed = window.getComputedStyle(wrap);
    var prevPos = wrap.style.position;
    if (computed.position === 'static') wrap.style.position = 'relative';
    var layer = document.createElement('div');
    layer.style.cssText = 'pointer-events:none;position:absolute;inset:0;z-index:60;overflow:visible;';
    var colors = ['#05214F', '#22c55e', '#fbbf24', '#ec4899', '#3b82f6', '#f97316'];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('div');
      p.style.cssText = 'position:absolute;width:9px;height:9px;border-radius:2px;';
      p.style.backgroundColor = colors[i % colors.length];
      p.style.left = 38 + Math.random() * 24 + '%';
      p.style.top = 32 + Math.random() * 18 + '%';
      var dx = (Math.random() - 0.5) * 220, dy = 70 + Math.random() * 110, rot = Math.random() * 720;
      if (p.animate) p.animate(
        [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
         { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0 }],
        { duration: 1500 + Math.random() * 450, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' }
      );
      layer.appendChild(p);
    }
    wrap.appendChild(layer);
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      if (computed.position === 'static') wrap.style.position = prevPos || '';
    }, 2600);
  }
  function guardedCelebrate(wrap, vin, stock) {
    var k = (vin || '') + '|' + (stock || '');
    var now = Date.now();
    if (k === __celebGuard.key && now - __celebGuard.t < 1200) return;
    __celebGuard.key = k; __celebGuard.t = now;
    requestAnimationFrame(function () { requestAnimationFrame(function () { playConfetti(wrap); }); });
  }

  function findCardWrapByVehicle(vin, stock) {
    vin = (vin || '').trim().toUpperCase();
    stock = (stock || '').trim().toUpperCase();
    var wraps = document.querySelectorAll('.result-wrap');
    for (var i = 0; i < wraps.length; i++) {
      var ctx = parseVehicleFromClick(wraps[i]);
      if (vin && (ctx.vin || '').trim().toUpperCase() === vin) return wraps[i];
      if (!vin && stock && (ctx.stock || '').trim().toUpperCase() === stock) return wraps[i];
    }
    return null;
  }

  /* ── Find the LAST .hit-additional-ctas (visible on mobile) ── */
  function findButtonInsertionPoint(wrap) {
    var allCtas = wrap.querySelectorAll('.hit-additional-ctas');
    if (allCtas.length) {
      var target = allCtas[allCtas.length - 1];
      var callBtn = target.querySelector('.lightning-custom-cta.visible-xs.visible-sm');
      return { container: target, after: callBtn || null };
    }
    return { container: wrap.querySelector('.hit-content') || wrap, after: null };
  }

  function injectUnlockButton(wrap) {
    if (!wrap) return;
    if (wrap.querySelector('.otp-unlock-ip-wrapper')) return;
    if (wrap.classList.contains('otp-price-revealed')) return;

    /* ── Teaser image (points arrow toward Unlock button below it) ── */
    var teaserHost = document.createElement('div');
    teaserHost.className = 'otp-teaser-host';
    teaserHost.setAttribute('role', 'button');
    teaserHost.setAttribute('tabindex', '0');
    teaserHost.setAttribute('aria-label', 'Want a lower price? Click to unlock.');
    teaserHost.innerHTML =
      '<img src="' + PRICE_TEASER_IMAGE_URL + '" ' +
      'alt="Want a lower price? Start here." ' +
      'loading="lazy" decoding="async" style="margin:0 auto;"/>';

    /* ── Unlock button wrapper ── */
    var wrapper = document.createElement('div');
    wrapper.className = 'otp-unlock-ip-wrapper';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'otp-unlock-ip-btn';
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">' +
      '<rect x="5" y="11" width="14" height="10" rx="2"/>' +
      '<path d="M7 11V8a5 5 0 0 1 10 0v3"/></svg>' +
      'Unlock Instant Price';

    function handleUnlock(ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (isGloballyVerified()) {
        var ctx = parseVehicleFromClick(wrap);
        var k = unlockKeyFromContext(ctx);
        if (k) addUnlockedKey(k);
        revealCard(wrap);
        return;
      }
      openOtpPopupFromRoot(wrap);
    }

    btn.addEventListener('click', handleUnlock);
    /* Teaser image also opens the popup */
    teaserHost.addEventListener('click', handleUnlock);
    teaserHost.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') handleUnlock(ev);
    });

    wrapper.appendChild(btn);

    var point = findButtonInsertionPoint(wrap);
    var container = point.container;
    var afterEl = point.after;

    /* Insert before call button if present to place it first on mobile */
    if (afterEl && afterEl.parentNode) {
      afterEl.parentNode.insertBefore(teaserHost, afterEl);
      afterEl.parentNode.insertBefore(wrapper, afterEl);
    } else {
      container.insertBefore(wrapper, container.firstChild);
      container.insertBefore(teaserHost, wrapper);
    }
  }

  function revealCard(wrap) {
    if (!wrap || wrap.classList.contains('otp-price-revealed')) return;
    wrap.classList.add('otp-price-revealed');
    revealInstantPrice(wrap);
    var ctx = parseVehicleFromClick(wrap);
    guardedCelebrate(wrap, ctx.vin, ctx.stock);
  }

  function applyCardState(wrap) {
    injectStylesOnce();
    hideLegacyCtasInCard(wrap);

    var ctx = parseVehicleFromClick(wrap);
    var ukey = unlockKeyFromContext(ctx);

    if (ukey && isKeyUnlocked(ukey)) {
      revealCard(wrap);
      return;
    }

    hideInstantPrice(wrap);
    injectUnlockButton(wrap);
  }

  function runAll() {
    injectStylesOnce();
    var cards = document.querySelectorAll('.result-wrap');
    for (var i = 0; i < cards.length; i++) applyCardState(cards[i]);
    if (!cards.length) {
      var one = document.querySelector('[data-vehicle]');
      if (one) applyCardState(one);
    }
    bindLegacyButtons();
  }

  function bindLegacyButtons() {
    var elements = document.querySelectorAll('a, button, [class*="cta"]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (el.dataset.popupBound) continue;
      if (el.classList.contains('hit-link') || el.closest('.result-title') ||
          el.closest('[data-testid="vehicle-title"]')) continue;
      if (!matchesGetTodaysPriceLabel(el.textContent || '')) continue;
      el.dataset.popupBound = 'true';
      var clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.dataset.popupBound = 'true';
      clone.addEventListener('click', function (e) {
        var root = findVehicleCardRoot(e.target);
        var k = unlockKeyFromContext(parseVehicleFromClick(root || e.target));
        if (k && isKeyUnlocked(k)) return;
        if (isGloballyVerified() && root) {
          addUnlockedKey(unlockKeyFromContext(parseVehicleFromClick(root)));
          revealCard(root);
          e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return;
        }
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        openOtpPopupFromRoot(root);
      }, true);
    }
  }

  if (!window.__otpPopupParentBound) {
    window.__otpPopupParentBound = true;

    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') removePopupOverlay(); });

    window.addEventListener('message', function (ev) {
      var originCleaned = ev.origin.replace(/\/$/, '');
      var targetCleaned = POPUP_ORIGIN.replace(/\/$/, '');
      var isTrusted = (originCleaned === targetCleaned) ||
                      (originCleaned.indexOf('localhost') !== -1) ||
                      (originCleaned.indexOf('vercel.app') !== -1) ||
                      (originCleaned === window.location.origin);
      if (!isTrusted) return;
      var d = ev.data;
      if (d === 'close-popup') { removePopupOverlay(); return; }
      if (d && typeof d === 'object') {
        if (d.type === 'OTP_VEHICLE_KEYS') {
          setGloballyVerified();
          var k1 = unlockKeyFromContext({ vin: d.vin, stock: d.stock });
          if (k1) addUnlockedKey(k1);
          removePopupOverlay();
          var w1 = findCardWrapByVehicle(d.vin, d.stock);
          if (w1) revealCard(w1);
          runAll();
          return;
        }
        if (d.type === 'OTP_SUCCESS') {
          setGloballyVerified();
          var ukey = unlockKeyFromPayload(d.payload) ||
            unlockKeyFromContext(window.__otpLastUnlockCtx);
          if (ukey) addUnlockedKey(ukey);
          removePopupOverlay();
          var pcar = d.payload && d.payload.car;
          var vinS = pcar ? String(pcar.vin || '') : '';
          var stockS = pcar ? String(pcar.stock || '') : '';
          if (!vinS && !stockS) {
            try { var lx = window.__otpLastUnlockCtx; vinS = String(lx.vin || ''); stockS = String(lx.stock || ''); } catch (e) {}
          }
          var w2 = findCardWrapByVehicle(vinS, stockS);
          if (w2) revealCard(w2);
          runAll();
          if (window.dataLayer) {
            var p = d.payload;
            window.dataLayer.push({ event: 'otp_verification_success',
              otp_user: p && p.user ? p.user : p, otp_car: p && p.car ? p.car : null });
          }
          return;
        }
        if (d.type === 'OTP_CLOSE') { removePopupOverlay(); return; }
        if (d.type === 'resize') {
          var ov = document.getElementById('custom-price-popup');
          if (ov) { var ifr = ov.querySelector('iframe'); if (ifr && typeof d.height === 'number') ifr.style.height = d.height + 'px'; }
        }
      }
    });

    window.addEventListener('storage', function (ev) {
      if (ev.key !== VINS_STORAGE_KEY && ev.key !== GLOBAL_VERIFY_KEY) return;
      runAll();
    });
  }

  var observer = new MutationObserver(function () { runAll(); });
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(runAll, 800); });
  } else {
    setTimeout(runAll, 800);
  }

  window.openOtpPriceEnquiryPopup = function (fromEl) {
    var root = fromEl && fromEl.nodeType === 1 ? findVehicleCardRoot(fromEl) : null;
    var useRoot = root || document.body;
    if (isGloballyVerified()) {
      var k = unlockKeyFromContext(parseVehicleFromClick(useRoot));
      if (k) addUnlockedKey(k);
      revealCard(useRoot);
      return;
    }
    openOtpPopupFromRoot(useRoot);
  };
})();
  (function () {
  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  var POPUP_ORIGIN         = 'https://am-ford-otp-popup.vercel.app/';
  var VINS_STORAGE_KEY     = 'otp_popup_unlocked_vins_v1';
  var GLOBAL_VERIFY_KEY    = 'otp_popup_user_verified_v1';
  var PRICE_TEASER_IMAGE_URL = 'https://www.irwinzone.com/static/dealer-5520/start_lower_price_here_green.png';

  function getVdpPopupSourceLabel(pageType) {
    if (pageType === 'VDP') {
      return 'VDP Unlock';
    }
    if (pageType === 'SRP') {
      return 'SRP Unlock';
    }
    return 'Instant Price Unlock';
  }

  function imgEffectiveSrcVdp(img) {
    try {
      if (img.currentSrc) {
        return String(img.currentSrc).trim();
      }
    } catch (e) {}
    return (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
  }

  /* ─────────────────────────────────────────────
     GUARD: only run on VDP pages
     Dealer Inspire VDPs have #price-box in the DOM.
     If it's not found, bail out immediately.
  ───────────────────────────────────────────── */
  function isVdpPage() {
    return !!(
      document.getElementById('price-box') ||
      document.querySelector('.vdp-price-box') ||
      document.querySelector('.vdp-pricebox-cta-button-1') ||
      document.querySelector('.vdp-price-box__cta') ||
      document.querySelector('#ap-modal-vin')
    );
  }
  if (!isVdpPage()) {
    /* Not a VDP — watch for late DOM injection (AJAX navigation) */
    var _vdpBootObserver = new MutationObserver(function () {
      if (isVdpPage()) {
        _vdpBootObserver.disconnect();
        setTimeout(initVdp, 400);
      }
    });
    _vdpBootObserver.observe(document.body, { childList: true, subtree: true });
    return;
  }

  /* ─────────────────────────────────────────────
     STORAGE HELPERS  (same keys → shared unlock
     state with your listing-page script)
  ───────────────────────────────────────────── */
  function getUnlockedKeys() {
    try { 
      var r = localStorage.getItem(VINS_STORAGE_KEY); 
      if (!r) return [];
      var data = JSON.parse(r);
      if (Array.isArray(data)) {
        localStorage.removeItem(VINS_STORAGE_KEY);
        return [];
      } else if (data && data.vins) {
        if (Date.now() > data.expiry) {
          localStorage.removeItem(VINS_STORAGE_KEY);
          return [];
        }
        return data.vins;
      }
      return [];
    } catch (e) { return []; }
  }
  function isKeyUnlocked(k)  { return k && getUnlockedKeys().indexOf(k) >= 0; }
  function addUnlockedKey(k) {
    if (!k) return;
    try {
      var a = getUnlockedKeys();
      if (a.indexOf(k) < 0) { 
        a.push(k); 
        var expiry = Date.now() + (3 * 24 * 60 * 60 * 1000);
        localStorage.setItem(VINS_STORAGE_KEY, JSON.stringify({ vins: a, expiry: expiry })); 
      }
    } catch (e) {}
  }
  function isGloballyVerified() {
    if (window.__otpGloballyVerified) return true;
    try { 
      var val = localStorage.getItem(GLOBAL_VERIFY_KEY);
      if (!val) return false;
      if (val === '1') {
        localStorage.removeItem(GLOBAL_VERIFY_KEY);
        return false;
      }
      if (Date.now() > parseInt(val, 10)) {
        localStorage.removeItem(GLOBAL_VERIFY_KEY);
        return false;
      }
      return true;
    } catch (e) { return false; }
  }
  function setGloballyVerified() {
    try {
      window.__otpGloballyVerified = true;
      var expiry = Date.now() + (3 * 24 * 60 * 60 * 1000);
      localStorage.setItem(GLOBAL_VERIFY_KEY, expiry.toString());
    } catch (e) {}
  }

  /* ─────────────────────────────────────────────
     VIN / STOCK  — read from DOM
  ───────────────────────────────────────────── */
  function getVdpContext() {
    /* 1. Hidden input injected by the advanced-pricing modal */
    var vinInput = document.getElementById('ap-modal-vin');
    var vin = '', stock = '';
    if (vinInput && vinInput.value) vin = vinInput.value.trim().toUpperCase();

    if (!vin) {
      var vinNode = document.querySelector('#vin[data-testid="vin-number"], span[data-testid="vin-number"]');
      if (vinNode) vin = (vinNode.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    }

    var stockNode = document.querySelector('#stock[data-testid="stock-number"], span[data-testid="stock-number"]');
    if (stockNode) stock = (stockNode.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();

    /* 2. <span class="vin"> inside the modal */
    var vinSpan = document.querySelector('.di-advanced-pricing-modal .vin');
    if (!vin && vinSpan) {
      var m = vinSpan.textContent.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
      if (m) vin = m[1].toUpperCase();
    }

    if (!stock) {
      var stockWrap = document.querySelector('.vdp-title__vin-stock, .stock');
      if (stockWrap) {
        var stockText = (stockWrap.textContent || '').match(/Stock[:\s]+([A-Z0-9-]+)/i);
        if (stockText) stock = stockText[1].toUpperCase();
      }
    }

    /* 3. URL – many DI VDPs embed the VIN in the slug */
    if (!vin) {
      var urlMatch = window.location.pathname.match(/([A-HJ-NPR-Z0-9]{17})/i);
      if (urlMatch) vin = urlMatch[1].toUpperCase();
    }

    return { vin: vin, stock: stock };
  }

  function getVdpVehicleHeading() {
    var titleNode = document.querySelector('h1[data-testid="vehicle-title"]');
    if (titleNode) return (titleNode.textContent || '').replace(/\s+/g, ' ').trim();
    var modalHeading = document.querySelector('.di-advanced-pricing-modal h2');
    if (modalHeading) return (modalHeading.textContent || '').replace(/\s+/g, ' ').trim();
    return (document.title || '').replace(/\s+/g, ' ').trim();
  }

  function splitVdpHeading(heading) {
    var text = (heading || '').replace(/\s+/g, ' ').trim();
    var out = { year: '', make: '', model: '', trim: '' };
    var m = text.match(/(?:Certified Pre-Owned\s+)?(\d{4})\s+([A-Za-z]+)\s+(.+)/i);
    if (!m) return out;
    out.year = m[1] || '';
    out.make = m[2] || '';
    var tail = (m[3] || '').trim();
    if (!tail) return out;
    var parts = tail.split(' ');
    if (parts.length > 1) {
      out.trim = parts[parts.length - 1];
      out.model = parts.slice(0, -1).join(' ');
    } else {
      out.model = tail;
    }
    return out;
  }

  function getVdpPriceValue() {
    var ipBlock = findInstantPriceBlock();
    if (ipBlock) {
      var priceEl = ipBlock.querySelector('.price');
      if (priceEl) {
        var ipPrice = (priceEl.textContent || '').replace(/[^0-9.]/g, '');
        if (ipPrice) return ipPrice;
      }
    }

    var priceNodes = document.querySelectorAll('.vdp-title__price, .info__price, .price, [data-testid="vehicle-price"], [data-testid="msrp"], .payment-block .price');
    for (var i = 0; i < priceNodes.length; i++) {
      var value = (priceNodes[i].textContent || '').replace(/[^0-9.]/g, '');
      if (value) return value;
    }
    return '';
  }

  function getVdpHeroImage() {
    var imgEl = document.querySelector('img[data-testid^="vehicle-image"], .vdp-gallery__preview img, .vehicle-images img, .hero-image img');
    if (!imgEl) return '';
    return imgEffectiveSrcVdp(imgEl);
  }

  function unlockKey(ctx) {
    var v = (ctx.vin || '').trim().toUpperCase();   if (v) return 'V:' + v;
    var s = (ctx.stock || '').trim().toUpperCase(); if (s) return 'S:' + s;
    return '';
  }

  /* ─────────────────────────────────────────────
     PRICE-BOX DOM HELPERS
  ───────────────────────────────────────────── */
  function getPriceBox() {
    return document.getElementById('price-box') || document.querySelector('.vdp-price-box');
  }

  /* Find the "Instant Price" .price-block row */
  function findInstantPriceBlock() {
    var blocks = document.querySelectorAll('.price-block');
    for (var i = 0; i < blocks.length; i++) {
      var lbl = blocks[i].querySelector('.price-label');
      if (lbl && lbl.textContent.toLowerCase().indexOf('instant price') !== -1) return blocks[i];
    }
    return null;
  }

  function hideInstantPrice() {
    var b = findInstantPriceBlock();
    if (!b || b.getAttribute('data-otp-hidden')) return;
    b.setAttribute('data-otp-hidden', '1');
    b.style.setProperty('display', 'none', 'important');
  }

  function revealInstantPrice() {
    var b = findInstantPriceBlock();
    if (!b) return;
    b.removeAttribute('data-otp-hidden');
    b.style.removeProperty('display');
    b.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    b.style.opacity    = '0';
    b.style.transform  = 'translateY(6px)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        b.style.opacity   = '1';
        b.style.transform = 'translateY(0)';
      });
    });
  }

  /* ─────────────────────────────────────────────
     "GET TODAY'S PRICE" BUTTON — hide it on VDP
     It sits inside .vdp-price-box__cta as
     .vdp-pricebox-cta-button-1
  ───────────────────────────────────────────── */
  function hideGetTodaysPriceBtn() {
    var btns = document.querySelectorAll('.vdp-pricebox-cta-button-1, [data-testid="vehicle-cta-1"]');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (!btn.getAttribute('data-otp-hidden')) {
        btn.setAttribute('data-otp-hidden', '1');
        btn.style.setProperty('display', 'none', 'important');
      }
    }
  }

  /* ─────────────────────────────────────────────
     INJECT CSS FOR VDP WRAPPER
  ───────────────────────────────────────────── */
  function injectVdpStyles() {
    if (document.getElementById('otp-vdp-styles')) return;
    var style = document.createElement('style');
    style.id = 'otp-vdp-styles';
    style.textContent =
      '.vdp-price-box__main-cta-wrapper { padding-bottom: 0 !important; }' +
      '.otp-vdp-teaser-host { width: 100%; box-sizing: border-box; cursor: pointer; margin-bottom: 0; display: flex; justify-content: center; }' +
      '.otp-vdp-teaser-host img { display: block; width: 100%; max-width: 100%; height: auto; object-fit: contain; }' +
      '@media (max-width: 767px) { .otp-vdp-teaser-host img { width: 80%; max-width: 80%; } }';
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────
     POPUP OVERLAY  (same iframe as listing page)
  ───────────────────────────────────────────── */
  function openOtpPopup() {
    try { window.__otpScrollY = window.scrollY || window.pageYOffset; } catch (e) {}
    removePopupOverlay();
    var ctx    = getVdpContext();
    var price  = getVdpPriceValue();
    var vehicle = getVdpVehicleHeading();
    var parsedVehicle = splitVdpHeading(vehicle);
    var sourceLabel = getVdpPopupSourceLabel('VDP');
    try { window.__otpLastUnlockCtx = { vin: ctx.vin, stock: ctx.stock }; } catch (e) {}

    var overlay = document.createElement('div');
    overlay.id = 'otp-vdp-popup';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(5,33,79,0.55);backdrop-filter:blur(10px);' +
      '-webkit-backdrop-filter:blur(10px);z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'position:relative;width:100%;max-width:1000px;height:100vh;background:transparent;overflow:hidden;';

    /* Hero image for the popup */
    var heroImg = getVdpHeroImage();

    var iframe = document.createElement('iframe');
    iframe.src = POPUP_ORIGIN +
      '/?vin='       + encodeURIComponent(ctx.vin) +
      '&stock='      + encodeURIComponent(ctx.stock) +
      '&price='      + encodeURIComponent(price) +
      '&vehicle='    + encodeURIComponent(vehicle) +
      '&page_url='   + encodeURIComponent(window.location.href) +
      '&source='     + encodeURIComponent(sourceLabel) +
      '&_='          + Date.now();
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;background:transparent;';

    iframe.addEventListener('load', function () {
      try {
        iframe.contentWindow.postMessage({
          type:        'OTP_EMBED_CONTEXT',
          source:      sourceLabel,
          pageUrl:     window.location.href,
          vin:         ctx.vin,
          stock:       ctx.stock,
          price:       price,
          vehicle:     vehicle,
          vehicleData: { vin: ctx.vin, stock: ctx.stock, price: price,
                         year: parsedVehicle.year, make: parsedVehicle.make,
                         model: parsedVehicle.model, trim: parsedVehicle.trim,
                         vehicle_heading: vehicle, listing_title: vehicle,
                         embed_page_url: window.location.href,
                         photoUrl: heroImg, imageUrl: heroImg, heroImage: heroImg }
        }, '*');
      } catch (err) {}
    });

    // Listen for close messages from iframe
    window.addEventListener('message', function(e) {
      if ((e.data && e.data.type === 'OTP_CLOSE') || e.data === 'close-popup') {
        removePopupOverlay();
      }
    });

    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) removePopupOverlay(); });
    box.appendChild(iframe);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  /* ─────────────────────────────────────────────
     INJECT "UNLOCK INSTANT PRICE" BUTTON
     Inserted in place of the hidden "Get Today's
     Price" button, inside .vdp-price-box__cta
  ───────────────────────────────────────────── */
  function injectUnlockButton() {
    var ctaContainers = [];
    var query1 = document.querySelectorAll('.vdp-price-box__cta');
    var query2 = document.querySelectorAll('.vdp-pricebox-cta-wrapper');
    for (var i = 0; i < query1.length; i++) ctaContainers.push(query1[i]);
    for (var i = 0; i < query2.length; i++) {
      if (ctaContainers.indexOf(query2[i]) === -1) ctaContainers.push(query2[i]);
    }
    var query3 = document.querySelectorAll('.vdp-pricebox-cta-button-1');
    for (var i = 0; i < query3.length; i++) {
      var p = query3[i].parentNode;
      if (p && ctaContainers.indexOf(p) === -1) ctaContainers.push(p);
    }

    /* Remove outer parent containers if a more specific child/nested container is also in the list */
    var filtered = [];
    for (var i = 0; i < ctaContainers.length; i++) {
      var isAncestor = false;
      for (var j = 0; j < ctaContainers.length; j++) {
        if (i !== j && ctaContainers[i].contains(ctaContainers[j])) {
          isAncestor = true;
          break;
        }
      }
      if (!isAncestor) {
        filtered.push(ctaContainers[i]);
      }
    }
    ctaContainers = filtered;

    var uninjected = [];
    for (var i = 0; i < ctaContainers.length; i++) {
      if (!ctaContainers[i].getAttribute('data-otp-injected')) {
        uninjected.push(ctaContainers[i]);
      }
    }
    if (uninjected.length === 0) return;

    /* Inject keyframes and styles once */
    if (!document.getElementById('otp-vdp-styles')) {
      var st = document.createElement('style');
      st.id = 'otp-vdp-styles';
      st.textContent =
        '@keyframes otpVdpPulse{0%{transform:scale(1);}50%{transform:scale(1.02);}100%{transform:scale(1);}}' +
        '.otp-vdp-unlock-btn-class:hover{filter:brightness(1.08);}' +
        '.otp-vdp-unlock-btn-class:active{transform:scale(0.97);}' +
        /* shimmer sweep / flash effect (matched with listing page specs) */
        '.otp-vdp-unlock-btn-class::before{content:"";position:absolute;top:0;left:-100%;width:60%;height:100%;' +
        'background:linear-gradient(120deg,transparent,rgba(255,255,255,0.3),transparent);' +
        'filter:blur(8px);animation:otpVdpSweep 3.5s ease-in-out infinite;}' +
        '@keyframes otpVdpSweep{0%{left:-100%;}50%{left:120%;}100%{left:120%;}}' +
        /* teaser styles */
        '.otp-vdp-teaser-host{width:100%;box-sizing:border-box;cursor:pointer;margin-bottom:0;}' +
        '.otp-vdp-teaser-host img{display:block;width:100%;max-width:100%;height:auto;object-fit:contain;}';
      document.head.appendChild(st);
    }

    var handleUnlock = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var ctx = getVdpContext();
      var k   = unlockKey(ctx);
      if (isGloballyVerified()) {
        if (k) addUnlockedKey(k);
        revealPriceOnVdp();
        return;
      }
      openOtpPopup();
    };

    for (var idx = 0; idx < uninjected.length; idx++) {
      var cta = uninjected[idx];
      cta.setAttribute('data-otp-injected', '1');

      /* ── Teaser image (points arrow toward Unlock button below it) ── */
      var teaserHost = document.createElement('div');
      teaserHost.className = 'otp-vdp-teaser-host otp-teaser-host otp-vdp-teaser-host-instance';
      teaserHost.setAttribute('role', 'button');
      teaserHost.setAttribute('tabindex', '0');
      teaserHost.setAttribute('aria-label', 'Want a lower price? Click to unlock.');
      teaserHost.innerHTML =
        '<img src="' + PRICE_TEASER_IMAGE_URL + '" ' +
        'alt="Want a lower price? Start here." ' +
        'loading="lazy" decoding="async" style="margin:0 auto;"/>';

      /* Wrapper — matches the same width/layout as the native CTA buttons */
      var wrapper = document.createElement('div');
      wrapper.className = 'vdp-price-box__main-cta-wrapper otp-vdp-unlock-wrapper-instance';
      wrapper.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px;';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'otp-vdp-unlock-btn-class';
      btn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" style="fill:none !important;">' +
        '<rect x="5" y="11" width="14" height="10" rx="2" style="fill:none !important; stroke:currentColor !important; stroke-width:2.2 !important;"/>' +
        '<path d="M7 11V8a5 5 0 0 1 10 0v3" style="fill:none !important; stroke:currentColor !important; stroke-width:2.2 !important;"/></svg>' +
        'Unlock Instant Price';

      btn.style.cssText =
        'display:flex;align-items:center;justify-content:center;gap:10px;' +
        'width:100%;box-sizing:border-box;' +
        'padding:14px 20px;' +
        'background:#05214F;color:#fff;' +
        'border:none;border-radius:0;cursor:pointer;' +
        'font-weight:600;font-size:15px;font-family:inherit;' +
        'letter-spacing:0.01em;text-transform:uppercase;' +
        'position:relative;overflow:hidden;' +
        'animation:otpVdpPulse 2.8s ease-in-out infinite;';

      btn.addEventListener('click', handleUnlock);
      teaserHost.addEventListener('click', handleUnlock);
      teaserHost.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') handleUnlock(ev);
      });

      wrapper.appendChild(btn);

      /* Find any click-to-call button on mobile VDP to insert before it (only on mobile viewports) */
      var isMobile = window.innerWidth < 768;
      var callBtn = null;
      if (isMobile) {
        callBtn = cta.querySelector('a[href^="tel:"], button[class*="call"], a[class*="call"], .visible-xs.visible-sm');
      }

      if (callBtn && callBtn.parentNode) {
        callBtn.parentNode.insertBefore(teaserHost, callBtn);
        callBtn.parentNode.insertBefore(wrapper, callBtn);
      } else {
        /* Fallback: insert before standard secondary VDP CTA */
        var ctaBtn1 = cta.querySelector('[data-testid="vehicle-cta-2"]');
        if (ctaBtn1 && ctaBtn1.parentNode) {
          ctaBtn1.parentNode.insertBefore(teaserHost, ctaBtn1);
          ctaBtn1.parentNode.insertBefore(wrapper, ctaBtn1);
        } else {
          cta.insertBefore(wrapper, cta.firstChild);
          cta.insertBefore(teaserHost, wrapper);
        }
      }
    }
  }

  /* ─────────────────────────────────────────────
     REVEAL  — show instant price, hide unlock btn
  ───────────────────────────────────────────── */
  function revealPriceOnVdp() {
    revealInstantPrice();

    /* Remove all injected unlock button wrappers and teaser images */
    var wrappers = document.querySelectorAll('.otp-vdp-unlock-wrapper-instance');
    for (var i = 0; i < wrappers.length; i++) {
      if (wrappers[i].parentNode) wrappers[i].parentNode.removeChild(wrappers[i]);
    }
    var teasers = document.querySelectorAll('.otp-vdp-teaser-host-instance');
    for (var i = 0; i < teasers.length; i++) {
      if (teasers[i].parentNode) teasers[i].parentNode.removeChild(teasers[i]);
    }



    /* Confetti */
    var pb = getPriceBox();
    if (pb) playConfetti(pb);
  }

  /* ─────────────────────────────────────────────
     CONFETTI  (same micro-animation as listing)
  ───────────────────────────────────────────── */
  function playConfetti(wrap) {
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
    var layer  = document.createElement('div');
    layer.style.cssText = 'pointer-events:none;position:absolute;inset:0;z-index:60;overflow:visible;';
    var colors = ['#05214F', '#22c55e', '#fbbf24', '#ec4899', '#3b82f6', '#f97316'];
    var prevPos = wrap.style.position;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('div');
      p.style.cssText = 'position:absolute;width:9px;height:9px;border-radius:2px;';
      p.style.backgroundColor = colors[i % colors.length];
      p.style.left = 38 + Math.random() * 24 + '%';
      p.style.top  = 32 + Math.random() * 18 + '%';
      var dx = (Math.random() - 0.5) * 220, dy = 70 + Math.random() * 110, rot = Math.random() * 720;
      if (p.animate) p.animate(
        [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
         { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0 }],
        { duration: 1500 + Math.random() * 450, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' }
      );
      layer.appendChild(p);
    }
    wrap.appendChild(layer);
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      wrap.style.position = prevPos || '';
    }, 2600);
  }

  /* ─────────────────────────────────────────────
     MAIN INIT
  ───────────────────────────────────────────── */
  function initVdp() {
    if (!isVdpPage()) return;
    var ctx = getVdpContext();
    var k   = unlockKey(ctx);

    if (isGloballyVerified() || (k && isKeyUnlocked(k))) {
      /* Already verified on listing page or previously — just reveal and clean up wrappers/teasers */
      revealPriceOnVdp();
      hideGetTodaysPriceBtn();
      return;
    }

    hideInstantPrice();
    hideGetTodaysPriceBtn();
    injectVdpStyles();
    injectUnlockButton();
  }

  /* ─────────────────────────────────────────────
     MESSAGE LISTENER  (popup → parent)
  ───────────────────────────────────────────── */
  if (!window.__otpVdpMsgBound) {
    window.__otpVdpMsgBound = true;

    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') removePopupOverlay(); });

    window.addEventListener('message', function (ev) {
      var originCleaned = ev.origin.replace(/\/$/, '');
      var targetCleaned = POPUP_ORIGIN.replace(/\/$/, '');
      var isTrusted = (originCleaned === targetCleaned) ||
                      (originCleaned.indexOf('localhost') !== -1) ||
                      (originCleaned.indexOf('vercel.app') !== -1) ||
                      (originCleaned === window.location.origin);
      if (!isTrusted) return;
      var d = ev.data;
      if (d === 'close-popup') { removePopupOverlay(); return; }
      if (!d || typeof d !== 'object') return;

      if (d.type === 'OTP_VEHICLE_KEYS' || d.type === 'OTP_SUCCESS') {
        setGloballyVerified();
        var vin = '', stock = '';
        if (d.type === 'OTP_VEHICLE_KEYS') {
          vin   = d.vin   || '';
          stock = d.stock || '';
        } else {
          var pcar = d.payload && d.payload.car;
          vin   = pcar ? String(pcar.vin   || '') : '';
          stock = pcar ? String(pcar.stock || '') : '';
        }
        var k2 = unlockKey({ vin: vin, stock: stock }) ||
                 unlockKey(getVdpContext()) ||
                 (function () {
                   try { var lx = window.__otpLastUnlockCtx; return unlockKey(lx); } catch (e) { return ''; }
                 })();
        if (k2) addUnlockedKey(k2);
        removePopupOverlay();
        revealPriceOnVdp();

        if (window.dataLayer && d.type === 'OTP_SUCCESS') {
          window.dataLayer.push({ event: 'otp_verification_success',
            otp_user: d.payload && d.payload.user ? d.payload.user : d.payload,
            otp_car:  d.payload && d.payload.car  ? d.payload.car  : null });
        }
        return;
      }
      if (d.type === 'OTP_CLOSE') { removePopupOverlay(); return; }
      if (d.type === 'resize') {
        var ov = document.getElementById('otp-vdp-popup');
        if (ov) { var ifr = ov.querySelector('iframe'); if (ifr && typeof d.height === 'number') ifr.style.height = d.height + 'px'; }
      }
    });

    window.addEventListener('storage', function (ev) {
      if (ev.key !== VINS_STORAGE_KEY && ev.key !== GLOBAL_VERIFY_KEY) return;
      initVdp();
    });
  }

  /* ─────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initVdp, 600); });
  } else {
    setTimeout(initVdp, 600);
  }

  /* Re-run if DI loads price box late (AJAX) */
  var _vdpLateObserver = new MutationObserver(function () {
    if (!isVdpPage()) return;
    var ctx = getVdpContext();
    var k   = unlockKey(ctx);

    if (isGloballyVerified() || (k && isKeyUnlocked(k))) {
      // If the vehicle is verified, clean up any stray/late injected unlock elements instantly
      if (document.querySelector('.otp-vdp-unlock-btn-class') || 
          document.querySelector('.otp-vdp-teaser-host-instance')) {
        revealPriceOnVdp();
      }
      hideGetTodaysPriceBtn();
      return;
    }

    // If NOT unlocked, and the button hasn't been injected yet, trigger initialization
    if (!document.querySelector('.otp-vdp-unlock-btn-class')) {
      initVdp();
    }
  });
  _vdpLateObserver.observe(document.body, { childList: true, subtree: true });

})();
