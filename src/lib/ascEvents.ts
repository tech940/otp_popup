/**
 * ASC (Automotive Standards Council) event helpers.
 *
 * The popups run inside a cross-origin iframe, so GTM/GA4 lives on the parent
 * dealer page, not here. Every ASC event is therefore:
 *   1. pushed to the iframe's own dataLayer (no-op unless GTM is added here), and
 *   2. posted to the parent as { type: "ASC_EVENT", event, params }.
 * The embed scripts (public/*.txt) relay message 2 into the parent dataLayer.
 *
 * Events used (per MD spec):
 *   asc_form_engagment        - user engages the form (opening click / first input)
 *   asc_form_submission       - form submitted successfully
 *   asc_form_submission_sales - same submit, sales-department variant
 *
 * Parameter names/values follow the ASC spec sheet. Mapped parameters only ever
 * carry a value from their allowed list.
 *
 * Every event pushes the FULL parameter key set, using `undefined` for the keys
 * it has no value for. GTM merges each push into one persistent data model, so a
 * key that is simply omitted keeps whatever the previous event set — which would
 * attach the last vehicle a visitor looked at to an unrelated later lead. Pushing
 * the key as `undefined` clears it, and GA4 omits the parameter from the hit.
 */

/** Who sends the events into GA4. Not on the ASC vendor list — change if the OEM/agency requires a registered value. */
export const ASC_EVENT_OWNER = "am_group";
/** Company associated with the event but not the owner. */
export const ASC_AFFILIATION = "am_ford_of_jefferson";
/** Every popup here produces a sales-department lead. */
export const ASC_DEPARTMENT = "sales";

export const ASC_FORM_ENGAGEMENT = "asc_form_engagment";
export const ASC_FORM_SUBMISSION = "asc_form_submission";
export const ASC_FORM_SUBMISSION_SALES = "asc_form_submission_sales";

/**
 * Every ASC key these events can carry. Pushed on all three events so a key never
 * carries over from a previous push. Keep in sync with ASC_PARAM_KEYS in the embed
 * scripts (public/*.txt).
 */
export const ASC_PARAM_KEYS = [
  "event_owner",
  "affiliation",
  "department",
  "page_type",
  "page_location",
  "comm_type",
  "comm_status",
  "form_name",
  "form_type",
  "element_type",
  "element_subtype",
  "element_text",
  "element_position",
  "event_action",
  "event_action_result",
  "submission_id",
  "flow_name",
  "flow_outcome",
  "item_id",
  "item_number",
  "item_year",
  "item_make",
  "item_model",
  "item_variant",
  "item_color",
  "item_type",
  "item_fuel_type",
  "item_condition",
  "item_price",
  "currency",
] as const;

export type AscParams = Record<string, string | number>;

export interface AscCar {
  title?: string;
  price?: string;
  vin?: string;
  stock?: string;
  pageUrl?: string;
  vehicleSnapshot?: Record<string, unknown> | null;
}

