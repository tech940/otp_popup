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
  const { data, error } = await supabase.from('leads').select('id,name,phone,source,vehicle_id,created_at').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error(error.message, error.details || '', error.hint || '');
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
})();
