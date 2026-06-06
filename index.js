const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

const TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CHAT_ID = process.env.CHAT_ID;

if (!TOKEN) { console.error('ERROR: BOT_TOKEN no definido'); process.exit(1); }
if (!SUPABASE_URL) { console.error('ERROR: SUPABASE_URL no definido'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('ERROR: SUPABASE_KEY no definido'); process.exit(1); }

console.log('Variables cargadas OK, iniciando bot...');
const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🐄 Bot SRB iniciado correctamente');

// ─── SUPABASE HELPER ───
function supabase(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : ''
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function cargarTareas(filtro = '') {
  const path = 'tareas?order=fecha.asc' + (filtro ? '&' + filtro : '');
  const result = await supabase('GET', path);
  return Array.isArray(result) ? result : [];
}

async function guardarTarea(tarea) {
  return await supabase('POST', 'tareas', tarea);
}

async function completarTarea(id) {
  return await supabase('PATCH', `tareas?id=eq.${id}`, { completada: true });
}

async function marcarRecordatorio(id, campo) {
  return await supabase('PATCH', `tareas?id=eq.${id}`, { [campo]: true });
}

function generarId() {
  return Date.now().toString();
}

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.
