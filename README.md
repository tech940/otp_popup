# OTP Verification Popup

A Next.js embeddable OTP verification popup. Collect Name, Email, and Phone — verify the phone number via SMS OTP — and receive a callback with the verified user data.

---

## Features

- **3-step flow**: Form → OTP entry → Success
- **SMS OTP via Twilio Verify** — Twilio generates, sends, expires and checks the codes
- **Embeddable on any website** via a single `<script>` tag (no React/npm needed on the host site)
- **iframe + postMessage** architecture for cross-origin isolation
- **Rate limiting** per phone and per IP, plus Twilio Verify's own limits
- **CORS headers** pre-configured

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Twilio Verify credentials (server-side only):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # Twilio Console -> Account Info
TWILIO_AUTH_TOKEN=your_auth_token                       # Twilio Console -> Account Info
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Verify -> Services -> "AM Ford"

# Supabase (verified leads — optional)
# SUPABASE_URL=https://xxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# SUPABASE_LEADS_TABLE=leads
```

Run the SQL in `supabase/migrations/001_otp_leads.sql` in the Supabase SQL editor to create the `leads` table, then `002_otp_leads_vehicle_snapshot.sql` for the optional JSON column (`vehicle_snapshot`).

WordPress GTM iframe URLs should pass vehicle data like `?vin=&stock=&price=&vehicle=&page_url=` (see `public/gtm-wordpress-snippet.example.txt`).

> **There is no dev-mode bypass.** Without the three Twilio variables, `/api/send-otp` and the unlock
> popup's `/api/verify-otp` return 503. Use a real US number you are authorized to text when testing.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the demo page.

---

## Embedding on External Websites

### Method 1 — Script tag (recommended)

Paste this before `</body>` on any HTML page:

```html
<script
  src="https://YOUR-DOMAIN.com/embed.js"
  data-trigger="#your-button-id"
  data-on-success="handleVerified"
></script>

<button id="your-button-id">Verify Phone</button>

<script>
  function handleVerified(user) {
    console.log('Verified user:', user);
    // user = { name: "...", email: "...", phone: "+91..." }
  }
</script>
```

Replace `YOUR-DOMAIN.com` with your deployed URL (e.g. `https://otp-app.vercel.app`).

### Method 2 — Programmatic API

```html
<script src="https://YOUR-DOMAIN.com/embed.js"></script>
<script>
  // Open the popup manually
  window.OTPPopup.open();

  // Listen via DOM event
  document.addEventListener('otp:success', (e) => {
    console.log(e.detail); // { name, email, phone }
  });
</script>
```

### Method 3 — iframe directly

```html
<iframe
  src="https://YOUR-DOMAIN.com/popup"
  style="position:fixed;inset:0;width:100%;height:100%;border:none;z-index:9999"
></iframe>

<script>
  // Listen for postMessage from the iframe
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'OTP_SUCCESS') {
      console.log('Verified:', e.data.payload);
    }
  });
</script>
```

---

## Project Structure

```
otp-popup/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── send-otp/route.ts   ← Sends OTP via Twilio
│   │   │   └── verify-otp/route.ts ← Verifies OTP
│   │   ├── popup/page.tsx          ← Standalone iframe page
│   │   ├── page.tsx                ← Demo page
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── OTPPopup.tsx            ← Core popup UI
│   │   ├── OTPPopupDemo.tsx        ← Demo wrapper
│   │   └── OTPPopupStandalone.tsx  ← iframe wrapper
│   └── lib/
│       ├── twilioVerify.ts         ← Twilio Verify send/check
│       ├── requestGuard.ts         ← Origin check, body limit, rate limits
│       └── phone.ts                ← US phone normalization (E.164)
├── public/
│   ├── embed.js                    ← Script for external sites
│   └── external-example.html      ← Example external site
├── next.config.js                  ← CORS headers configured
└── .env.local.example
```

---

## API Reference

### POST `/api/send-otp`

Starts a Twilio Verify SMS verification. US numbers only.

```json
Request:  { "phone": "+12165551234" }
200:      { "success": true, "status": "pending" }
4xx/5xx:  { "success": false, "error": "<customer-safe message>", "retryAfter": 27 }
```

`200` means Twilio accepted the request — not that the SMS was delivered. `retryAfter` (seconds) is
present on `429`. Limits: one send per number per 30s, 5 per number and 10 per IP per 15 minutes.

### POST `/api/verify-otp`

For the unlock popup, checks the code with Twilio Verify and saves the lead only if Twilio
returns `approved`.

```json
Request:  { "user": { "phone": "+12165551234", "firstName": "...", ... }, "car": { ... }, "otp": "123456" }
200:      { "success": true, "message": "...", "user": { ... }, "saveStatus": { ..., "leadId": "..." } }
4xx/5xx:  { "error": "<customer-safe message>", "retryAfter": 120 }
```

Limits: 10 checks per number and 30 per IP per 15 minutes, plus Twilio's 5 attempts per code.

The $500-off and trade popups also post here with `otp` set to `BYPASS_OFFER` / `BYPASS_TRADE`.
They are plain lead forms with no OTP step; their leads are pinned to their own source label and
are never recorded as an unlock.

Browser requests must come from the app's own origin or `ALLOWED_ORIGINS`.

---

## Deployment

### Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Set environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Docker / any Node server

```bash
npm run build
npm start
```

---

## Production Notes

- **OTP codes**: generated, stored and expired by Twilio Verify. The app never sees or stores one.
- **Rate limiting**: the app's limiter is in memory, per server instance, so on Vercel it bounds
  bursts rather than enforcing an exact global limit. Twilio Verify adds its own per-number send
  limit, per-code attempt limit and Fraud Guard. For a hard global per-IP limit, configure Verify
  Programmable Rate Limits on the service, or back `src/lib/requestGuard.ts` with Redis.
