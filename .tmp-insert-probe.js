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
    email: null,
    phone: '+19999999999',
    message: 'Vehicle: \nVIN: \nStock: \nPreferred Contact: Call\nPage URL: https://www.amfordashtabula.com/inventory/certified-used-2020-ford-f-150-xlt-4wd-4-door-crew-cab-truck-1ftew1e43lfb36713/\nSource: VDP Unlock\nUser Comments: ',
    vehicle_id: null,
    status: 'new',
    source: 'VDP Unlock',
    sms_consent_checked: false,
    sms_consent_text: 'By requesting Instant Price, you agree that AM Ford of Ashtabula County and its affiliates, and sales professionals may call/text you about your inquiry, which may involve use of automated means and prerecorded/artificial voices. Message/data rates may apply.',
    sms_consent_at: null,
    terms_consent_checked: false,
    terms_consent_text: 'By submitting, you agree to our terms of use and privacy policy.',
    terms_consent_at: null,
    vehicle_snapshot: {
      vin: '',
      price: '',
      stock: '',
      imageUrl: 'https://vehicle-images.carscommerce.inc/8419-110013336/1FTEW1E43LFB36713/7a3155485fbc615d20e0b0cac251b7a9.webp',
      photoUrl: 'https://vehicle-images.carscommerce.inc/8419-110013336/1FTEW1E43LFB36713/7a3155485fbc615d20e0b0cac251b7a9.webp',
      heroImage: 'https://vehicle-images.carscommerce.inc/8419-110013336/1FTEW1E43LFB36713/7a3155485fbc615d20e0b0cac251b7a9.webp',
      embed_page_url: 'https://www.amfordashtabula.com/inventory/certified-used-2020-ford-f-150-xlt-4wd-4-door-crew-cab-truck-1ftew1e43lfb36713/',
      vehicle_heading: '',
      embed_source_param: 'VDP Unlock'
    }
  };
  const { data, error } = await supabase.from('leads').insert(row).select('id');
  if (error) {
    console.error('insert failed:', error.message, error.details || '', error.hint || '');
    process.exit(1);
  }
  const id = data[0].id;
  console.log('insert ok:', id);
  const del = await supabase.from('leads').delete().eq('id', id);
  if (del.error) {
    console.error('cleanup failed:', del.error.message);
    process.exit(1);
  }
  console.log('cleanup ok');
})();
