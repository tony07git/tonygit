const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const RESERVAS_PATH = path.join(DATA_DIR, 'reservas.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const ADMIN_USER = 'plazoleta';
const ADMIN_PASSWORD = 'plazoletakids';
const ADMIN_TOKEN = crypto.createHash('sha256').update(`${ADMIN_USER}:${ADMIN_PASSWORD}`).digest('hex');

const OPEN_HOUR = 12;
const CLOSE_HOUR = 20;
const DURATION_HOURS = 3;

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RESERVAS_PATH)) fs.writeFileSync(RESERVAS_PATH, JSON.stringify({ reservas: [] }, null, 2));
}

function readReservas() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(RESERVAS_PATH, 'utf-8'));
}

function writeReservas(data) {
  fs.writeFileSync(RESERVAS_PATH, JSON.stringify(data, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function isValidDate(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

function getAvailableStartHours() {
  const last = CLOSE_HOUR - DURATION_HOURS;
  const slots = [];
  for (let h = OPEN_HOUR; h <= last; h += 1) slots.push(h);
  return slots;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isSlotAvailable(reservas, fecha, horaInicio) {
  const start = Number(horaInicio);
  const end = start + DURATION_HOURS;
  return !reservas.some((r) => {
    if (r.fecha !== fecha) return false;
    const existingStart = Number(r.horaInicio);
    const existingEnd = existingStart + DURATION_HOURS;
    return overlaps(start, end, existingStart, existingEnd);
  });
}

function isAuthorized(req) {
  const auth = req.headers.authorization || '';
  return auth.replace('Bearer ', '').trim() === ADMIN_TOKEN;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (pathname === '/admin') filePath = '/admin.html';
  const resolved = path.join(PUBLIC_DIR, filePath);
  if (!resolved.startsWith(PUBLIC_DIR) || !fs.existsSync(resolved)) return false;

  const ext = path.extname(resolved).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  }[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = parsed;

    if (req.method === 'GET' && pathname === '/api/config') {
      return sendJson(res, 200, {
        duracionHoras: DURATION_HOURS,
        valorReserva: 180000,
        valorSena: 80000,
        ubicacion: 'Avenida Sarmiento 1389',
        whatsapp: '3814095236',
        horario: { apertura: OPEN_HOUR, cierre: CLOSE_HOUR },
      });
    }

    if (req.method === 'GET' && pathname === '/api/slots') {
      const fecha = parsed.searchParams.get('fecha');
      if (!fecha || !isValidDate(fecha)) return sendJson(res, 400, { error: 'Fecha inválida. Formato YYYY-MM-DD' });
      const data = readReservas();
      const slots = getAvailableStartHours().map((hour) => ({ hora: hour, disponible: isSlotAvailable(data.reservas, fecha, hour) }));
      return sendJson(res, 200, { fecha, slots });
    }

    if (req.method === 'POST' && pathname === '/api/reservas') {
      const body = await parseBody(req);
      const { nombre, telefono, fecha, horaInicio, notas } = body;
      if (!nombre || !telefono || !fecha || horaInicio === undefined) return sendJson(res, 400, { error: 'Completa todos los campos obligatorios.' });
      if (!isValidDate(fecha)) return sendJson(res, 400, { error: 'Fecha inválida.' });
      const hour = Number(horaInicio);
      if (!Number.isInteger(hour) || !getAvailableStartHours().includes(hour)) return sendJson(res, 400, { error: 'Horario fuera de rango.' });

      const data = readReservas();
      if (!isSlotAvailable(data.reservas, fecha, hour)) return sendJson(res, 409, { error: 'Ese horario ya está ocupado o bloqueado por 3 horas.' });

      const reserva = {
        id: crypto.randomUUID(),
        nombre: String(nombre).trim(),
        telefono: String(telefono).trim(),
        fecha,
        horaInicio: hour,
        horaFin: hour + DURATION_HOURS,
        notas: notas ? String(notas).trim() : '',
        total: 180000,
        sena: 80000,
        creadaEn: new Date().toISOString(),
      };
      data.reservas.push(reserva);
      data.reservas.sort((a, b) => `${a.fecha}-${a.horaInicio}`.localeCompare(`${b.fecha}-${b.horaInicio}`));
      writeReservas(data);
      return sendJson(res, 201, { reserva });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await parseBody(req);
      if (body.usuario === ADMIN_USER && body.password === ADMIN_PASSWORD) return sendJson(res, 200, { token: ADMIN_TOKEN, usuario: ADMIN_USER });
      return sendJson(res, 401, { error: 'Credenciales inválidas' });
    }

    if (req.method === 'GET' && pathname === '/api/reservas') {
      if (!isAuthorized(req)) return sendJson(res, 401, { error: 'No autorizado' });
      return sendJson(res, 200, readReservas());
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/reservas/')) {
      if (!isAuthorized(req)) return sendJson(res, 401, { error: 'No autorizado' });
      const id = pathname.split('/').pop();
      const data = readReservas();
      const next = data.reservas.filter((r) => r.id !== id);
      if (next.length === data.reservas.length) return sendJson(res, 404, { error: 'Reserva no encontrada' });
      data.reservas = next;
      writeReservas(data);
      return sendJson(res, 200, { ok: true });
    }

    if (serveStatic(req, res, pathname)) return;

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    sendJson(res, 500, { error: 'Error interno del servidor' });
  }
});

ensureDataFile();
server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
