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
  console.error('Polling error:', error.message);
});

// ─── /start ───
bot.onText(/\/start/, (msg) => {
  console.log('Comando /start de:', msg.chat.id);
  bot.sendMessage(msg.chat.id,
    `👋 Hola ${msg.from.first_name}! Soy tu agenda veterinaria SRB.\n\n` +
    `✍️ Escribime la tarea directamente\n\n` +
    `Ejemplo: _Visita La Esperanza el 10 de junio a las 9hs_\n\n` +
    `📋 /tareas — pendientes\n` +
    `📅 /hoy — tareas de hoy\n` +
    `📅 /manana — tareas de mañana\n` +
    `❓ /ayuda — más opciones`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /tareas ───
bot.onText(/\/tareas/, async (msg) => {
  const tareas = await cargarTareas('completada=eq.false');
  if (!tareas.length) {
    bot.sendMessage(msg.chat.id, '✅ No tenés tareas pendientes.');
    return;
  }
  let texto = '📋 *Tareas pendientes:*\n\n';
  tareas.forEach((t, i) => {
    const fecha = t.fecha ? `📅 ${t.fecha.split('-').reverse().join('/')}` : '';
    const hora = t.hora ? ` 🕐 ${t.hora}` : '';
    const lugar = t.lugar ? `\n📍 ${t.lugar}` : '';
    texto += `*${i+1}.* ${t.titulo}\n${fecha}${hora}${lugar}\n/completar_${t.id}\n\n`;
  });
  bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
});

// ─── /hoy ───
bot.onText(/\/hoy/, async (msg) => {
  const hoy = new Date().toISOString().split('T')[0];
  const tareas = await cargarTareas(`completada=eq.false&fecha=eq.${hoy}`);
  if (!tareas.length) {
    bot.sendMessage(msg.chat.id, '📭 No tenés tareas para hoy.');
    return;
  }
  let texto = '📅 *Tareas de hoy:*\n\n';
  tareas.forEach((t, i) => {
    const hora = t.hora ? ` 🕐 ${t.hora}` : '';
    const lugar = t.lugar ? `\n📍 ${t.lugar}` : '';
    texto += `*${i+1}.* ${t.titulo}${hora}${lugar}\n/completar_${t.id}\n\n`;
  });
  bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
});

// ─── /manana ───
bot.onText(/\/manana/, async (msg) => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const str = manana.toISOString().split('T')[0];
  const tareas = await cargarTareas(`completada=eq.false&fecha=eq.${str}`);
  if (!tareas.length) {
    bot.sendMessage(msg.chat.id, '📭 No tenés tareas para mañana.');
    return;
  }
  let texto = '📅 *Tareas de mañana:*\n\n';
  tareas.forEach((t, i) => {
    const hora = t.hora ? ` 🕐 ${t.hora}` : '';
    const lugar = t.lugar ? `\n📍 ${t.lugar}` : '';
    texto += `*${i+1}.* ${t.titulo}${hora}${lugar}\n/completar_${t.id}\n\n`;
  });
  bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
});

// ─── /completar ───
bot.onText(/\/completar_(.+)/, async (msg, match) => {
  await completarTarea(match[1]);
  bot.sendMessage(msg.chat.id, `✅ Tarea completada.`, { parse_mode: 'Markdown' });
});

// ─── /ayuda ───
bot.onText(/\/ayuda/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *Comandos:*\n\n` +
    `/tareas — pendientes\n` +
    `/hoy — tareas de hoy\n` +
    `/manana — tareas de mañana\n` +
    `/ayuda — esta ayuda\n\n` +
    `*Para agregar escribí:*\n` +
    `_Visita estancia La Pampeana el martes 15 a las 10hs_`,
    { parse_mode: 'Markdown' }
  );
});

// ─── MENSAJES DE TEXTO ───
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  console.log('Mensaje:', msg.text);
  await procesarTexto(msg.chat.id, msg.text);
});

// ─── PROCESAR TEXTO ───
async function procesarTexto(chatId, texto) {
  const hoy = new Date();
  let fecha = null;
  let hora = null;

  const meses = {
    enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
    julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
  };

  const matchFecha = texto.match(/el\s+(\d{1,2})\s+de\s+(\w+)/i);
  if (matchFecha) {
    const dia = parseInt(matchFecha[1]);
    const mes = meses[matchFecha[2].toLowerCase()];
    if (mes) {
      fecha = `${hoy.getFullYear()}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    }
  }

  if (!fecha) {
    if (/\bhoy\b/i.test(texto)) fecha = hoy.toISOString().split('T')[0];
    else if (/\bma[ñn]ana\b/i.test(texto)) {
      const m = new Date(hoy); m.setDate(m.getDate()+1);
      fecha = m.toISOString().split('T')[0];
    } else if (/\bpasado\b/i.test(texto)) {
      const p = new Date(hoy); p.setDate(p.getDate()+2);
      fecha = p.toISOString().split('T')[0];
    }
  }

  const matchHora = texto.match(/a\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(?:hs?|horas?)?/i);
  if (matchHora) {
    const h = parseInt(matchHora[1]);
    if (h >= 6 && h <= 22) {
      hora = `${String(h).padStart(2,'0')}:${matchHora[2] || '00'}`;
    }
  }

  let tipo = 'administrativo';
  if (/visita|establecimiento|estancia|campo|rancho/i.test(texto)) tipo = 'visita';
  else if (/vacun|medicament|inyect|dosis|antiaft|ivermec/i.test(texto)) tipo = 'medicamento';
  else if (/turno|reuni[oó]n|cita|llamada/i.test(texto)) tipo = 'turno';
  else if (/IATF|inseminaci[oó]n|reprod/i.test(texto)) tipo = 'fecha';

  let lugar = '';
  const matchLugar = texto.match(/(?:estancia|establecimiento|campo)\s+([A-ZÁÉÍÓÚa-záéíóú][a-záéíóú\s]+?)(?:\s+el|\s+a\s+las|\s*$)/i);
  if (matchLugar) lugar = matchLugar[1].trim();

  const tarea = {
    id: generarId(),
    titulo: texto.length > 80 ? texto.substring(0, 80) + '...' : texto,
    tipo,
    fecha: fecha || null,
    hora: hora || null,
    lugar: lugar || null,
    notas: texto,
    completada: false,
    rec1d: false,
    rec2d: false
  };

  await guardarTarea(tarea);

  const fechaStr = fecha ? `📅 ${fecha.split('-').reverse().join('/')}` : '📅 Sin fecha';
  const horaStr = hora ? ` 🕐 ${hora}` : '';
  const lugarStr = lugar ? `\n📍 ${lugar}` : '';
  const tipos = { visita:'🏡 Visita', medicamento:'💉 Medicamento', turno:'📅 Turno', administrativo:'📋 Admin', fecha:'🔖 Fecha' };

  bot.sendMessage(chatId,
    `✅ *Tarea guardada:*\n\n` +
    `📌 ${tarea.titulo}\n` +
    `${fechaStr}${horaStr}${lugarStr}\n` +
    `🏷 ${tipos[tipo]}\n\n` +
    `Ver todas: /tareas`,
    { parse_mode: 'Markdown' }
  );
}

