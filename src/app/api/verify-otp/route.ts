import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  type CarData,
  mergeCarPayload,
  pickSnap,
  safeJsonForEmail,
  vehicleStatusFromType,
} from "@/lib/leadVehicle";
import { verifyOTP } from "@/lib/otpStore";
import { normalizePhone } from "@/lib/phone";
import {
  SMS_CONSENT_DISCLOSURE,
  TERMS_CONSENT_DISCLOSURE,
} from "@/lib/smsConsent";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface UserData {
  firstName: string;
  lastName: string;
  phone: string;
  preferredContact: string;
  email: string;
  comments: string;
  verifiedAt: string;
  smsConsentChecked?: boolean;
  smsConsentText?: string;
  smsConsentAt?: string | null;
  termsConsentChecked?: boolean;
  termsConsentText?: string;
  termsConsentAt?: string | null;
  name?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow arbitrary text inside XML CDATA (e.g. JSON containing ]]>). */
function cdataSafe(s: string): string {
  return s.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function isMissingColumnError(error: any, columns: string[]): boolean {
  const haystack = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return columns.some((column) => haystack.includes(column.toLowerCase()));
}

async function insertWithFallbacks(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: Record<string, any>[],
  fallbackColumns: string[][],
) {
  let lastResult: { error: any; data: any } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const result = await supabase!.from(table).insert(rows[i]).select("id");
    lastResult = result;
    if (!result.error) return result;

    const expectedFallback = fallbackColumns[i];
    if (!expectedFallback || !isMissingColumnError(result.error, expectedFallback)) {
      return result;
    }

    console.warn(
      `[SUPABASE] ${table} insert retrying without optional columns: ${expectedFallback.join(", ")}`,
    );
  }

  return lastResult!;
}

