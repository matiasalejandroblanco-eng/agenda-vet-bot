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
  console.log('Comando /start rec