// ─── RECORDATORIOS ───
async function verificarRecordatorios() {
  if (!CHAT_ID) return;
  console.log('Verificando recordatorios...');
  const tareas = await cargarTareas('completada=eq.false');
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));


  for (const t of tareas) {
    if (!t.fecha) continue;
    const fechaTarea = new Date(t.fecha + 'T12:00:00');
    const diffDias = Math.floor((fechaTarea - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias === 1 && !t.rec1d) {
      await bot.sendMessage(CHAT_ID,
        `🔔 *Recordatorio — mañana:*\n\n📌 ${t.titulo}\n📅 ${t.fecha.split('-').reverse().join('/')}${t.hora ? ' 🕐 ' + t.hora : ''}${t.lugar ? '\n📍 ' + t.lugar : ''}`,
        { parse_mode: 'Markdown' }
      );
      await marcarRecordatorio(t.id, 'rec1d');
    }

    if (diffDias === 2 && !t.rec2d) {
      await bot.sendMessage(CHAT_ID,
        `🔔 *Recordatorio — en 2 días:*\n\n📌 ${t.titulo}\n📅 ${t.fecha.split('-').reverse().join('/')}${t.hora ? ' 🕐 ' + t.hora : ''}${t.lugar ? '\n📍 ' + t.lugar : ''}`,
        { parse_mode: 'Markdown' }
      );
      await marcarRecordatorio(t.id, 'rec2d');
    }
  }
}

setInterval(verificarRecordatorios, 60 * 60 * 1000);
setTimeout(verificarRecordatorios, 5000);
