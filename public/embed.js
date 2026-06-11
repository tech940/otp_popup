/**
 * OTP Verification Popup — Embed Script
 * ──────────────────────────────────────
 * Usage:
 *   <script
 *     src="https://YOUR-DOMAIN.com/embed.js"
 *     data-trigger="#verify-btn"
 *     data-on-success="myCallbackFn"
 *   ></script>
 *
 * Attributes:
 *   data-trigger      CSS selector for the button that opens the popup
 *   data-on-success   Name of a global function to call on successful verification
 */
(function () {
  var ENQUIRY_KEYS = ["otp_enquiry_start","offer_dismissed_until","otp_verified_user"];

  function clearOldEnquiry() {
    var oneDay = 24 * 60 * 60 * 1000;
    var start = parseInt(localStorage.getItem("otp_enquiry_start") || "0", 10);
    if (!start || Date.now() - start > oneDay) {
      ENQUIRY_KEYS.forEach(function(k){
        try { localStorage.removeItem(k); } catch(_){}
        try { sessionStorage.removeItem(k); } catch(_){}
      });
      localStorage.setItem("otp_enquiry_start", Date.now().toString());
    }
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
  const script = document.currentScript;

  const triggerSelector = script.getAttribute("data-trigger") || null;
  const onSuccessFnName = script.getAttribute("data-on-success") || null;

  // ── Create the iframe overlay ─────────────────────────────────────────────
  let iframe = null;
  let overlay = null;

  function createPopup() {
    if (iframe) return; // already created

    overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "none",
    });

    iframe = document.createElement("iframe");
    iframe.src = `${origin}/popup?apiBase=${encodeURIComponent(origin)}`;
    Object.assign(iframe.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      border: "none",
      background: "transparent",
    });
    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("frameborder", "0");

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    // Listen for messages from the popup iframe
    window.addEventListener("message", function (e) {
      if (e.origin !== origin) return;

      if (e.data?.type === "OTP_SUCCESS") {
        hidePopup();
        const p = e.data.payload;
        const user =
          p && typeof p === "object" && "user" in p ? p.user : p;
        if (onSuccessFnName && typeof window[onSuccessFnName] === "function") {
          window[onSuccessFnName](user);
        }
        document.dispatchEvent(
          new CustomEvent("otp:success", { detail: p })
        );
      }

      if (e.data?.type === "OTP_CLOSE" || e.data === "close-popup") {
        hidePopup();
        document.dispatchEvent(new CustomEvent("otp:close"));
      }
    });
  }

  function showPopup() {
    createPopup();
    overlay.style.display = "block";
    iframe.contentWindow.postMessage({ type: "OTP_OPEN" }, origin);
    document.body.style.overflow = "hidden";
  }

  function hidePopup() {
    if (overlay) overlay.style.display = "none";
    document.body.style.overflow = "";
  }

  // ── Wire up trigger button ────────────────────────────────────────────────
  function wireUpTrigger() {
    if (!triggerSelector) return;
    const el = document.querySelector(triggerSelector);
    if (el) {
      el.addEventListener("click", showPopup);
    }
  }

  // ── Public API on window.OTPPopup ─────────────────────────────────────────
  window.OTPPopup = { open: showPopup, close: hidePopup };

  // Wire up after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUpTrigger);
  } else {
    wireUpTrigger();
  }
})();
