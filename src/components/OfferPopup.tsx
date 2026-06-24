"use client";
import { useState, useEffect } from "react";
import {
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

interface OfferPopupProps {
  onClose?: () => void;
  onSubmitted?: () => void;
  apiBase?: string;
  pageSource?: string;
  initialCarData?: CarData | null;
}

function buildSourceLabel(pageSource: string): string {
  if (!pageSource) return "500 off Popup";
  const labels: Record<string, string> = {
    Home: "Home page",
    SRP: "Listing page",
    VDP: "VDP page",
  };
  return "500 off Popup (" + (labels[pageSource] || pageSource) + ")";
}

export default function OfferPopup({ onClose, onSubmitted, apiBase = "", pageSource = "", initialCarData }: OfferPopupProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsConsentChecked, setSmsConsentChecked] = useState(false);
  const [termsConsentChecked, setTermsConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [carData, setCarData] = useState<CarData>(() => {
    if (initialCarData) return initialCarData;
    if (typeof window === "undefined") return { title: "", price: "", vin: "", stock: "", pageUrl: "" };
    const p = new URLSearchParams(window.location.search);
    return {
      title: p.get("vehicle") || p.get("title") || "General Offer Inquiry",
      price: p.get("price") || "",
      vin: p.get("vin") || "",
      stock: p.get("stock") || "",
      pageUrl: p.get("pageUrl") || window.location.href,
    };
  });

  useEffect(() => {
    if (initialCarData) {
      setCarData(initialCarData);
    }
  }, [initialCarData]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== "OTP_EMBED_CONTEXT") return;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      setCarData((prev) => {
        const snap =
          d.vehicleData != null && typeof d.vehicleData === "object" && !Array.isArray(d.vehicleData)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!termsConsentChecked) {
      setLoading(false);
      setError("Please agree to the terms of use to continue.");
      return;
    }

    try {
      const payload = {
        user: {
          firstName,
          lastName,
          phone,
          email,
          preferredContact: "Email",
          comments: "Submitted via $500 OFF Offer Popup",
          verifiedAt: new Date().toISOString(),
          smsConsentChecked,
          smsConsentText: SMS_CONSENT_DISCLOSURE,
          smsConsentAt: smsConsentChecked ? new Date().toISOString() : null,
          termsConsentChecked,
          termsConsentText: TERMS_CONSENT_DISCLOSURE,
          termsConsentAt: termsConsentChecked ? new Date().toISOString() : null,
        },
        car: {
          ...carData,
          source: buildSourceLabel(pageSource),
        },
        otp: "BYPASS_OFFER"
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
      <div
        className="offer-overlay"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
          zIndex: 9999,
          fontFamily: '"Metropolis", "Segoe UI", system-ui, sans-serif',
        }}
      >
        <div
          className="offer-popup"
          style={{
            width: "100%",
            maxWidth: 600,
            background: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            textAlign: "center",
            padding: 60,
          }}
        >
          <div style={{ 
            width: 100, height: 100, background: "#ecfdf5", borderRadius: "50%", 
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 30px",
            fontSize: 50
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 48, fontWeight: 900, color: "#111", marginBottom: 20 }}>Thank You!</h2>
          <p style={{ fontSize: 24, color: "#666", lineHeight: 1.6 }}>Your offer has been submitted successfully. A representative will contact you shortly.</p>
          <button 
            onClick={onClose}
            className="offer-btn"
            style={{ marginTop: 40 }}
          >
            <div className="btn-content">
              <h3>Close</h3>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="offer-overlay"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 10,
        zIndex: 9999,
        fontFamily: '"Metropolis", "Segoe UI", system-ui, sans-serif',
      }}
    >
      <div
        className="offer-popup"
        style={{
          width: "100%",
          maxWidth: 580,
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          position: "relative",
        }}
      >
        
        {/* CLOSE */}
        <button className="offer-close" onClick={onClose}>✕</button>

        {/* HEADER */}
        <div className="offer-header">

          <div className="offer-logo">
            <img src="https://di-uploads-development.dealerinspire.com/amford/uploads/2025/08/Am-ford.png" alt="AM Ford" />
          </div>

          <div className="offer-main">

            <h1>
              <span className="amount">$500</span>
              <span className="off">OFF</span>
            </h1>

            <h2>YOUR NEW VEHICLE PURCHASE</h2>

            <div className="stars">
              <span></span>
              ★★★★★
              <span></span>
            </div>

          </div>

        </div>

        {/* BODY */}
        <div className="offer-body">

          <form onSubmit={handleSubmit}>
            <div className="form-grid">

              <div className="field">
                <label>FIRST NAME</label>
                <input 
                  type="text" 
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>LAST NAME</label>
                <input 
                  type="text" 
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>PHONE</label>
                <input 
                  type="tel" 
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>EMAIL</label>
                <input 
                  type="email" 
                   placeholder="john@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

            </div>

            {error && (
              <div style={{
                marginTop: 10, padding: 8, background: "#fef2f2",
                border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", 
                fontSize: 12, textAlign: "center", fontWeight: 600
              }}>
                {error}
              </div>
            )}

            <div className="sms-consent-group offer-consent-group">
              <label className="sms-consent-row">
                <input
                  className="sms-consent-checkbox"
                  type="checkbox"
                  checked={smsConsentChecked}
                  onChange={(e) => setSmsConsentChecked(e.target.checked)}
                />
                <span className="sms-consent-copy">{SMS_CONSENT_DISCLOSURE}</span>
              </label>
              <label className={`sms-consent-row sms-consent-row-secondary${error === "Please agree to the terms of use to continue." ? " is-invalid" : ""}`}>
                <input
                  className="sms-consent-checkbox"
                  type="checkbox"
                  checked={termsConsentChecked}
                  onChange={(e) => {
                    setTermsConsentChecked(e.target.checked);
                    if (e.target.checked && error === "Please agree to the terms of use to continue.") {
                      setError("");
                    }
                  }}
                />
                <span className="sms-consent-copy">
                  You also agree to our{" "}
                  <a
                    href={TERMS_OF_USE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    terms of use
                  </a>
                  .
                </span>
              </label>
            </div>

            {/* CTA */}
            <button className="offer-btn" type="submit" disabled={loading}>

              <div className="btn-content">
                <h3>{loading ? "PROCESSING..." : "CLAIM MY $500 OFF"}</h3>
              </div>

              <div className="arrow">➜</div>

            </button>
          </form>

          {/* TRUST BADGES INLINE */}
          <div className="trust-section">
            <div className="trust-box">
              <span className="trust-icon">🔒</span>
              <span>100% Secure</span>
            </div>
            <div className="trust-divider">|</div>
            <div className="trust-box">
              <span className="trust-icon">👤</span>
              <span>No Obligation</span>
            </div>
            <div className="trust-divider">|</div>
            <div className="trust-box">
              <span className="trust-icon">🎧</span>
              <span>Fast Response</span>
            </div>
          </div>

          {/* FOOTER */}
          <div className="offer-footer">
            <a href={TERMS_OF_USE_URL} target="_blank" rel="noopener noreferrer">Terms & Conditions</a>
            <p>🔒 We respect your privacy</p>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#d00000", fontWeight: 700, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
              No, Thank You
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
