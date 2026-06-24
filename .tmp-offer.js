(function () {
  var POPUP_ORIGIN = 'https://am-ford-otp-popup.vercel.app';
  var ENQUIRY_KEYS = ["offer_dismissed_until","otp_verified_user","otp_enquiry_start"];

  function clearOldEnquiry() {
    // Force-clean any old leftover keys on every page load.
    // This migrates users with stale 3-day lockout from the previous
    // system so they can make a fresh enquiry.
    ENQUIRY_KEYS.forEach(function(k){
      try { localStorage.removeItem(k); } catch(_){}
      try { sessionStorage.removeItem(k); } catch(_){}
    });
  }

  function clearEnquiryCookies() {
    var rx = /^(otp_|offer_)/;
    document.cookie.split(";").forEach(function(c) {
      var name = c.split("=")[0].trim();
      if (rx.test(name)) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
    });
  }

  clearOldEnquiry();
  clearEnquiryCookies();

  function isDismissed() {
    return false;
  }

  function removeOfferOverlay() {
    var overlay = document.getElementById('custom-offer-popup');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.body.style.overflow = '';
  }

  function getPageType() {
    var path = (window.location.pathname || '').toLowerCase();
    var isHomePath = path === '/' || path === '' || path === '/index.php' || path === '/index.html';
    var endsWithHomeSlash = path.slice(-6) === '/home/';
    var endsWithHome = path.slice(-5) === '/home';
    if (isHomePath || endsWithHomeSlash || endsWithHome) {
      return 'Home';
    }
    if (path.indexOf('/used-vehicles') !== -1 || path.indexOf('/new-vehicles') !== -1) {
      return 'SRP';
    }
    if (path.indexOf('/inventory/') !== -1) {
      return 'VDP';
    }
    return 'Other';
  }

  function imgEffectiveSrc(img) {
    try {
      if (img.currentSrc) {
        return String(img.currentSrc).trim();
      }
    } catch (e) {}
    return (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
  }

  function extractNumberText(value) {
    var text = value || '';
    var out = '';
    var i = 0;
    for (i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        out += ch;
      }
    }
    return out;
  }

  function findAncestorByClass(node, className) {
    var current = node;
    while (current && current !== document.body) {
      var cls = ' ' + (current.className || '') + ' ';
      if (cls.indexOf(' ' + className + ' ') !== -1) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function extractVinFromText(text) {
    var source = String(text || '').toUpperCase();
    var allowed = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    var current = '';
    var i = 0;
    for (i = 0; i < source.length; i++) {
      var ch = source.charAt(i);
      if (allowed.indexOf(ch) !== -1) {
        current += ch;
        if (current.length === 17) {
          return current;
        }
      } else {
        current = '';
      }
    }
    return '';
  }

  function extractStockFromText(text) {
    var source = String(text || '').toUpperCase();
    var stockIndex = source.indexOf('STOCK');
    var start = stockIndex >= 0 ? stockIndex + 5 : 0;
    var out = '';
    var i = 0;
    for (i = start; i < source.length; i++) {
      var ch = source.charAt(i);
      if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-') {
        out += ch;
      } else if (out) {
        break;
      }
    }
    return out;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function getMetaContent(selector) {
    var node = document.querySelector(selector);
    if (!node) return '';
    return normalizeText(node.getAttribute('content') || '');
  }

  function getVdpActionNode() {
    return document.querySelector('.vdp-heart[data-vin], .my-profile-save-item[data-vin], [data-vin][data-title], [data-retail-vin][data-title]');
  }

  function getVdpFallbackVin() {
    var actionNode = getVdpActionNode();
    if (actionNode) {
      var actionVin = actionNode.getAttribute('data-vin') || actionNode.getAttribute('data-retail-vin') || '';
      actionVin = normalizeText(actionVin).toUpperCase();
      if (actionVin) return actionVin;
    }

    var imgs = document.querySelectorAll('img[src], img[data-src]');
    var i = 0;
    for (i = 0; i < imgs.length; i++) {
      var src = imgEffectiveSrc(imgs[i]);
      if (src) {
        var imageVin = extractVinFromText(src);
        if (imageVin) return imageVin;
      }
    }
    return '';
  }

  function getVdpFallbackStock() {
    var stockNode = document.querySelector('.vdp-title__vin-stock .stock, #shareModal .stock, .vehicle-info .stock');
    if (stockNode) {
      var stock = extractStockFromText(stockNode.textContent || '');
      if (stock) return stock;
    }
    return '';
  }

  function getVdpFallbackHeading() {
    var titleNode = document.querySelector('h1[data-testid="vehicle-title"], .vdp-title__vehicle-info h1, .vdp-title h1');
    if (titleNode) {
      var titleText = normalizeText(titleNode.textContent || '');
      if (titleText) return titleText;
    }

    var actionNode = getVdpActionNode();
    if (actionNode) {
      var attrTitle = normalizeText(actionNode.getAttribute('data-title') || '');
      if (attrTitle) return attrTitle;
    }

    var ogTitle = getMetaContent('meta[property="og:title"]');
    if (ogTitle) return ogTitle;

    var twitterTitle = getMetaContent('meta[name="twitter:title"]');
    if (twitterTitle) return twitterTitle;

    return normalizeText(document.title || '');
  }

  function getVdpFallbackPrice() {
    var actionNode = getVdpActionNode();
    if (actionNode) {
      var amount = extractNumberText(actionNode.getAttribute('data-amount') || '');
      if (amount) return amount;
    }
    return '';
  }

  function getVdpFallbackHeroImage() {
    var actionNode = getVdpActionNode();
    if (actionNode) {
      var thumb = normalizeText(actionNode.getAttribute('data-thumbnail') || '');
      if (thumb) return thumb;
    }

    var ogImage = getMetaContent('meta[property="og:image"]');
    if (ogImage) return ogImage;

    var twitterImage = getMetaContent('meta[name="twitter:image"]');
    if (twitterImage) return twitterImage;

    return '';
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
    var ipLabel = document.querySelector('.price-block .price-label');
    if (ipLabel) {
      var ipBlock = findAncestorByClass(ipLabel, 'price-block');
      if (ipBlock) {
        var ipPriceEl = ipBlock.querySelector('.price');
        if (ipPriceEl) {
          var ipPrice = extractNumberText(ipPriceEl.textContent || '');
          if (ipPrice) return ipPrice;
        }
      }
    }

    var priceNodes = document.querySelectorAll('.vdp-title__price, .info__price, .price, [data-testid="vehicle-price"], [data-testid="msrp"], .payment-block .price');
    for (var i = 0; i < priceNodes.length; i++) {
      var value = extractNumberText(priceNodes[i].textContent || '');
      if (value) return value;
    }
    return getVdpFallbackPrice();
  }

  function getVdpVehicleHeading() {
    var modalHeading = document.querySelector('.di-advanced-pricing-modal h2');
    if (modalHeading) {
      var modalText = normalizeText(modalHeading.textContent || '');
      if (modalText) return modalText;
    }
    return getVdpFallbackHeading();
  }

  function getVdpHeroImage() {
    var imgEl = document.querySelector('img[data-testid^="vehicle-image"], .vdp-gallery__preview img, .vehicle-images img, .hero-image img');
    if (imgEl) {
      var imgSrc = imgEffectiveSrc(imgEl);
      if (imgSrc) return imgSrc;
    }
    return getVdpFallbackHeroImage();
  }

  function getVdpVehicleData() {
    var vin = '', stock = '', price = '', vehicle = '', heroImg = '';

    var vinInput = document.getElementById('ap-modal-vin');
    if (vinInput && vinInput.value) vin = vinInput.value.trim().toUpperCase();

    if (!vin) {
      var vinNode = document.querySelector('#vin[data-testid="vin-number"], span[data-testid="vin-number"]');
      if (vinNode) vin = (vinNode.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    }

    if (!vin) {
      vin = getVdpFallbackVin();
    }

    var stockNode = document.querySelector('#stock[data-testid="stock-number"], span[data-testid="stock-number"]');
    if (stockNode) stock = (stockNode.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();

    if (!stock) {
      stock = getVdpFallbackStock();
    }

    if (!vin) {
      var vinSpan = document.querySelector('.di-advanced-pricing-modal .vin');
      if (vinSpan) {
        vin = extractVinFromText(vinSpan.textContent || '');
      }
    }

    if (!stock) {
      var stockWrap = document.querySelector('.vdp-title__vin-stock, .stock');
      if (stockWrap) {
        stock = extractStockFromText(stockWrap.textContent || '');
      }
    }

    if (!vin) {
      var urlMatch = window.location.pathname.match(/([A-HJ-NPR-Z0-9]{17})/i);
      if (urlMatch) vin = urlMatch[1].toUpperCase();
    }

    price = getVdpPriceValue();

    vehicle = getVdpVehicleHeading();
    var parsedVehicle = splitVdpHeading(vehicle);

    heroImg = getVdpHeroImage();

    var vehicleData = {
      vin: vin, stock: stock, price: price,
      year: parsedVehicle.year, make: parsedVehicle.make,
      model: parsedVehicle.model, trim: parsedVehicle.trim,
      vehicle_heading: vehicle, listing_title: vehicle, embed_page_url: window.location.href,
      photoUrl: heroImg, imageUrl: heroImg, heroImage: heroImg
    };

    return { vin: vin, stock: stock, price: price, vehicle: vehicle, vehicleData: vehicleData };
  }

  function postOfferIframeContext(iframe, pageUrl, pageType) {
    if (!iframe || !iframe.contentWindow) return;
    var latestData = getVdpVehicleData();
    try {
      iframe.contentWindow.postMessage({
        type: 'OTP_EMBED_CONTEXT',
        pageUrl: pageUrl,
        page_type: pageType,
        vin: latestData.vin,
        stock: latestData.stock,
        price: latestData.price,
        vehicle: latestData.vehicle,
        vehicleData: latestData.vehicleData
      }, '*');
    } catch (err) {}
  }

  function showOfferPopup() {
    if (isDismissed()) return;
    removeOfferOverlay();

    var pageUrl = window.location.href;
    var cacheBust = new Date().getTime();
    var pageType = getPageType();

    var vdpData = null;
    if (pageType === 'VDP') {
      vdpData = getVdpVehicleData();
    }

    var params =
      '?source=gtm-timed-offer' +
      '&page_type=' + encodeURIComponent(pageType) +
      '&page_url=' + encodeURIComponent(pageUrl) +
      '&apiBase=' + encodeURIComponent(POPUP_ORIGIN) +
      '&_=' + cacheBust;

    if (vdpData) {
      params += '&vin=' + encodeURIComponent(vdpData.vin) +
                '&stock=' + encodeURIComponent(vdpData.stock) +
                '&price=' + encodeURIComponent(vdpData.price) +
                '&vehicle=' + encodeURIComponent(vdpData.vehicle);
    }

    var overlay = document.createElement('div');
    overlay.id = 'custom-offer-popup';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:linear-gradient(165deg,rgba(5,33,79,0.5) 0%,rgba(15,23,42,0.55) 100%);' +
      'backdrop-filter:saturate(115%) blur(12px);' +
      '-webkit-backdrop-filter:saturate(115%) blur(12px);' +
      'z-index:2147483647;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText =
      'position:relative;width:100%;max-width:1000px;height:100vh;' +
      'background:transparent;overflow:hidden;';

    var iframe = document.createElement('iframe');
    iframe.src = POPUP_ORIGIN + '/offer' + params;
    iframe.setAttribute('allow', 'same-origin');
    iframe.style.cssText =
      'width:100%;height:100%;border:none;display:block;background:transparent;overflow:hidden;';

    // Send vehicle context to iframe after it loads
    if (vdpData) {
      iframe.addEventListener('load', function () {
        postOfferIframeContext(iframe, pageUrl, pageType);
        setTimeout(function () { postOfferIframeContext(iframe, pageUrl, pageType); }, 250);
        setTimeout(function () { postOfferIframeContext(iframe, pageUrl, pageType); }, 800);
        setTimeout(function () { postOfferIframeContext(iframe, pageUrl, pageType); }, 1600);
      });
    }

    // Click backdrop to close
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) {
        removeOfferOverlay();
      }
    });

    // Escape key to close
    var escHandler = function (ev) {
      if (ev.key === 'Escape') {
        removeOfferOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    window.addEventListener('message', function (e) {
      var originCleaned = e.origin.replace(/\/$/, '');
      var targetCleaned = POPUP_ORIGIN.replace(/\/$/, '');
      if (originCleaned !== targetCleaned) return;
      if ((e.data && e.data.type === 'OFFER_CLOSE') || e.data === 'close-offer' ||
          (e.data && e.data.type === 'OFFER_SUBMITTED')) {
        removeOfferOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    });

    box.appendChild(iframe);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function initTimedOffer() {
    var pageType = getPageType();
    if (pageType === 'Other') return;

    var delaySeconds = pageType === 'VDP' ? 4 : pageType === 'SRP' ? 6 : 5;
    setTimeout(showOfferPopup, delaySeconds * 1000);
  }

  window.OfferPopup = { open: showOfferPopup, close: removeOfferOverlay };

  if (document.readyState === 'complete') {
    initTimedOffer();
  } else {
    window.addEventListener('load', initTimedOffer);
  }
})();
