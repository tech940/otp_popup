"use client";

import { useEffect, useState } from "react";
import TradeOfferPopup from "./TradeOfferPopup";

interface CarData {
  title: string;
  price: string;
  vin: string;
  stock: string;
  pageUrl: string;
  vehicleSnapshot?: Record<string, unknown> | null;
}

export default function TradeOfferPopupStandalone() {
  const [open, setOpen] = useState(true);
  const [apiBase, setApiBase] = useState("");
  const [pageSource, setPageSource] = useState("");
  const [carData, setCarData] = useState<CarData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const base = params.get("apiBase") || window.location.origin;
    setApiBase(base);

    const pageType = params.get("page_type") || "";
    setPageSource(pageType);

    const vin = params.get("vin") || "";
    const stock = params.get("stock") || "";
    const price = params.get("price") || "";
    const vehicle = params.get("vehicle") || "";
    const pageUrl =
      params.get("page_url") || params.get("pageUrl") || window.location.href;

    if (vin || vehicle || pageUrl) {
      setCarData({ title: vehicle, price, vin, stock, pageUrl });
    }

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "TRADE_OFFER_OPEN") setOpen(true);
      if (e.data?.type === "TRADE_OFFER_CLOSE") setOpen(false);

      if (e.data?.type === "OTP_EMBED_CONTEXT") {
        const d = e.data;
        const str = (v: unknown) => (typeof v === "string" ? v : "");
        const snap =
          d.vehicleData != null &&
          typeof d.vehicleData === "object" &&
          !Array.isArray(d.vehicleData)
            ? (d.vehicleData as Record<string, unknown>)
            : undefined;
        setCarData({
          title: str(d.vehicle) || str(d.title) || "",
          price: str(d.price) || "",
          vin: str(d.vin) || "",
          stock: str(d.stock) || "",
          pageUrl: str(d.pageUrl) || str(d.page_url) || window.location.href,
          vehicleSnapshot: snap ?? null,
        });
        if (d.page_type) setPageSource(d.page_type);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleSubmitted = () => {
    window.parent.postMessage({ type: "TRADE_OFFER_SUBMITTED" }, "*");
  };

  const handleClose = () => {
    window.parent.postMessage({ type: "TRADE_OFFER_CLOSE" }, "*");
    window.parent.postMessage("close-trade-offer", "*");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <TradeOfferPopup
      apiBase={apiBase}
      onClose={handleClose}
      onSubmitted={handleSubmitted}
      pageSource={pageSource}
      initialCarData={carData}
    />
  );
}