function snapValue(
  snap: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  if (!snap) return "";
  for (const key of keys) {
    const value = snap[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

/** ASC formatting: lower case, spaces replaced by _ */
function asSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

/** item_price: no decimals, digits only. */
function asWholeNumber(value: string): string {
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

/**
 * Ford model names, used to split a vehicle heading into model + trim. Longest
 * match wins, so "Mustang Mach-E" is not read as model "Mustang" trim "Mach-E".
 * Keep in sync with ASC_MODELS in the embed scripts.
 */
const ASC_MODELS = [
  "Super Duty F-250",
  "Super Duty F-350",
  "Super Duty F-450",
  "Super Duty F-550",
  "F-150 Lightning",
  "Mustang Mach-E",
  "Transit Connect",
  "Expedition Max",
  "Bronco Sport",
  "Crown Victoria",
  "Grand Marquis",
  "Five Hundred",
  "E-Transit",
  "EcoSport",
  "Excursion",
  "Expedition",
  "Explorer",
  "Freestyle",
  "Maverick",
  "Mustang",
  "Bronco",
  "Escape",
  "Transit",
  "Ranger",
  "Taurus",
  "Fiesta",
  "Fusion",
  "C-Max",
  "Focus",
  "Flex",
  "Edge",
  "F-150",
  "F-250",
  "F-350",
  "F-450",
  "F-550",
  "F-600",
  "GT",
];

/** Drop the spec tail dealers append to OEM titles ("5.5 ft. box 145 in. WB"). */
function trimUpToSpecs(raw: string): string {
  const out: string[] = [];
  for (const token of raw.split(/\s+/).filter(Boolean)) {
    if (/^\d/.test(token)) break;
    if (/^(ft\.?|in\.?|wb|box)$/i.test(token)) break;
    out.push(token);
    if (out.length >= 4) break;
  }
  return out.join(" ");
}

/**
 * Split "2024 Ford F-150 XLT" / "Certified Pre-Owned 2021 Ford Escape SE".
 * Model and trim are only separated on a known model name — never positionally,
 * which would read "2023 Ford F-250 King Ranch" as model "F-250 King" trim "Ranch".
 * When the model is not recognised (a non-Ford trade-in on the used lot) the whole
 * remainder becomes the model and no trim is reported, rather than inventing one.
 */
function splitHeading(heading: string): {
  year: string;
  make: string;
  model: string;
  trim: string;
} {
  const out = { year: "", make: "", model: "", trim: "" };
  const text = (heading || "").replace(/\s+/g, " ").trim();
  const m = text.match(/(?:Certified Pre-Owned\s+)?(\d{4})\s+([A-Za-z-]+)\s+(.+)/i);
  if (!m) return out;
  out.year = m[1] || "";
  out.make = m[2] || "";
  const rest = (m[3] || "").trim();
  if (!rest) return out;

  const lower = rest.toLowerCase();
  let matched = "";
  for (const model of ASC_MODELS) {
    const ml = model.toLowerCase();
    if ((lower === ml || lower.startsWith(`${ml} `)) && model.length > matched.length) {
      matched = model;
    }
  }

  if (matched) {
    out.model = rest.slice(0, matched.length);
    out.trim = trimUpToSpecs(rest.slice(matched.length).trim());
  } else {
    out.model = rest;
  }
  return out;
}

/** Map a dealer "condition"/"type" string onto the ASC item_condition list. */
function toItemCondition(raw: string, pageUrl: string): string {
  const t = asSlug(raw);
  if (t) {
    if (t.indexOf("certified") !== -1 || t === "cpo") return "cpo";
    if (t.indexOf("new") !== -1) return "new";
    if (t.indexOf("used") !== -1 || t.indexOf("pre-owned") !== -1 || t.indexOf("pre_owned") !== -1)
      return "used";
  }
  const url = (pageUrl || "").toLowerCase();
  if (url.indexOf("/new-vehicles") !== -1) return "new";
  if (url.indexOf("/used-vehicles") !== -1) return "used";
  return "unknown";
}

/** Site page type -> ASC page_type (mapped list). */
export function ascPageType(pageSource: string, pageUrl?: string): string {
  const source = (pageSource || "").trim().toUpperCase();
  if (source.indexOf("VDP") !== -1) return "item";
  if (source.indexOf("SRP") !== -1) return "itemlist";
  if (source.indexOf("HOME") !== -1) return "home";

  const path = (pageUrl || "").toLowerCase();
  if (path.indexOf("/inventory/") !== -1) return "item";
  if (path.indexOf("/used-vehicles") !== -1 || path.indexOf("/new-vehicles") !== -1)
    return "itemlist";
  return "unknown";
}

/** Vehicle (item_*) parameters for a car payload. Empty values are omitted. */
export function vehicleAscParams(car: AscCar | null | undefined): AscParams {
  if (!car) return {};
  const snap = car.vehicleSnapshot ?? undefined;
  const heading =
    snapValue(snap, ["vehicle_heading", "listing_title", "title"]) || car.title || "";

  /* Snapshots built by the embed scripts carry a heading and derive year/make/model/trim
     from it; a Dealer Inspire `data-vehicle` blob carries the real fields instead. Only the
     latter's model/trim are authoritative. */
  const headingDerived = Boolean(snapValue(snap, ["vehicle_heading", "listing_title"]));
  const parsed = splitHeading(heading);
  const structuredModel = snapValue(snap, ["model"]);
  const structuredTrim = snapValue(snap, ["trim"]);

  const year = snapValue(snap, ["year"]) || parsed.year;
  const make = snapValue(snap, ["make"]) || parsed.make;
  const model = headingDerived
    ? parsed.model || structuredModel
    : structuredModel || parsed.model;
  const trim = headingDerived ? parsed.trim : structuredTrim || parsed.trim;

  const price = asWholeNumber(snapValue(snap, ["price", "msrp"]) || car.price || "");
  const color = snapValue(snap, [
    "ext_color",
    "exteriorColor",
    "exterior_color",
    "extColor",
    "color",
  ]);
  /* Key spellings match src/app/api/verify-otp/route.ts — Dealer Inspire sends the
     single-word forms. */
  const bodyStyle = snapValue(snap, ["bodystyle", "body_style", "bodyStyle", "body", "style"]);
  const fuel = snapValue(snap, ["fueltype", "fuel_type", "fuelType", "fuel"]);
  const condition = toItemCondition(
    snapValue(snap, ["condition", "vehicle_condition", "type", "status"]),
    car.pageUrl || snapValue(snap, ["embed_page_url"]),
  );

  const itemId = (car.vin || snapValue(snap, ["vin"]) || "").toUpperCase();
  const itemNumber = car.stock || snapValue(snap, ["stock", "stock_number", "stockNumber"]);

  /* No vehicle in context (e.g. the trade form) — send no item_* at all rather than
     a lone `unknown` condition. */
  if (!itemId && !itemNumber && !year && !make && !model) return {};

  return cleanParams({
    item_id: itemId,
    item_number: itemNumber,
    item_year: year,
    item_make: make,
    item_model: model,
    item_variant: trim,
    item_color: color,
    item_type: bodyStyle,
    item_fuel_type: fuel ? asSlug(fuel) : "",
    item_condition: condition,
    item_price: price,
    currency: price ? "USD" : "",
  });
}

/** Drop empty/undefined values so GA4 never records a blank custom dimension. */
export function cleanParams(params: Record<string, unknown>): AscParams {
  const out: AscParams = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null) return;
    if (typeof value === "number") {
      out[key] = value;
      return;
    }
    const str = String(value).trim();
    if (str === "") return;
    out[key] = str;
  });
  return out;
}

/** Push one ASC event to the local dataLayer and relay it to the embedding page. */
export function pushAscEvent(event: string, params: AscParams): void {
  if (typeof window === "undefined") return;

  /* Full key set every time — see the note at the top of this file. */
  const payload: Record<string, unknown> = { event };
  ASC_PARAM_KEYS.forEach((key) => {
    payload[key] = Object.prototype.hasOwnProperty.call(params, key) ? params[key] : undefined;
  });

  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(payload);
  } catch {
    /* no dataLayer in this frame */
  }

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "ASC_EVENT", event, params }, "*");
    }
  } catch {
    /* cross-origin parent unavailable */
  }
}

