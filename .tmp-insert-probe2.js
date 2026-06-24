const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
function pick(name) {
  const line = env.split(/\r?\n/).find((row) => row.indexOf(name + '=') === 0);
  if (!line) return '';
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, '').replace(/\r|\n/g, '');
}
const url = pick('SUPABASE_URL') || pick('NEXT_PUBLIC_SUPABASE_URL');
const key = pick('SUPABASE_SERVICE_ROLE_KEY');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);
(async () => {
  const row = {
    name: 'Codex Insert Probe',
    email: '',
    phone: '+19999999999',
    message: 'probe',
    vehicle_id: null,
    status: 'new',
    source: 'VDP Unlock',
    sms_consent_checked: false,
    sms_consent_text: 'probe',
    sms_consent_at: null,
    terms_consent_checked: false,
    terms_consent_text: 'probe',
    terms_consent_at: null,
    vehicle_snapshot: null
  };
  const { data, error } = await supabase.from('leads').insert(row).select('id');
  if (error) { console.error('insert failed:', error.message, error.details || '', error.hint || ''); process.exit(1); }
  const id = data[0].id;
  console.log('insert ok:', id);
  const del = await supabase.from('leads').delete().eq('id', id);
  if (del.error) { console.error('cleanup failed:', del.error.message); process.exit(1); }
  console.log('cleanup ok');
})();
