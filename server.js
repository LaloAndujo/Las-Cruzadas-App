// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const cors = require('cors');

// ===== Modelos
const User = require('./models/User');
const Post = require('./models/Post');     // user: nickname (string), timestamps:true
const Event = require('./models/Event');   // incluye campo 'creador' (nickname)
const Ride = require('./models/Ride');

const app = express();

/* =======================
   CONFIGURACIÓN BÁSICA
======================= */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cruzadas';

mongoose.connect(MONGO_URI, { autoIndex: true })
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Error conectando a MongoDB:', err.message);
    process.exit(1);
  });

// Si vas detrás de proxy (Render, etc.)
app.set('trust proxy', 1);

// Body parsers
app.use(express.urlencoded({ extended: true })); // para forms (post-status)
app.use(express.json());

// CORS opcional (si usas front en otro dominio). Define ORIGIN="https://tudominio.com,https://otro.com"
const allowed = (process.env.ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (allowed.length) {
  app.use(cors({
    origin: allowed,
    credentials: true,
  }));
}

// Sesión
const SESSION_SECRET = process.env.SESSION_SECRET || 'cruzadas_secret';
app.use(session({
  name: 'cruzadas.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'sessions', ttl: 60 * 60 * 24 * 7 }),
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production', // true en prod (HTTPS)
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// Static
app.use(express.static(path.join(__dirname, 'public')));

/* =======================
   HELPERS / MIDDLEWARE
======================= */
function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login.html');
}

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  if (req.accepts('html')) return res.redirect('/login.html');
  return res.status(401).json({ error: 'No autorizado' });
}

async function getUserLite(id) {
  const u = await User.findById(id).lean();
  if (!u) return null;
  return { _id: u._id, nickname: u.nickname, points: u.points ?? 0, profilePic: u.profilePic || null };
}

// Regex seguro (para login case-insensitive en username/nickname)
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Detección robusta: ¿el cliente quiere JSON?
function wantsJSON(req) {
  const a = (req.headers['accept'] || '').toLowerCase();
  const ct = (req.headers['content-type'] || '').toLowerCase();
  return a.includes('application/json') || ct.includes('application/json') || req.xhr === true || 'json' in req.query;
}

// Sistema de puntos
const BASE_POINTS = 5;
const POINTS = {
  POST: BASE_POINTS,
  TAG_PER: 1,
  TAG_MAX: 5,
  LIKE_GIVER: 1,
  EVENT_CREATE: BASE_POINTS * 2,
  PASSENGER: Math.floor(BASE_POINTS / 2),
  DRIVER: BASE_POINTS * 3
};
async function addPoints(userId, amount) {
  if (!amount) return;
  await User.updateOne({ _id: userId }, { $inc: { points: amount } });
}

// DEBUG sesión (opcional)
app.get('/api/_debug/session', (req, res) => {
  res.json({ hasCookie: !!req.headers.cookie, sessionId: req.sessionID, userId: req.session.userId || null, accept:req.headers['accept']||'' });
});

/* =======================
   RUTAS DE AUTENTICACIÓN
======================= */

// Registro
app.post('/register', async (req, res) => {
  try {
    const { username = '', email, password, nickname } = req.body;

    if (!email || !password || !nickname) {
      if (wantsJSON(req)) return res.status(400).json({ error: 'Faltan datos' });
      return res.redirect('/login.html?error=' + encodeURIComponent('Faltan datos'));
    }

    const emailNorm = String(email).trim().toLowerCase();

    // Validaciones de unicidad
    const [byEmail, byNick] = await Promise.all([
      User.findOne({ email: emailNorm }),
      User.findOne({ nickname })
    ]);
    if (byEmail) {
      if (wantsJSON(req)) return res.status(409).json({ error: 'Ese correo ya está en uso' });
      return res.redirect('/login.html?error=' + encodeURIComponent('Ese correo ya está en uso'));
    }
    if (byNick) {
      if (wantsJSON(req)) return res.status(409).json({ error: 'Ese apodo ya está en uso' });
      return res.redirect('/login.html?error=' + encodeURIComponent('Ese apodo ya está en uso'));
    }

    const user = await User.register({ email: emailNorm, password, nickname, username });
    req.session.userId = String(user._id);

    if (!wantsJSON(req)) return res.redirect('/dashboard.html');
    return res.json({ ok: true, redirect: '/dashboard.html' });
  } catch (err) {
    console.error('Error en el registro:', err);
    if (err && err.code === 11000) {
      const msg = err.keyPattern?.email ? 'Ese correo ya está en uso' :
                  err.keyPattern?.nickname ? 'Ese apodo ya está en uso' : 'Duplicado';
      if (wantsJSON(req)) return res.status(409).json({ error: msg });
      return res.redirect('/login.html?error=' + encodeURIComponent(msg));
    }
    if (wantsJSON(req)) return res.status(500).json({ error: 'Error en el registro' });
    return res.redirect('/login.html?error=' + encodeURIComponent('Error en el registro'));
  }
});

// Login (email | username | nickname) + password
app.post('/login', async (req, res) => {
  try {
    const idRaw =
      (req.body.emailOrUser ?? req.body.email ?? req.body.username ?? req.body.nickname ?? '').toString().trim();
    const passRaw =
      (req.body.password ?? req.body.pass ?? req.body.pwd ?? '').toString();

    if (!idRaw || !passRaw) {
      if (wantsJSON(req)) return res.status(400).json({ error: 'Faltan credenciales' });
      return res.redirect('/login.html?error=' + encodeURIComponent('Faltan credenciales'));
    }

    const emailNorm = idRaw.toLowerCase();
    const idRegex = new RegExp(`^${escapeRegex(idRaw)}$`, 'i');

    const user = await User.findOne({
      $or: [
        { email: emailNorm },
        { username: idRegex },
        { nickname: idRegex }
      ]
    }).select('+password +passwordHash');

    if (!user) {
      if (wantsJSON(req)) return res.status(400).json({ error: 'Usuario no encontrado' });
      return res.redirect('/login.html?error=' + encodeURIComponent('Usuario no encontrado'));
    }

    const ok = await user.verifyPassword(passRaw);
    if (!ok) {
      if (wantsJSON(req)) return res.status(400).json({ error: 'Contraseña incorrecta' });
      return res.redirect('/login.html?error=' + encodeURIComponent('Contraseña incorrecta'));
    }

    req.session.userId = String(user._id);

    if (!wantsJSON(req)) return res.redirect('/dashboard.html');
    return res.json({ ok: true, redirect: '/dashboard.html' });
  } catch (err) {
    console.error('Error en el login:', err);
    if (wantsJSON(req)) return res.status(500).json({ error: 'Error en el login' });
    return res.redirect('/login.html?error=' + encodeURIComponent('Error en el login'));
  }
});

// Alias opcional si tu front usa /auth/login
app.post('/auth/login', (req, res, next) => { req.url = '/login'; next(); });

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('cruzadas.sid');
    res.redirect('/login.html');
  });
});

