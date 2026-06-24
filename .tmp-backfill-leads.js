const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
function pick(name) {
  const line = env.split(/\r?\n/).find((row) => row.indexOf(name + '=') === 0);
  if (!line) return '';
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, '').replace(/\r|\n/g, '');
}
function buildMessage(tracker) {
  const meta = tracker.metadata || {};
  const snap = meta.vehicleSnapshot || {};
  const title = tracker.vehicle_title || snap.vehicle_heading || snap.listing_title || '';
  const vin = tracker.vin || snap.vin || '';
  const stock = tracker.stock || snap.stock || '';
  const preferred = meta.preferredContact || 'Any';
  const smsChecked = meta.smsConsentChecked ? 'Yes' : 'No';
  const smsAt = meta.smsConsentAt || '';
  const smsText = meta.smsConsentText || '';
  const termsChecked = meta.termsConsentChecked ? 'Yes' : 'No';
  const termsAt = meta.termsConsentAt || '';
  const termsText = meta.termsConsentText || '';
  const pageUrl = tracker.page_url || snap.embed_page_url || '';
  const source = tracker.embed_source || '';
  const comments = meta.comments || '';
  return [
    'Vehicle: ' + title,
    'VIN: ' + vin,
    'Stock: ' + stock,
    'Preferred Contact: ' + preferred,
    'SMS Consent Checked: ' + smsChecked,
    'SMS Consent Timestamp: ' + smsAt,
    'SMS Consent Copy: ' + smsText,
    'Terms Consent Checked: ' + termsChecked,
    'Terms Consent Timestamp: ' + termsAt,
    'Terms Consent Copy: ' + termsText,
    'Page URL: ' + pageUrl,
    'Source: ' + source,
    'User Comments: ' + comments
  ].join('\n');
}
const url = pick('SUPABASE_URL') || pick('NEXT_PUBLIC_SUPABASE_URL');
const key = pick('SUPABASE_SERVICE_ROLE_KEY');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);
(async () => {
  const trackerRes = await supabase.from('popup_activity_tracker').select('*').order('created_at', { ascending: false }).limit(50);
  if (trackerRes.error) throw trackerRes.error;
  const leadsRes = await supabase.from('leads').select('id,phone,source,created_at').order('created_at', { ascending: false }).limit(300);
  if (leadsRes.error) throw leadsRes.error;
  const trackers = trackerRes.data || [];
  const leads = leadsRes.data || [];
  const inserted = [];
  for (const tracker of trackers) {
    const tTime = new Date(tracker.created_at).getTime();
    const match = leads.find((lead) => {
      if ((lead.phone || '') !== (tracker.phone || '')) return false;
      if ((lead.source || '') !== (tracker.embed_source || '')) return false;
      const diff = Math.abs(new Date(lead.created_at).getTime() - tTime);
      return diff <= 5 * 60 * 1000;
    });
    if (match) continue;

    const meta = tracker.metadata || {};
    const row = {
      name: ((tracker.first_name || '') + ' ' + (tracker.last_name || '')).replace(/\s+/g, ' ').trim() || 'Customer',
      email: tracker.email || '',
      phone: tracker.phone || '',
      message: buildMessage(tracker),
      vehicle_id: null,
      status: 'new',
      source: tracker.embed_source || 'VDP Unlock',
      sms_consent_checked: !!meta.smsConsentChecked,
      sms_consent_text: meta.smsConsentText || '',
      sms_consent_at: meta.smsConsentAt || null,
      terms_consent_checked: !!meta.termsConsentChecked,
      terms_consent_text: meta.termsConsentText || '',
      terms_consent_at: meta.termsConsentAt || null,
      vehicle_snapshot: meta.vehicleSnapshot || null,
    };
    const ins = await supabase.from('leads').insert(row).select('id,created_at');
    if (ins.error) {
      console.error('backfill failed for tracker', tracker.id, ins.error.message, ins.error.details || '', ins.error.hint || '');
      continue;
    }
    inserted.push({ trackerId: tracker.id, leadId: ins.data[0].id, phone: tracker.phone, source: tracker.embed_source });
  }
  console.log(JSON.stringify(inserted, null, 2));
})();
