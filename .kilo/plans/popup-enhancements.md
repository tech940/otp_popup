# Plan: Popup Enhancements (Revised)

## 1. Change OfferPopup email placeholder
- **File**: `src/components/OfferPopup.tsx:169`
- Change `placeholder="john@example.com"` → `placeholder="john@gmail.com"`
- Also update README example at line 167 if present.

## 2. Remove gift icon from OfferPopup
- **File**: `src/components/OfferPopup.tsx`
- Remove `<div className="gift-icon">🎁</div>` JSX at ~line 191 (inside the CTA button)
- Remove `.gift-icon { ... }` CSS block at ~lines 451–461 in the `styles` template literal

## 3. Auto-clear old enquiry data on script load + 1-day reset (BOTH popups)
- **Files affected**:
  - `public/offer-embed.txt`
  - `public/embed.js`
- **Logic to add at the top of each script's IIFE**:
  ```js
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

    function clearCookiesMatching(pattern) {
      var rx = new RegExp("(?:^|;\\s*)" + pattern + "=");
      document.cookie.split(";").forEach(function(c) {
        var name = c.split("=")[0].trim();
        if (rx.test("; " + document.cookie + "; ")) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      });
    }

    clearOldEnquiry();
    clearCookiesMatching("^otp_|^offer_");
    // ...
  })();
  ```
- Apply in both `public/offer-embed.txt` and `public/embed.js`.
- Also call `clearOldEnquiry()` at popup close/open if needed.

## 4. Differentiated offer-popup delays by page type (offer-embed.txt)
- **File**: `public/offer-embed.txt`
- Replace single `DELAY_SECONDS = 5` with logic inside `initTimedOffer()`:
  - **VDP** (`/inventory/`) → **4 seconds**
  - **SRP** (`/new-vehicles` or `/used-vehicles`) → **6 seconds**
  - **Home** (`/`, `/index.php`, `/home`, etc.) → **5 seconds** (confirmed by user)
  - Other pages → do not show