/* =======================
   RUTAS DE USUARIO
======================= */
app.get('/api/user', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json(user);
});

// QR “user info”
app.get('/api/user/qr', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const qrData = `Usuario: ${user.nickname}, ID: ${user._id}`;
    const qrImage = await QRCode.toDataURL(qrData);
    res.json({ qrImage });
  } catch (err) {
    res.status(500).send('Error generando QR');
  }
});

// QR compat con qr.html (usa ?user=nickname)
app.get('/api/generate-qr', async (req, res) => {
  try {
    const nickname = (req.query.user || 'desconocido').trim();
    const qrData = `https://lascruzadas.com/perfil/${encodeURIComponent(nickname)}`;
    const qr = await QRCode.toDataURL(qrData);
    res.json({ qr });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo generar el QR' });
  }
});

/* =======================
   RUTAS DE PÁGINAS (comodines)
======================= */
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/eventos', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'eventos.html'));
});

/* =======================
   RUTAS DE POSTS/FEED (APIs JSON)
======================= */
app.post('/api/posts', isAuthenticated, async (req, res) => {
  try {
    const { content, image, tags } = req.body;
    const user = await User.findById(req.session.userId);
    const post = new Post({
      content,
      image,
      tags,
      user: user.nickname,
      likes: 0,
      likedBy: [],
    });
    await post.save();

    await addPoints(user._id, 10);
    res.json(post);
  } catch (err) {
    res.status(500).send('Error creando post');
  }
});

