"use client";
import { useState } from "react";

interface OfferPopupProps {
  onClose?: () => void;
  apiBase?: string;
}

export default function OfferPopup({ onClose, apiBase = "" }: OfferPopupProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams(window.location.search);
      const carData = {
        title: params.get("vehicle") || params.get("title") || "General Offer Inquiry",
        price: params.get("price") || "",
        vin: params.get("vin") || "",
        stock: params.get("stock") || "",
        source: "500 off Popup",
        pageUrl: params.get("pageUrl") || window.location.href,
      };

      const payload = {
        user: {
          firstName,
          lastName,
          phone,
          email,
          preferredContact: "Email",
          comments: "Submitted via $500 OFF Offer Popup",
          verifiedAt: new Date().toISOString(),
        },
        car: carData,
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
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="offer-overlay">
        <div className="offer-popup" style={{ maxWidth: 600, textAlign: "center", padding: 60 }}>
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
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="offer-overlay">
      <div className="offer-popup">
        
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
                  placeholder="john@example.com"
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

            {/* CTA */}
            <button className="offer-btn" type="submit" disabled={loading}>

              <div className="gift-icon">🎁</div>

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
            <a href="https://www.amfordashtabula.com/terms-of-use/" target="_blank" rel="noopener noreferrer">Terms & Conditions</a>
            <p>🔒 We respect your privacy</p>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#d00000", fontWeight: 700, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
              No, Thank You
            </button>
          </div>

        </div>

      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = String.raw`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .offer-overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: transparent;
    z-index: 9999;
    font-family: Inter, sans-serif;
  }

  .offer-popup {
    width: 100%;
    max-width: 580px;
    max-height: 98vh;
    overflow: hidden;
    border-radius: 16px;
    background: #fff;
    box-shadow: none;
    position: relative;
  }

  .offer-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    color: white;
    font-size: 14px;
    cursor: pointer;
    z-index: 20;
    transition: 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .offer-close:hover {
    transform: scale(1.08);
    background: rgba(255, 255, 255, 0.25);
  }

  .offer-header {
    position: relative;
    padding: 24px 30px 18px;
    overflow: hidden;
    background: radial-gradient(circle at top right, #ff6b00 0%, transparent 25%),
      linear-gradient(135deg, #ff0000 0%, #8b0000 100%);
  }

  .offer-header::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: 10px 10px;
  }

  .offer-logo {
    width: 100%;
    max-width: 130px;
    background: #fff;
    border-radius: 8px;
    padding: 6px 12px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    margin: 0 auto 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
  }

  .offer-logo img {
    width: 100% !important;
    height: auto;
  }

  .offer-main {
    text-align: center;
    position: relative;
    z-index: 2;
  }

  .offer-main h1 {
    margin-top: 2px;
    line-height: 1;
  }

  .amount {
    font-size: 54px;
    font-weight: 900;
    color: white;
    text-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
    font-style: italic;
  }

  .off {
    font-size: 26px;
    color: #ffd633;
    font-weight: 900;
    font-style: italic;
    margin-left: 4px;
    text-shadow: 0 0 8px rgba(255, 214, 51, 0.6);
  }

  .offer-main h2 {
    margin-top: 3px;
    color: white;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }

  .stars {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
    color: #ffd633;
    font-size: 11px;
  }

  .stars span {
    width: 40px;
    height: 1px;
    background: #ffd633;
  }

  .offer-body {
    padding: 24px 30px 18px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field label {
    display: block;
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 800;
    color: #444;
  }

  .field input {
    width: 100%;
    height: 38px;
    border-radius: 8px;
    border: 2px solid #e9e9e9;
    padding: 0 10px;
    font-size: 12px;
    transition: 0.3s;
    background: #fafafa;
  }

  .field input:focus {
    outline: none;
    border-color: #ff0000;
    box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.1);
    background: white;
  }

  .offer-btn {
    width: 100%;
    margin-top: 16px;
    border: none;
    cursor: pointer;
    border-radius: 10px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #ff0000, #ff6b00);
    color: white;
    overflow: hidden;
    position: relative;
    box-shadow: 0 6px 15px rgba(255, 0, 0, 0.3);
    transition: 0.3s;
  }

  .offer-btn:hover {
    transform: translateY(-0.5px);
  }

  .offer-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .gift-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    font-size: 12px;
    flex-shrink: 0;
  }

  .btn-content {
    flex: 1;
    text-align: center;
  }

  .btn-content h3 {
    font-size: 16px;
    font-weight: 900;
  }

  .arrow {
    font-size: 14px;
  }

  .trust-section {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: #555;
    font-weight: 600;
  }

  .trust-box {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .trust-icon {
    font-size: 12px;
  }

  .trust-divider {
    color: #ddd;
    font-weight: 300;
  }

  .offer-footer {
    margin-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    border-top: 1px solid #f0f0f0;
    padding-top: 10px;
  }

  .offer-footer a {
    color: #d00000;
    font-weight: 700;
    text-decoration: none;
  }

  .offer-footer p {
    color: #666;
  }

  @media (max-width: 640px) {
    .offer-popup {
      max-width: 95%;
      border-radius: 12px;
    }

    .offer-header {
      padding: 16px 20px 12px;
    }

    .amount {
      font-size: 36px;
    }

    .off {
      font-size: 18px;
    }

    .offer-main h2 {
      font-size: 12px;
    }

    .stars {
      margin-top: 4px;
    }

    .offer-body {
      padding: 16px 20px 12px;
    }

    .form-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .field input {
      height: 32px;
      font-size: 11px;
    }

    .offer-btn {
      margin-top: 12px;
      padding: 8px 12px;
    }

    .btn-content h3 {
      font-size: 13px;
    }

    .trust-section {
      font-size: 9px;
      gap: 8px;
      margin-top: 12px;
    }

    .offer-footer {
      flex-direction: row;
      gap: 4px;
      font-size: 8px;
      margin-top: 12px;
  }
`;

// Made with Bob
