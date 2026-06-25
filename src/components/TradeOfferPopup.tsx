"use client";

import { useEffect, useState } from "react";
import {
  PRIVACY_POLICY_URL,
  SMS_CONSENT_DISCLOSURE,
  TERMS_CONSENT_DISCLOSURE,
  TERMS_OF_USE_URL,
} from "@/lib/smsConsent";

interface CarData {
  title: string;
  price: string;
  vin: string;
  stock: string;
  pageUrl: string;
  vehicleSnapshot?: Record<string, unknown> | null;
}

interface TradeOfferPopupProps {
  onClose?: () => void;
  onSubmitted?: () => void;
  apiBase?: string;
  pageSource?: string;
  initialCarData?: CarData | null;
}

const TRADE_HERO_IMAGE =
  "https://vehicle-images.carscommerce.inc/8419-110013336/1FTEW1E43LFB36713/7a3155485fbc615d20e0b0cac251b7a9.webp";

function buildTradeSourceLabel(pageSource: string): string {
  if (pageSource === "Home") return "Trade Value Popup (Home page)";
  if (pageSource === "SRP") return "Trade Value Popup (Listing page)";
  return "Trade Value Popup";
}

function formatE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return "+" + digits;
}

export default function TradeOfferPopup({
  onClose,
  onSubmitted,
  apiBase = "",
  pageSource = "",
  initialCarData,
}: TradeOfferPopupProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredContact, setPreferredContact] = useState("Text");
  const [phone, setPhone] = useState("+1");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const [carData, setCarData] = useState<CarData>(() => {
    if (initialCarData) return initialCarData;
    if (typeof window === "undefined") {
      return { title: "", price: "", vin: "", stock: "", pageUrl: "" };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      title: params.get("vehicle") || params.get("title") || "",
      price: params.get("price") || "",
      vin: params.get("vin") || "",
      stock: params.get("stock") || "",
      pageUrl:
        params.get("page_url") ||
        params.get("pageUrl") ||
        window.location.href,
      vehicleSnapshot: null,
    };
  });

  useEffect(() => {
    if (initialCarData) setCarData(initialCarData);
  }, [initialCarData]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== "OTP_EMBED_CONTEXT") return;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      setCarData((prev) => {
        const snap =
          d.vehicleData != null &&
          typeof d.vehicleData === "object" &&
          !Array.isArray(d.vehicleData)
            ? (d.vehicleData as Record<string, unknown>)
            : prev.vehicleSnapshot;
        return {
          title: str(d.vehicle) || str(d.title) || prev.title,
          price: str(d.price) || prev.price,
          vin: str(d.vin) || prev.vin,
          stock: str(d.stock) || prev.stock,
          pageUrl: str(d.pageUrl) || str(d.page_url) || prev.pageUrl,
          vehicleSnapshot: snap ?? prev.vehicleSnapshot,
        };
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const inputClass = (field: string) =>
    invalidFields.includes(field)
      ? "trade-offer-field-input is-invalid"
      : "trade-offer-field-input";

  const handlePhoneChange = (value: string) => {
    let next = value;
    if (!next.startsWith("+1")) {
      next = "+1" + next.replace(/\D/g, "");
    }
    const digits = next.slice(2).replace(/\D/g, "").slice(0, 10);
    setPhone("+1" + digits);
    if (invalidFields.includes("phone")) {
      setInvalidFields((prev) => prev.filter((field) => field !== "phone"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInvalidFields([]);

    const errors: string[] = [];
    if (!firstName.trim()) errors.push("firstName");
    if (phone.length < 12) errors.push("phone");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("email");
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
      setTimeout(() => setInvalidFields([]), 410);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user: {
          firstName,
          lastName,
          phone: formatE164(phone),
          email,
          preferredContact,
          comments: "Submitted via Trade Value Popup",
          verifiedAt: new Date().toISOString(),
          smsConsentChecked: false,
          smsConsentText: SMS_CONSENT_DISCLOSURE,
          smsConsentAt: null,
          termsConsentChecked: false,
          termsConsentText: TERMS_CONSENT_DISCLOSURE,
          termsConsentAt: null,
        },
        car: {
          ...carData,
          source: buildTradeSourceLabel(pageSource),
        },
        otp: "BYPASS_TRADE",
      };

      const res = await fetch(`${apiBase}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="trade-offer-overlay">
        <div className="trade-offer-shell trade-offer-shell--success">
          <button
            type="button"
            className="trade-offer-close"
            onClick={onClose}
            aria-label="Close popup"
          >
            ×
          </button>
          <div className="trade-offer-success-mark">✓</div>
          <h2 className="trade-offer-success-title">Thank you</h2>
          <p className="trade-offer-success-copy">
            Your trade request has been submitted successfully. A representative
            will contact you shortly.
          </p>
          <button
            type="button"
            className="trade-offer-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trade-offer-overlay">
      <div className="trade-offer-shell">
        <button
          type="button"
          className="trade-offer-close"
          onClick={onClose}
          aria-label="Close popup"
        >
          ×
        </button>

        <div className="trade-offer-hero">
          <div className="trade-offer-promo">
            <div className="trade-offer-promo-line" />
            <div className="trade-offer-promo-amount">$500</div>
            <div className="trade-offer-promo-copy">
              MORE FOR
              <br />
              YOUR TRADE*
            </div>
            <div className="trade-offer-promo-line" />
            <p className="trade-offer-promo-footnote">
              Cannot be combined with any other discounts or promotions. Please
              contact dealer for details.
            </p>
          </div>
          <div className="trade-offer-hero-image-wrap">
            <img
              src={TRADE_HERO_IMAGE}
              alt="Trade-in vehicle"
              className="trade-offer-hero-image"
            />
            <div className="trade-offer-hero-glow" aria-hidden />
          </div>
        </div>

        <div className="trade-offer-body">
          <form onSubmit={handleSubmit} className="trade-offer-form">
            <div className="trade-offer-grid">
              <label className="trade-offer-field">
                <span className="trade-offer-field-label">
                  First Name <span className="trade-offer-required">*</span>
                </span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (invalidFields.includes("firstName")) {
                      setInvalidFields((prev) =>
                        prev.filter((field) => field !== "firstName"),
                      );
                    }
                  }}
                  className={inputClass("firstName")}
                />
              </label>

              <label className="trade-offer-field">
                <span className="trade-offer-field-label">Last Name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass("lastName")}
                />
              </label>

              <label className="trade-offer-field">
                <span className="trade-offer-field-label">
                  Preferred Contact
                </span>
                <select
                  value={preferredContact}
                  onChange={(e) => setPreferredContact(e.target.value)}
                  className="trade-offer-field-input trade-offer-select"
                >
                  <option>Text</option>
                  <option>Call</option>
                  <option>Email</option>
                </select>
              </label>

              <label className="trade-offer-field">
                <span className="trade-offer-field-label">
                  Phone <span className="trade-offer-required">*</span>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={inputClass("phone")}
                />
              </label>

              <label className="trade-offer-field trade-offer-field--full">
                <span className="trade-offer-field-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (invalidFields.includes("email")) {
                      setInvalidFields((prev) =>
                        prev.filter((field) => field !== "email"),
                      );
                    }
                  }}
                  className={inputClass("email")}
                />
              </label>
            </div>

            {error ? (
              <div className="trade-offer-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="trade-offer-actions">
              <button
                type="button"
                className="trade-offer-secondary"
                onClick={onClose}
              >
                Not Interested
              </button>
              <button
                type="submit"
                className="trade-offer-primary"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>

            <div className="trade-offer-consent">
              <p className="trade-offer-consent-copy">
                {SMS_CONSENT_DISCLOSURE} You also agree to our{" "}
                <a
                  href={TERMS_OF_USE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  terms of use
                </a>{" "}
                and{" "}
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  privacy policy
                </a>
                .
              </p>
              <div className="trade-offer-terms-links">
                <a
                  href={TERMS_OF_USE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Show Terms & Conditions
                </a>
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