app.get('/api/posts', isAuthenticated, async (_req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.post('/api/posts/:id/like', isAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const me = await getUserLite(req.session.userId);
    if (!post) return res.status(404).send('Post no encontrado');

    post.likedBy = post.likedBy || [];
    if (!post.likedBy.includes(me.nickname)) {
      post.likes = (post.likes || 0) + 1;
      post.likedBy.push(me.nickname);
      await addPoints(me._id, 1);
      await post.save();
    }
    res.json(post);
  } catch (err) {
    res.status(500).send('Error en like');
  }
});

/* =======================
   RUTAS FEED “COMPAT”
======================= */
app.post('/post-status', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    let tags = [];
    if (typeof req.body.tags === 'string' && req.body.tags.trim() !== '') {
      try { tags = JSON.parse(req.body.tags); } catch { tags = []; }
    }

    const content = String(req.body.content || req.body.status || '').slice(0, 1000);
    if (!content.trim()) return res.status(400).send('El contenido no puede estar vacío');

    await Post.create({ user: me.nickname, content, tags });

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const mañana = new Date(hoy); mañana.setDate(mañana.getDate() + 1);
    const postsHoy = await Post.countDocuments({
      user: me.nickname,
      createdAt: { $gte: hoy, $lt: mañana }
    });

    if (postsHoy <= 3) {
      await addPoints(req.session.userId, POINTS.POST);
      const extraTags = Math.min(POINTS.TAG_MAX, (tags || []).length) * POINTS.TAG_PER;
      if (extraTags > 0) await addPoints(req.session.userId, extraTags);
    }

    res.redirect('/feed.html');
  } catch (e) {
    console.error('Error al publicar:', e);
    res.status(500).send('Error al publicar');
  }
});

app.get('/api/feed', requireAuth, async (_req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 }).limit(30).lean();
  const nicks = [...new Set(posts.map(p => p.user))];
  const users = await User.find({ nickname: { $in: nicks } }, { nickname: 1, points: 1, profilePic: 1 }).lean();
  const byNick = new Map(users.map(u => [u.nickname, u]));
  const enhanced = posts.map(p => {
    const u = byNick.get(p.user);
    return { ...p, points: u?.points ?? 0, profilePic: u?.profilePic ?? null };
  });
  res.json(enhanced);
});

app.post('/like/:postId', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

    post.likedBy = post.likedBy || [];
    if (post.likedBy.includes(me.nickname)) {
      return res.status(400).json({ error: 'Ya diste like' });
    }

    post.likes = (post.likes || 0) + 1;
    post.likedBy.push(me.nickname);
    await post.save();

    await addPoints(req.session.userId, POINTS.LIKE_GIVER);
    res.json({ success: true, newLikes: post.likes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error en like' });
  }
});

// Borrar post propio
app.delete('/api/post/:id', requireAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  if (post.user !== me.nickname) return res.status(403).json({ error: 'No eres el autor' });
  await Post.deleteOne({ _id: post._id });
  res.json({ ok: true });
});

/* =======================
   RUTAS DE EVENTOS
======================= */
app.get('/api/events', requireAuth, async (_req, res) => {
  const events = await Event.find().sort({ fecha: 1 }).lean();
  res.json(events);
});

app.get('/api/events/:id', requireAuth, async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(ev);
});

// Crear evento + puntos al creador
app.post('/api/crear-evento', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    const nombre = (req.body.nombre || req.body.title || '').trim();
    const descripcion = (req.body.descripcion || req.body.description || '').trim();
    const fecha = new Date(req.body.fecha || req.body.date);
    const ubicacion = (req.body.ubicacion || req.body.location || '').trim();

    if (!nombre || !descripcion || !ubicacion || isNaN(fecha.getTime())) {
      if (wantsJSON(req)) return res.status(400).json({ error: 'Faltan campos obligatorios o fecha inválida' });
      return res.status(400).send('Faltan campos obligatorios o fecha inválida');
    }
    if (fecha < new Date()) {
      if (wantsJSON(req)) return res.status(400).json({ error: 'La fecha debe ser futura' });
      return res.status(400).send('La fecha debe ser futura');
    }

    const ev = await Event.create({
      nombre, descripcion, fecha, ubicacion,
      pasajeros: [], conductores: [],
      creador: me.nickname
    });

    await addPoints(req.session.userId, POINTS.EVENT_CREATE);

    if (!wantsJSON(req)) return res.redirect('/eventos');
    res.json({ ok: true, event: ev });
  } catch (e) {
    console.error(e);
    if (wantsJSON(req)) return res.status(500).json({ error: 'Error al crear evento' });
    res.status(500).send('Error al crear evento');
  }
});

