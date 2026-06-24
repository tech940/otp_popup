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
  const { data, error } = await supabase.from('popup_activity_tracker').select('id,created_at,first_name,last_name,phone,email,embed_source,vin,stock,vehicle_title,metadata').order('created_at', { ascending: false }).limit(3);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