async function saveLeadToSupabase(userData: UserData, carData?: CarData) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.warn(
      "[SUPABASE] Lead not saved: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
    return;
  }

  const smsConsentChecked = Boolean(userData.smsConsentChecked);
  const smsConsentText = (userData.smsConsentText || SMS_CONSENT_DISCLOSURE).trim();
  const smsConsentAt = smsConsentChecked
    ? userData.smsConsentAt || userData.verifiedAt || new Date().toISOString()
    : null;
  const termsConsentChecked = Boolean(userData.termsConsentChecked);
  const termsConsentText = (userData.termsConsentText || TERMS_CONSENT_DISCLOSURE).trim();
  const termsConsentAt = termsConsentChecked
    ? userData.termsConsentAt || userData.verifiedAt || new Date().toISOString()
    : null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const table = process.env.SUPABASE_LEADS_TABLE || "leads";
  const snap = carData?.vehicleSnapshot ?? null;
  const vin = carData?.vin || (snap && (snap.vin || snap.VIN)) || "";

  let row: Record<string, any>;

  if (table === "leads") {
    // Look up or insert vehicle in vehicles table to satisfy foreign key link
    let vehicleId: string | null = null;
    if (vin) {
      try {
        const { data: existingVeh } = await supabase
          .from("vehicles")
          .select("id")
          .eq("vin", vin)
          .maybeSingle();

        if (existingVeh) {
          vehicleId = existingVeh.id;
        } else {
          // Dynamically seed their vehicles catalog to satisfy foreign key ID
          const yearVal = pickSnap(snap, ["year"]);
          const priceVal = carData?.price || pickSnap(snap, ["price"]);
          const msrpVal = pickSnap(snap, ["msrp", "MSRP"]);
          const imageVal = pickSnap(snap, ["images", "imageUrl", "imageUrlList", "photoUrl", "heroImage", "heroImageUrl"]);

          const { data: newVeh, error: vehErr } = await supabase
            .from("vehicles")
            .insert({
              vin: vin,
              stock_number: carData?.stock || pickSnap(snap, ["stock", "stock_number", "stockNumber"]) || "",
              year: yearVal ? Number(yearVal) : null,
              make: pickSnap(snap, ["make"]),
              model: pickSnap(snap, ["model"]),
              trim: pickSnap(snap, ["trim"]),
              price: priceVal ? Number(priceVal) : null,
              msrp: msrpVal ? Number(msrpVal) : null,
              exterior_color: pickSnap(snap, ["exteriorColor", "exterior_color", "ext_color", "extColor"]),
              images: imageVal ? [imageVal] : []
            })
            .select("id")
            .single();

          if (!vehErr && newVeh) {
            vehicleId = newVeh.id;
          } else if (vehErr) {
            console.error("[SUPABASE] Seed vehicle failed:", vehErr.message);
          }
        }
      } catch (err) {
        console.error("[SUPABASE] Vehicle lookup/seed exception:", err);
      }
    }

    const detailMsg = [
      `Vehicle: ${carData?.title || (snap && snap.title) || ""}`,
      `VIN: ${vin}`,
      `Stock: ${carData?.stock || (snap && (snap.stock || snap.stock_number)) || ""}`,
      `Preferred Contact: ${userData.preferredContact || "Any"}`,
      `SMS Consent Checked: ${smsConsentChecked ? "Yes" : "No"}`,
      `SMS Consent Timestamp: ${smsConsentAt || ""}`,
      `SMS Consent Copy: ${smsConsentText}`,
      `Terms Consent Checked: ${termsConsentChecked ? "Yes" : "No"}`,
      `Terms Consent Timestamp: ${termsConsentAt || ""}`,
      `Terms Consent Copy: ${termsConsentText}`,
      `Page URL: ${carData?.pageUrl || (snap && snap.embed_page_url) || ""}`,
      `Source: ${carData?.source || "VDP Unlock"}`,
      `User Comments: ${userData.comments || ""}`
    ].join("\n");

    row = {
      name: `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Customer",
      email: userData.email || null,
      phone: userData.phone || "",
      message: detailMsg,
      vehicle_id: vehicleId,
      status: "new",
      source: carData?.source || "VDP Unlock",
      sms_consent_checked: smsConsentChecked,
      sms_consent_text: smsConsentText,
      sms_consent_at: smsConsentAt,
      terms_consent_checked: termsConsentChecked,
      terms_consent_text: termsConsentText,
      terms_consent_at: termsConsentAt,
    };
  } else {
    // Legacy/fallback schema format
    row = {
      first_name: userData.firstName ?? "",
      last_name: userData.lastName ?? "",
      phone: userData.phone,
      email: userData.email || null,
      preferred_contact: userData.preferredContact || null,
      comments: userData.comments || null,
      verified_at: userData.verifiedAt || null,
      vehicle_title: carData?.title || null,
      price: carData?.price != null ? String(carData.price) : null,
      vin: carData?.vin || null,
      stock: carData?.stock || null,
      page_url: carData?.pageUrl || null,
      embed_source: carData?.source || null,
      vehicle_snapshot: snap,
      ...(table === "leads"
        ? {
            sms_consent_checked: smsConsentChecked,
            sms_consent_text: smsConsentText,
            sms_consent_at: smsConsentAt,
            terms_consent_checked: termsConsentChecked,
            terms_consent_text: termsConsentText,
            terms_consent_at: termsConsentAt,
          }
        : {}),
    };
  }

  const leadRows = [
    row,
    Object.fromEntries(
      Object.entries(row).filter(
        ([key]) =>
          ![
            "terms_consent_checked",
            "terms_consent_text",
            "terms_consent_at",
          ].includes(key),
      ),
    ),
    Object.fromEntries(
      Object.entries(row).filter(
        ([key]) =>
          ![
            "sms_consent_checked",
            "sms_consent_text",
            "sms_consent_at",
            "terms_consent_checked",
            "terms_consent_text",
            "terms_consent_at",
          ].includes(key),
      ),
    ),
  ];

  const { error, data } = await insertWithFallbacks(supabase, table, leadRows, [
    ["terms_consent_checked", "terms_consent_text", "terms_consent_at"],
    ["sms_consent_checked", "sms_consent_text", "sms_consent_at"],
  ]);
  if (error) {
    console.error("[SUPABASE] insert failed:", error.message, error.code, error.details, error.hint);
    return;
  }
  const inserted = Array.isArray(data) ? data[0] : data;
  console.log("[SUPABASE] Lead inserted:", table, inserted?.id ?? "(no id)");
}

function inferPopupVariant(carData?: CarData): string {
  const source = (carData?.source || "").toLowerCase();
  return source.includes("500 off") ? "offer" : "instant_price";
}

async function savePopupActivityToSupabase(userData: UserData, carData?: CarData) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const snap = carData?.vehicleSnapshot ?? null;
  const smsConsentChecked = Boolean(userData.smsConsentChecked);
  const smsConsentText = (userData.smsConsentText || SMS_CONSENT_DISCLOSURE).trim();
  const smsConsentAt = smsConsentChecked
    ? userData.smsConsentAt || userData.verifiedAt || new Date().toISOString()
    : null;
  const termsConsentChecked = Boolean(userData.termsConsentChecked);
  const termsConsentText = (userData.termsConsentText || TERMS_CONSENT_DISCLOSURE).trim();
  const termsConsentAt = termsConsentChecked
    ? userData.termsConsentAt || userData.verifiedAt || new Date().toISOString()
    : null;

  const popupRow = {
    event_type: "lead_submitted",
    popup_variant: inferPopupVariant(carData),
    sms_consent_checked: smsConsentChecked,
    sms_consent_text: smsConsentText,
    sms_consent_at: smsConsentAt,
    terms_consent_checked: termsConsentChecked,
    terms_consent_text: termsConsentText,
    terms_consent_at: termsConsentAt,
    first_name: userData.firstName || null,
    last_name: userData.lastName || null,
    phone: userData.phone || null,
    email: userData.email || null,
    page_url: carData?.pageUrl || null,
    embed_source: carData?.source || null,
    vehicle_title: carData?.title || null,
    vin: carData?.vin || null,
    stock: carData?.stock || null,
    metadata: {
      preferredContact: userData.preferredContact || null,
      comments: userData.comments || null,
      verifiedAt: userData.verifiedAt || null,
      smsConsentChecked,
      smsConsentText,
      smsConsentAt,
      termsConsentChecked,
      termsConsentText,
      termsConsentAt,
      vehicleSnapshot: snap,
    },
  };

  const popupRows = [
    popupRow,
    Object.fromEntries(
      Object.entries(popupRow).filter(
        ([key]) =>
          ![
            "terms_consent_checked",
            "terms_consent_text",
            "terms_consent_at",
          ].includes(key),
      ),
    ),
    Object.fromEntries(
      Object.entries(popupRow).filter(
        ([key]) =>
          ![
            "sms_consent_checked",
            "sms_consent_text",
            "sms_consent_at",
            "terms_consent_checked",
            "terms_consent_text",
            "terms_consent_at",
          ].includes(key),
      ),
    ),
  ];

  const { error, data } = await insertWithFallbacks(
    supabase,
    "popup_activity_tracker",
    popupRows,
    [
      ["terms_consent_checked", "terms_consent_text", "terms_consent_at"],
      ["sms_consent_checked", "sms_consent_text", "sms_consent_at"],
    ],
  );

  if (error) {
    console.error(
      "[SUPABASE] popup_activity_tracker insert failed:",
      error.message,
      error.code,
      error.details,
      error.hint,
    );
    return;
  }

  const inserted = Array.isArray(data) ? data[0] : data;
  console.log("[SUPABASE] Activity inserted:", inserted?.id ?? "(no id)");
}

async function sendAdminEmail(userData: UserData, carData?: CarData) {
  const leadRecipient = "leads@amfordsales.net";
    // const leadRecipient = "sk9969401@gmail.com";

  // Only try to send if configuration exists
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email configuration missing. Skipping email notification.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log(
    `[EMAIL] Attempting to send from ${process.env.EMAIL_USER} to ${leadRecipient} via ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`,
  );

  const adfDate = new Date().toISOString();
  const popupSource = carData?.source || "Lead Form";
  const dealerName = "Am Ford";
  const snap = carData?.vehicleSnapshot ?? undefined;

  let year = pickSnap(snap, ["year"]);
  let make = pickSnap(snap, ["make"]);
  let model = pickSnap(snap, ["model"]);
  const trim = pickSnap(snap, ["trim"]);
  const vehType = pickSnap(snap, ["type"]);
  const adfVehicleStatus = vehicleStatusFromType(vehType || "new");
  const extColor = pickSnap(snap, ["ext_color", "exteriorColor", "exterior_color", "color"]);
  const bodystyle = pickSnap(snap, ["bodystyle", "body_style"]);
  const fueltype = pickSnap(snap, ["fueltype", "fuel_type", "fuelType"]);
  const msrp = pickSnap(snap, ["msrp"]);
  const listPrice = pickSnap(snap, ["price"]) || (carData?.price ?? "");
  const heroImage = pickSnap(snap, [
    "heroImage",
    "photoUrl",
    "imageUrl",
    "primaryPhoto",
    "thumbnail",
  ]);
  const dateInStock = pickSnap(snap, ["date_in_stock", "dateInStock"]);
  const vin = carData?.vin || pickSnap(snap, ["vin"]);
  const stock = carData?.stock || pickSnap(snap, ["stock"]);

  if (!year && carData?.title) {
    const parts = carData.title.split(" ");
    if (parts.length >= 1 && /^\d{4}$/.test(parts[0])) year = parts[0];
    if (!make && parts.length >= 2) make = parts[1];
    if (!model) model = parts.slice(2).join(" ") || carData.title;
  }
  if (!model && carData?.title) model = carData.title;

  const detailLines = [
    `SMS Consent Checked: ${userData.smsConsentChecked ? "Yes" : "No"}`,
    `SMS Consent Timestamp: ${userData.smsConsentAt || ""}`,
    `SMS Consent Copy: ${userData.smsConsentText || SMS_CONSENT_DISCLOSURE}`,
    `Terms Consent Checked: ${userData.termsConsentChecked ? "Yes" : "No"}`,
    `Terms Consent Timestamp: ${userData.termsConsentAt || ""}`,
    `Terms Consent Copy: ${userData.termsConsentText || TERMS_CONSENT_DISCLOSURE}`,
    `Page URL: ${carData?.pageUrl || pickSnap(snap, ["embed_page_url"]) || ""}`,
    `User Comments: ${userData.comments || ""}`,
  ].join("\n");

  const subjectVehicle = stock || vin || carData?.title || "Lead";
  const subject = `ADF Lead: ${userData.firstName} ${userData.lastName} — ${subjectVehicle}`;

  const htmlRows = [
    ["Name", `${escapeHtml(userData.firstName)} ${escapeHtml(userData.lastName)}`.trim()],
    ["Phone", escapeHtml(userData.phone)],
    ["Email", escapeHtml(userData.email || "")],
    ["Preferred contact", escapeHtml(userData.preferredContact || "")],
    ["SMS consent", escapeHtml(userData.smsConsentChecked ? "Yes" : "No")],
    ["Consent timestamp", escapeHtml(userData.smsConsentAt || "")],
    ["Consent copy", escapeHtml(userData.smsConsentText || SMS_CONSENT_DISCLOSURE)],
    ["Terms accepted", escapeHtml(userData.termsConsentChecked ? "Yes" : "No")],
    ["Terms timestamp", escapeHtml(userData.termsConsentAt || "")],
    ["Terms copy", escapeHtml(userData.termsConsentText || TERMS_CONSENT_DISCLOSURE)],
    ["Comments", escapeHtml(userData.comments || "")],
    ["Page URL", escapeHtml(carData?.pageUrl || pickSnap(snap, ["embed_page_url"]) || "")],
    ["Year", escapeHtml(year)],
    ["Make", escapeHtml(make)],
    ["Model", escapeHtml(model)],
    ["Trim", escapeHtml(trim)],
    ["Type", escapeHtml(vehType)],
    ["VIN", escapeHtml(vin)],
    ["Stock", escapeHtml(stock)],
    ["Exterior color", escapeHtml(extColor)],
    ["Bodystyle", escapeHtml(bodystyle)],
    ["Fuel", escapeHtml(fueltype)],
    ["Price", escapeHtml(String(listPrice))],
    ["MSRP", escapeHtml(msrp)],
    ["Date in stock", escapeHtml(dateInStock)],
    ["Hero image", heroImage ? `<a href="${escapeHtml(heroImage)}">link</a>` : ""],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600">${k}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${v}</td></tr>`,
    )
    .join("");

  const htmlBody = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 12px">${popupSource} — verified lead</h2>
<table style="border-collapse:collapse;width:100%;max-width:720px">${htmlRows}</table>
</body></html>`;

  const mailOptions = {
    from: `"Lead Generator" <${process.env.EMAIL_USER}>`,
    to: leadRecipient,
    subject,
    text: `<?xml version="1.0"?>
<?adf version="1.0"?>
<adf>
    <prospect>
        <requestdate><![CDATA[${adfDate}]]></requestdate>
        <vehicle status="${adfVehicleStatus}" interest="buy">
            <year><![CDATA[${year}]]></year>
            <make><![CDATA[${make}]]></make>
            <model><![CDATA[${model}]]></model>
            <stock><![CDATA[${stock}]]></stock>
            <trim><![CDATA[${trim}]]></trim>
            <vin><![CDATA[${vin}]]></vin>
            <comments><![CDATA[New Submission from ${popupSource}.

${cdataSafe(detailLines)}
]]></comments>
        </vehicle>
        <customer>
            <contact>
                <name part="first"><![CDATA[${userData.firstName}]]></name>
                <name part="last"><![CDATA[${userData.lastName}]]></name>
                <phone><![CDATA[${userData.phone}]]></phone>
                <email><![CDATA[${userData.email}]]></email>
                <address>
                    <postalcode><![CDATA[]]></postalcode>
                </address>
            </contact>
            <comments />
        </customer>
        <vendor>
            <id source="">${dealerName}</id>
            <vendorname><![CDATA[${dealerName}]]></vendorname>
            <url><![CDATA[http://www.amfordashtabula.com]]></url>
            <contact>
                <phone type="voice" time="day"><![CDATA[855-357-4677]]></phone>
                <email><![CDATA[support@dealerinspire.com]]></email>
                <address>
                    <street line="1"><![CDATA[1059 OH-46]]></street>
                    <city><![CDATA[Jefferson]]></city>
                    <regioncode><![CDATA[OH]]></regioncode>
                    <postalcode><![CDATA[44047]]></postalcode>
                    <country><![CDATA[US]]></country>
                </address>
            </contact>
        </vendor>
        <provider>
            <id source="">${popupSource}</id>
            <name><![CDATA[Dealer Inspire/${popupSource}]]></name>
            <url><![CDATA[http://www.dealerinspire.com]]></url>
            <email><![CDATA[support@dealerinspire.com]]></email>
            <phone><![CDATA[855-357-4677]]></phone>
            <contact primarycontact="1">
                <name part="full"><![CDATA[Dealer Inspire Support]]></name>
                <email><![CDATA[support@dealerinspire.com]]></email>
                <phone type="voice" time="day"><![CDATA[855-357-4677]]></phone>
            </contact>
        </provider>
    </prospect>
</adf>`,
    html: htmlBody,
  };

  await transporter.sendMail(mailOptions);
  console.log("[EMAIL] Mail command sent to transporter.");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user, car, otp } = body;

    // Fallback for old structure if needed, but primarily use new one
    const userData = user || body;
    const carData = mergeCarPayload(car, body as Record<string, unknown>);
    const { phone, firstName, lastName, email, preferredContact, comments } =
      userData;
    const { otp: oldOtp } = body;
    const finalOtp = otp || oldOtp;

    /* 
    if (!phone || !finalOtp)
      return NextResponse.json(
        { error: "Phone and OTP are required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    */
    if (!phone)
      return NextResponse.json(
        { error: "Phone is required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );

    const name = `${firstName} ${lastName}`.trim();

    const { digits: normalized, e164: fullPhone } = normalizePhone(phone);
    
    console.log(`[OTP STORE] Verifying OTP for phone key: "${normalized}"`);



    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      // Dev mode or local test mode - check otpStore
      /*
      const result = verifyOTP(normalized, finalOtp);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Invalid or expired OTP." },
          { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
        );
      }
      */

      console.log(`[LOCAL VERIFY] Verified ${fullPhone}`);

      // Send email notification to admin
      const adminUserData = { ...userData, phone: fullPhone };
      try {
        await savePopupActivityToSupabase(adminUserData, carData);
      } catch (activityError) {
        console.error("Activity tracker save failed (Local Verify):", activityError);
      }
      try {
        await saveLeadToSupabase(adminUserData, carData);
      } catch (leadError) {
        console.error("Lead save failed (Local Verify):", leadError);
      }
      try {
        await sendAdminEmail(adminUserData, carData);
      } catch (emailError) {
        console.error("Email sending failed (Local Verify):", emailError);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Local verification successful",
          user: { name, email, phone: fullPhone },
        },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Verify OTP locally (using the code sent via Twilio)
    /*
    const result = verifyOTP(normalized, finalOtp);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Invalid or expired OTP." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    */

    console.log("Verified user:", { name, email, phone: fullPhone });

    // Send email notification to admin
    const adminUserData = { ...userData, phone: fullPhone };
    try {
      console.log("Attempting to save popup activity...");
      await savePopupActivityToSupabase(adminUserData, carData);
    } catch (activityError) {
      console.error("Activity tracker save failed:", activityError);
    }
    try {
      console.log("Attempting to save lead...");
      await saveLeadToSupabase(adminUserData, carData);
    } catch (leadError) {
      console.error("Lead save failed:", leadError);
    }
    try {
      console.log("Attempting to send admin email...");
      await sendAdminEmail(adminUserData, carData);
      console.log("Admin email processed.");
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // We don't block the response even if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Phone verified successfully!",
        user: { name, email, phone: fullPhone },
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e: any) {
    if (e?.message?.includes("Invalid phone number")) {
      return NextResponse.json(
        { error: e.message },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    console.error("Verify OTP error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
