# ASC Events — AM Ford popups

GA4/GTM tracking for the three popups, following the
[ASC event spec sheet](https://docs.google.com/spreadsheets/d/16i1x19MK3yCRXMivGa2WcyOhxlmGgkb9GbE2vAJuJ74/edit).

| Event | When it fires |
| --- | --- |
| `asc_form_engagment` | The user engages the form — the click on the CTA that opens it, or (for the timed popups, which nobody clicks open) the first field the user touches. Once per popup instance. |
| `asc_form_submission` | The form was submitted and the lead was accepted by the API. |
| `asc_form_submission_sales` | Same moment, same parameters — the sales-department variant. |

Note the spelling `asc_form_engagment` (no second "e"). That is how the spec sheet
spells it, so the GTM trigger must match it exactly.

## Forms

| Popup | `form_name` | `form_type` | Engagement fired by |
| --- | --- | --- | --- |
| Unlock Instant Price (SRP + VDP) | `AM Ford - Unlock Instant Price` | `quote` | Embed script, on the "Unlock Instant Price" button / teaser click |
| $500 OFF offer (timed, VDP) | `AM Ford - $500 Off Offer` | `offer` | Popup, on first field interaction |
| Trade Value (timed, Home + SRP) | `AM Ford - Trade Value Offer` | `trade` | Popup, on first field interaction |

The unlock popup is the only one opened by a click, so it is the only one whose
engagement comes from the dealer page. The other two open on a timer — firing
their engagement on the opening "click" would mean firing it on a timeout, which
is not user engagement, so the first real interaction is used instead.

## How the events reach the dataLayer

The popups run in a cross-origin iframe, so they cannot touch the dealer page's
`dataLayer` directly:

```
popup iframe                         dealer page (GTM)
────────────                         ─────────────────
trackAscFormSubmission()
  └─ postMessage {type:"ASC_EVENT"} ──►  ascRelay()  ──►  window.dataLayer.push({event, …})
```

* `src/lib/ascEvents.ts` builds the payload and posts it to the parent.
* The embed scripts (`public/gtm-wordpress-snippet.example.txt`,
  `public/offer-embed.txt`, `public/trade-offer-embed.txt`) each carry an
  identical relay block that validates the sender origin and pushes to
  `window.dataLayer`.
* The relay binds **once per page** via the shared `window.__ascEventRelayBound`
  guard, so a submit lands in the dataLayer exactly once even though all three
  embeds are installed on the site.
* The parent always overwrites `page_location` and `page_type` with its own
  values — the iframe's URL is never reported as the page.

`asc_form_engagment` for the unlock popup never leaves the dealer page: the embed
script pushes it directly when the CTA is clicked.

## Parameters

Sent on all three events:

| Parameter | Value |
| --- | --- |
| `event_owner` | `am_group` |
| `affiliation` | `am_ford_of_jefferson` |
| `department` | `sales` |
| `comm_type` | `form` |
| `page_type` | `item` (VDP) · `itemlist` (SRP) · `home` · `unknown` |
| `page_location` | Dealer page URL |
| `form_name`, `form_type` | See the table above |
| `element_type` | `popup`, or `item_details` / `body` for the CTA click |
| `element_subtype` | `cta_button` or `input_field` |
| `element_text` | Label of the control actually clicked — the injected button, the teaser image, or the dealer's own price CTA |
| `element_position` | `center_center` (modal) or `inline` (CTA on the page) |

Engagement adds `comm_status: start`, `event_action: click` (CTA) or
`field_input`, `event_action_result: popup` / `start`.
Submission adds `comm_status: send`, `event_action: click`,
`event_action_result: complete`, and `submission_id` (the lead row id returned
by `/api/verify-otp`).
The trade form also carries `flow_name: trade` with `flow_outcome: start` / `lead`.

Vehicle parameters — `item_id` (VIN), `item_number` (stock), `item_year`,
`item_make`, `item_model`, `item_variant` (trim), `item_color`, `item_type`
(body style), `item_fuel_type`, `item_condition`, `item_price`, `currency` — are
carried by the unlock popup and the $500-off popup, which are both vehicle-scoped.

**The trade form carries no `item_*` at all, on any page.** It is not vehicle-scoped —
the embed passes no vehicle into the iframe on Home *or* SRP. A "trade leads by vehicle"
report will therefore be empty; attributing SRP trade leads to the listing being browsed
would need vehicle context added to `postTradeOfferContext`, which is a code change, not
a GTM change.

`item_model` / `item_variant` are split on a known Ford model list, never positionally —
a positional split reads "2023 Ford F-250 King Ranch" as model "F-250 King", trim
"Ranch". On SRP the Dealer Inspire `data-vehicle` blob supplies model and trim directly
and is used as-is. On VDP only the heading is available, so an unrecognised model (a
non-Ford trade-in on the used lot) is reported whole as `item_model` with no
`item_variant` rather than an invented one. Add to `ASC_MODELS` if a model is missed.

Every event pushes the full parameter key set, using `undefined` for the keys it has no
value for. This matters: GTM merges each push into one persistent data model, so a key
that is simply omitted keeps whatever the previous event set — a visitor who opens an
F-150 listing and then submits the trade form would otherwise have that lead reported
against the F-150. GA4 omits `undefined` parameters from the hit. Mapped parameters only
ever carry a value from their allowed list.

## GTM setup

1. **Triggers** — Custom Event, event name matched exactly:
   `asc_form_engagment`, `asc_form_submission`, `asc_form_submission_sales`.
2. **Variables** — one Data Layer Variable per parameter you want to report on
   (`form_name`, `form_type`, `item_id`, `item_price`, `page_type`, …).
3. **Tags** — GA4 Event tags using the same event names, with the variables above
   as event parameters. Register any of them you want to slice by as GA4 custom
   dimensions.

To verify: open GTM Preview on a VDP, click **Unlock Instant Price** — the
engagement event appears immediately; complete the form — both submission events
appear together.

## Things to confirm with the MD

`ASC_EVENT_OWNER`, `ASC_AFFILIATION` and `ASC_DEPARTMENT` each exist in **three places
that must be edited together**: `src/lib/ascEvents.ts`, and twice in
`public/gtm-wordpress-snippet.example.txt` (once per IIFE). Changing only the app copy
splits the funnel — engagement is pushed by the embed and submission by the app, so the
same visitor would be reported under two different values.

* **`event_owner`** is set to `am_group`, which is not on the ASC vendor list
  (the list is closed and contains platform vendors like `dealer_inspire`,
  `dealeron`, `dealertrack`). Change the constant if a registered value is required.
* **`department`** is `sales` on all three forms, including the trade form, since
  those leads are worked by the sales team and the spec calls for
  `asc_form_submission_sales`. The spec also allows `trade`; switch
  `ASC_DEPARTMENT` if they would rather report it that way.
