export const TERMS_OF_USE_URL =
  "https://www.amfordashtabula.com/terms-of-use/";

export const PRIVACY_POLICY_URL =
  "https://www.amfordashtabula.com/privacy-policy/";

export const DEALER_NAME = "AM Ford of Ashtabula";

/** The words rendered as the terms-of-use link at the end of every disclosure. */
export const TERMS_LINK_TEXT = "terms of use";

/**
 * Call/text consent shown under each form's submit button. The same string is saved with
 * the lead as the consent record, so what is stored is word for word what the customer saw.
 */
function contactConsent(action: string): string {
  return (
    `${action}, you agree that ${DEALER_NAME} and its affiliates, and sales professionals ` +
    "may call/text you about your inquiry, which may involve use of automated means and " +
    "prerecorded/artificial voices. Message/data rates may apply. " +
    `You also agree to our ${TERMS_LINK_TEXT}.`
  );
}

export const UNLOCK_CONSENT_DISCLOSURE = contactConsent("By requesting Instant Price");
export const OFFER_CONSENT_DISCLOSURE = contactConsent("By claiming this offer");
export const TRADE_CONSENT_DISCLOSURE = contactConsent("By requesting your trade value");

/** Server-side fallbacks for a lead that arrives without its own disclosure text. */
export const SMS_CONSENT_DISCLOSURE = UNLOCK_CONSENT_DISCLOSURE;
export const SMS_MARKETING_CONSENT_DISCLOSURE = UNLOCK_CONSENT_DISCLOSURE;
export const SMS_TRANSACTIONAL_CONSENT_DISCLOSURE = UNLOCK_CONSENT_DISCLOSURE;
export const TERMS_CONSENT_DISCLOSURE = UNLOCK_CONSENT_DISCLOSURE;

/** Split a disclosure around its trailing terms-of-use words so they can render as a link. */
export function splitAtTermsLink(disclosure: string): { before: string; after: string } {
  const i = disclosure.lastIndexOf(TERMS_LINK_TEXT);
  if (i === -1) return { before: disclosure, after: "" };
  return { before: disclosure.slice(0, i), after: disclosure.slice(i + TERMS_LINK_TEXT.length) };
}
