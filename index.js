const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('ERROR: BOT_TOKEN no definido');
  process.exit(1);
}
console.log('Token cargado OK, iniciando bot...');

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🐄 Bot SRB iniciado correctamente');

const DB_FILE = 'tareas.json';

function cargarTareas() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {
    return [];
  }
}

function guardarTareas(tareas) {
  fs.writeFileSync(DB_FILE, JSON.stringify(tareas, null, 2));
}

function generarId() {
  return Date.now().toString();
}

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

bot.onText(/\/start/, (msg) => {
  console.log('Comando /start recibido de:', msg.chat.id);
  const nombre = msg.from.first_name;
  bot.sendMessage(msg.chat.id,
    `👋 Hola ${nombre}! Soy tu agenda veterinaria SRB.\n\n` +
    `Podés:\n` +
    `✍️ Escribirme la tarea directamente\n\n` +
    `Ejemplo: _Visita La Esperanza el 10 de junio a las 9hs_\n\n` +
    `📋 /tareas — ver tareas pendientes\n` +
    `📅 /hoy — tareas de hoy\n` +
    `📅 /manana — tareas de mañana\n` +
    `❓ /ayuda — más opciones`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/tareas/, (msg) => {
  console.log('Comando /tareas recibido');
  const tareas = cargarTareas().filter(t => !t.completada);
  if (!tareas.length) {
    bot.sendMessage(msg.chat.id, '✅ No tenés tareas pendientes.');
    return;
  }
  tareas.sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  let texto = '📋 *Tareas pendientes:*\n\n';
  tareas.forEach((t, i) => {
    const fecha = t.fecha ? `📅 ${t.fecha}` : '';
    const hora = t.hora ? ` 🕐 ${t.hora}` : '';
    const lugar = t.lugar ? `\n📍 ${t.lugar}` : '';
    texto += `*${i+1}.* ${t.titulo}\n${fecha}${hora}${lugar}\n/completar_${t.id}\n\n`;
  });
  bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
});

bot.onText(/\/completar_(.+)/, (msg, match) => {
  const id = match[1];
  const tareas = cargarTareas();
  const t = tareas.find(x => x.id === id);
  if (t) {
    t.completada = true;
    guardarTareas(tareas);
    bot.sendMessage(msg.chat.id, `✅ Tarea completada: *${t.titulo}*`, { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/hoy/, (msg) => {
  const hoy = new Date().toISOString().split('T')[0];
  const tareas = cargarTareas().filter(t => t.fecha === hoy && !t.completada);
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

bot.onText(/\/manana/, (msg) => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const str = manana.toISOString().split('T')[0];
  const tareas = cargarTareas().filter(t => t.fecha === str && !t.completada);
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

bot.onText(/\/ayuda/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *Comandos:*\n\n` +
    `/tareas — pendientes\n` +
    `/hoy — tareas de hoy\n` +
    `/manana — tareas de mañana\n` +
    `/ayuda — esta ayuda\n\n` +
    `*Para agregar una tarea escribí:*\n` +
    `_Visita estancia La Pampeana el martes 15 a las 10hs_`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('message', async (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;
  console.log('Mensaje recibido:', msg.text);
  await procesarTexto(msg.chat.id, msg.text);
});

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
      const anio = hoy.getFullYear();
      fecha = `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    }
  }

  if (!fecha) {
    if (/\bhoy\b/i.test(texto)) {
      fecha = hoy.toISOString().split('T')[0];
    } else if (/\bma[ñn]ana\b/i.test(texto)) {
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
      const min = matchHora[2] || '00';
      hora = `${String(h).padStart(2,'0')}:${min}`;
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
    fecha: fecha || '',
    hora: hora || '',
    lugar,
    notas: texto,
    completada: false,
    creadaEn: new Date().toISOString()
  };

  const tareas = cargarTareas();
  tareas.push(tarea);
  guardarTareas(tareas);

  const fechaStr = fecha ? `📅 ${fecha.split('-').reverse().join('/')}` : '📅 Sin fecha asignada';
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

function verificarRecordatorios() {
  console.log('Verificando recordatorios...');
  const tareas = cargarTareas().filter(t => !t.completada && t.fecha);
  const hoy = new Date();
  const CHAT_ID = process.env.CHAT_ID;
  if (!CHAT_ID) return;

  let modificado = false;
  tareas.forEach(t => {
    const fechaTarea = new Date(t.fecha + 'T12:00:00');
    const diffMs = fechaTarea - hoy;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 1 && !t.rec1d) {
      bot.sendMessage(CHAT_ID,
        `🔔 *Recordatorio — mañana:*\n\n📌 ${t.titulo}\n📅 ${t.fecha.split('-').reverse().join('/')}${t.hora ? ' 🕐 ' + t.hora : ''}${t.lugar ? '\n📍 ' + t.lugar : ''}`,
        { parse_mode: 'Markdown' }
      );
      t.rec1d = true;
      modificado = true;
    }

    if (diffDias === 2 && !t.rec2d) {
      bot.sendMessage(CHAT_ID,
        `🔔 *Recordatorio — en 2 días:*\n\n📌 ${t.titulo}\n📅 ${t.fecha.split('-').reverse().join('/')}${t.hora ? ' 🕐 ' + t.hora : ''}${t.lugar ? '\n📍 ' + t.lugar : ''}`,
        { parse_mode: 'Markdown' }
      );
      t.rec2d = true;
      modificado = true;
    }
  });

  if (modificado) guardarTareas(tareas);
}

setInterval(verificarRecordatorios, 60 * 60 * 1000);
setTimeout(verificarRecordatorios, 5000);