interface AscFormOptions {
  /** form_name — free text, as named by the form owner. */
  formName: string;
  /** form_type — mapped: quote | offer | trade | consumer_contact | ... */
  formType: string;
  /** Site page type (VDP / SRP / Home) or empty. */
  pageSource?: string;
  car?: AscCar | null;
  /** Extra ASC parameters to merge last. */
  extra?: Record<string, unknown>;
}

function baseFormParams(options: AscFormOptions): AscParams {
  const pageUrl =
    options.car?.pageUrl ||
    (typeof window !== "undefined" ? window.location.href : "");
  return cleanParams({
    event_owner: ASC_EVENT_OWNER,
    affiliation: ASC_AFFILIATION,
    department: ASC_DEPARTMENT,
    page_type: ascPageType(options.pageSource || "", pageUrl),
    page_location: pageUrl,
    comm_type: "form",
    form_name: options.formName,
    form_type: options.formType,
    element_type: "popup",
    element_position: "center_center",
    ...vehicleAscParams(options.car),
  });
}

/**
 * asc_form_engagment — the user started interacting with the form.
 * Fired once per popup instance; the unlock popup fires it from the parent
 * page instead (the click on the "Unlock Instant Price" button).
 */
export function trackAscFormEngagement(
  options: AscFormOptions & { elementText?: string; eventAction?: string },
): void {
  pushAscEvent(
    ASC_FORM_ENGAGEMENT,
    cleanParams({
      ...baseFormParams(options),
      comm_status: "start",
      event_action: options.eventAction || "field_input",
      event_action_result: "start",
      element_subtype: options.eventAction === "click" ? "cta_button" : "input_field",
      element_text: options.elementText || "",
      ...(options.extra || {}),
    }),
  );
}

/**
 * asc_form_submission + asc_form_submission_sales — the form was submitted
 * successfully and a lead was created.
 */
export function trackAscFormSubmission(
  options: AscFormOptions & { elementText?: string; submissionId?: string | null },
): void {
  const params = cleanParams({
    ...baseFormParams(options),
    comm_status: "send",
    event_action: "click",
    event_action_result: "complete",
    element_subtype: "cta_button",
    element_text: options.elementText || "",
    submission_id: options.submissionId || "",
    ...(options.extra || {}),
  });

  pushAscEvent(ASC_FORM_SUBMISSION, params);
  pushAscEvent(ASC_FORM_SUBMISSION_SALES, params);
}