// Asistencia manual
app.post('/api/evento/asistencia', requireAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const evento = await Event.findById(req.body.eventoId);
  if (!evento) {
    if (wantsJSON(req)) return res.status(404).json({ error: 'Evento no encontrado' });
    return res.status(404).send('Evento no encontrado');
  }

  if (req.body.modo === 'pasajero') {
    if (!evento.pasajeros.includes(me.nickname)) evento.pasajeros.push(me.nickname);
  } else if (req.body.modo === 'conductor') {
    const ya = (evento.conductores || []).some(c => c.nickname === me.nickname);
    if (!ya) {
      evento.conductores.push({
        nickname: me.nickname,
        auto: req.body.auto || 'N/A',
        lugaresDisponibles: parseInt(req.body.lugaresDisponibles, 10) || 1,
        horaSalida: req.body.horaSalida || '',
        puntoReunion: req.body.puntoReunion || ''
      });
    }
  }

  await evento.save();
  if (!wantsJSON(req)) return res.redirect(`/evento.html?id=${evento._id}`);
  res.json({ ok: true });
});

// Borrar evento (solo creador)
app.delete('/api/event/:id', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
    if (ev.creador !== me.nickname) return res.status(403).json({ error: 'No puedes borrar este evento' });
    await Event.deleteOne({ _id: ev._id });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al borrar evento' });
  }
});

/* =======================
   RUTAS DE RIDES (RAITE)
======================= */
const rideRoutes = require('./routes/rides');
app.use('/api', rideRoutes);   // compat para tu frontend (/api/rides, etc.)

/* =======================
   HEALTH
======================= */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* =======================
   PUERTO
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});

/* =======================
   DEBUG RÁPIDO
======================= */

// Ver DB actual y conteo de usuarios
app.get('/api/_debug/db', async (req, res) => {
  try {
    const conn = mongoose.connection;
    const dbName = conn?.db?.databaseName || null;
    const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cruzadas');
    const masked = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'); // oculta user/pass si hay
    const users = await User.countDocuments();
    res.json({ ok: true, dbName, mongoUri: masked, usersCount: users });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Buscar usuario usando la misma lógica del login
app.get('/api/_debug/users/find', async (req, res) => {
  try {
    const q = String(req.query.i || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'Falta ?i=' });
    const emailNorm = q.toLowerCase();
    const idRegex = new RegExp(`^${escapeRegex(q)}$`, 'i');
    const user = await User.findOne({
      $or: [{ email: emailNorm }, { username: idRegex }, { nickname: idRegex }]
    }).select('email username nickname createdAt');
    res.json({ ok: true, found: !!user, user });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* =======================
   SEED (crear usuario de prueba)
   Seguridad simple: require header X-SEED-KEY igual a process.env.SEED_KEY
======================= */
app.post('/api/_debug/seed', async (req, res) => {
  try {
    if (!process.env.SEED_KEY) return res.status(403).json({ ok:false, error:'SEED deshabilitado (SEED_KEY no definido)' });
    if (req.header('X-SEED-KEY') !== process.env.SEED_KEY) return res.status(403).json({ ok:false, error:'SEED_KEY inválido' });

    const email = (req.body?.email || 'test@cruzadas.com').toLowerCase();
    const password = req.body?.password || '123456';
    const nickname = req.body?.nickname || 'Tester';
    const username = req.body?.username || 'tester';

    const exists = await User.findOne({ $or: [{ email }, { nickname }] });
    if (exists) return res.json({ ok: true, note: 'Usuario ya existía', user: { email: exists.email, nickname: exists.nickname } });

    const user = await User.register({ email, password, nickname, username });
    res.json({ ok: true, created: { id: user._id, email: user.email, nickname: user.nickname } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
