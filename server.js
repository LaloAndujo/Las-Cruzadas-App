// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const QRCode = require('qrcode');
const cors = require('cors');

// ➕ Subida/procesado de avatares
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

const app = express();

/* =======================
   DB
======================= */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cruzadas';
mongoose.connect(MONGO_URI, { autoIndex: true })
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Error MongoDB:', err.message); process.exit(1); });

/* =======================
   MODELOS
======================= */
const User = require('./models/User');

// Post / Event / Ride inline
const postSchema = new mongoose.Schema({
  user: String,
  content: String,
  image: String,
  tags: [String],
  likes: { type: Number, default: 0 },
  likedBy: [String],
}, { timestamps: true });
const Post = mongoose.model('Post', postSchema);

const eventSchema = new mongoose.Schema({
  nombre: String,
  descripcion: String,
  fecha: Date,
  ubicacion: String,
  pasajeros: [String],
  conductores: [{
    nickname: String,
    auto: String,
    lugaresDisponibles: Number,
    horaSalida: String,
    puntoReunion: String
  }],
  creador: String
}, { timestamps: true });
const Event = mongoose.model('Event', eventSchema);

const rideSchema = new mongoose.Schema({
  conductorNick: { type: String, required: true },
  auto: { type: String, default: 'N/A' },
  destino: { type: String, required: true },
  puntoReunion: { type: String, default: '' },
  horaSalida: { type: Date, required: true },
  lugaresTotales: { type: Number, required: true, min: 1 },
  lugaresDisponibles: { type: Number, required: true, min: 0 },
  notas: { type: String, default: '' },
  pasajeros: [String]
}, { timestamps: true });
const Ride = mongoose.model('Ride', rideSchema);

/* =======================
   APP BASE
======================= */
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS opcional
const allowed = (process.env.ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowed.length) app.use(cors({ origin: allowed, credentials: true }));

// Sesión
const SESSION_SECRET = process.env.SESSION_SECRET || 'cruzadas_secret';
app.use(session({
  name: 'cruzadas.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7
  }),
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// Static
app.use(express.static(path.join(__dirname, 'public')));

// ➕ Estáticos para /uploads (avatars)
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_ROOT = path.join(UPLOADS_DIR, 'avatars');
if (!fs.existsSync(AVATARS_ROOT)) fs.mkdirSync(AVATARS_ROOT, { recursive: true });

app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

/* =======================
   HELPERS
======================= */
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function isAuth(req, res, next) {
  if (req.session.userId) return next();
  return res.status(401).json({ error: 'No autorizado' });
}
async function getUserLite(id) {
  const u = await User.findById(id).lean();
  return u ? { _id: u._id, nickname: u.nickname, points: u.points ?? 0, profilePic: u.profilePic || null } : null;
}
async function addPoints(userId, amount) {
  if (!amount) return;
  await User.updateOne({ _id: userId }, { $inc: { points: amount } });
}
const BASE_POINTS = 5;
const POINTS = {
  POST: BASE_POINTS, TAG_PER: 1, TAG_MAX: 5,
  LIKE_GIVER: 1, EVENT_CREATE: BASE_POINTS * 2,
  PASSENGER: Math.floor(BASE_POINTS / 2), DRIVER: BASE_POINTS * 3
};

/* =======================
   AUTH
======================= */
app.post('/register', async (req, res) => {
  try {
    const { username = '', email, password, nickname } = req.body;
    if (!email || !password || !nickname) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const [byEmail, byNick] = await Promise.all([
      User.findOne({ email: emailNorm }),
      User.findOne({ nickname })
    ]);
    if (byEmail) return res.status(409).json({ error: 'Ese correo ya está en uso' });
    if (byNick) return res.status(409).json({ error: 'Ese apodo ya está en uso' });

    const user = await User.register({ email: emailNorm, password, nickname, username });
    req.session.userId = String(user._id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const idRaw = (req.body.emailOrUser ?? req.body.email ?? req.body.username ?? req.body.nickname ?? '').toString().trim();
    const passRaw = (req.body.password ?? req.body.pass ?? req.body.pwd ?? '').toString();
    if (!idRaw || !passRaw) return res.status(400).json({ error: 'Faltan credenciales' });

    const emailNorm = idRaw.toLowerCase();
    const idRegex = new RegExp(`^${escapeRegex(idRaw)}$`, 'i');

    const user = await User.findOne({
      $or: [{ email: emailNorm }, { username: idRegex }, { nickname: idRegex }]
    }).select('+password +passwordHash');

    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    const ok = await user.verifyPassword(passRaw);
    if (!ok) return res.status(400).json({ error: 'Contraseña incorrecta' });

    req.session.userId = String(user._id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error en el login' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('cruzadas.sid'); res.json({ ok: true }); });
});

/* =======================
   USER + QR
======================= */
app.get('/api/user', isAuth, async (req, res) => {
  const u = await User.findById(req.session.userId);
  res.json(u);
});

app.get('/api/user/qr', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const qrData = `Usuario: ${user.nickname}, ID: ${user._id}`;
    const qrImage = await QRCode.toDataURL(qrData);
    res.json({ qrImage });
  } catch { res.status(500).send('Error generando QR'); }
});

app.get('/api/generate-qr', async (req, res) => {
  try {
    const nickname = (req.query.user || 'desconocido').trim();
    const url = `${req.protocol}://${req.get('host')}/perfil/${encodeURIComponent(nickname)}`;
    const qr = await QRCode.toDataURL(url);
    res.json({ qr });
  } catch { res.status(500).json({ error: 'No se pudo generar el QR' }); }
});

/* =======================
   AVATAR (UPLOAD)
======================= */
// ⬆️ 20 MB, acepta HEIC/HEIF de iPhone
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const okTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/heic',
      'image/heif'
    ];
    if (!okTypes.includes(file.mimetype)) {
      return cb(new Error('Solo imágenes: JPG, PNG, WEBP, AVIF o HEIC/HEIF'));
    }
    cb(null, true);
  },
});

// POST /api/profile/avatar  (form-data: avatar=<file>)
app.post('/api/profile/avatar', isAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No recibí archivo' });

    const userId = String(req.session.userId);
    const userDir = path.join(AVATARS_ROOT, userId);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    // Limpia anteriores
    for (const f of (fs.readdirSync(userDir) || [])) {
      try { fs.unlinkSync(path.join(userDir, f)); } catch {}
    }

    const outPath = path.join(userDir, 'avatar.webp');
    await sharp(req.file.buffer)
      .rotate()                                   // respeta EXIF
      .resize(512, 512, { fit: 'cover' })         // cuadrado exacto
      .webp({ quality: 88 })                      // calidad alta/ligera
      .toFile(outPath);

    const publicUrl = `/uploads/avatars/${userId}/avatar.webp`;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    user.profilePic = publicUrl;
    user.avatarUpdatedAt = new Date();
    await user.save();

    res.json({ ok: true, profilePic: publicUrl, avatarUpdatedAt: user.avatarUpdatedAt });
  } catch (e) {
    console.error('Error subiendo avatar:', e);
    res.status(500).json({ error: 'Error subiendo avatar' });
  }
});

/* =======================
   POSTS + FEED
======================= */
app.post('/api/posts', isAuth, async (req, res) => {
  try {
    const { content, image, tags } = req.body;
    const me = await getUserLite(req.session.userId);
    const post = await Post.create({ user: me.nickname, content, image, tags, likes: 0, likedBy: [] });

    await addPoints(me._id, 10);
    res.json(post);
  } catch { res.status(500).send('Error creando post'); }
});

app.get('/api/posts', isAuth, async (_req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.post('/api/posts/:id/like', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Post no encontrado');

    post.likedBy = post.likedBy || [];
    if (!post.likedBy.includes(me.nickname)) {
      post.likes = (post.likes || 0) + 1;
      post.likedBy.push(me.nickname);
      await addPoints(me._id, 1);
      await post.save();
    }
    res.json(post);
  } catch { res.status(500).send('Error en like'); }
});

// Compat para formulario SPA
app.post('/post-status', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    let tags = [];
    if (typeof req.body.tags === 'string' && req.body.tags.trim() !== '') {
      try { tags = JSON.parse(req.body.tags); } catch { tags = []; }
    }

    const content = String(req.body.content || req.body.status || '').slice(0, 1000);
    if (!content.trim()) return res.status(400).send('El contenido no puede estar vacío');

    await Post.create({ user: me.nickname, content, tags });

    // Máx 3 posts con puntos por día
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
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

    res.json({ ok: true });
  } catch (e) {
    console.error('Error al publicar:', e);
    res.status(500).send('Error al publicar');
  }
});

app.get('/api/feed', isAuth, async (_req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 }).limit(30).lean();
  const nicks = [...new Set(posts.map(p => p.user))];
  const users = await User.find(
    { nickname: { $in: nicks } },
    { nickname: 1, points: 1, profilePic: 1, avatarUpdatedAt: 1 }
  ).lean();
  const byNick = new Map(users.map(u => [u.nickname, u]));
  const enhanced = posts.map(p => {
    const u = byNick.get(p.user);
    return {
      ...p,
      points: u?.points ?? 0,
      profilePic: u?.profilePic ?? null,
      avatarUpdatedAt: u?.avatarUpdatedAt ?? null
    };
  });
  res.json(enhanced);
});

app.delete('/api/post/:id', isAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  if (post.user !== me.nickname) return res.status(403).json({ error: 'No eres el autor' });
  await Post.deleteOne({ _id: post._id });
  res.json({ ok: true });
});

/* =======================
   EVENTOS
======================= */
app.get('/api/events', isAuth, async (_req, res) => {
  const events = await Event.find().sort({ fecha: 1 }).lean();
  res.json(events);
});

app.get('/api/events/:id', isAuth, async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(ev);
});

app.post('/api/crear-evento', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    const nombre = (req.body.nombre || req.body.title || '').trim();
    const descripcion = (req.body.descripcion || req.body.description || '').trim();
    const fecha = new Date(req.body.fecha || req.body.date);
    const ubicacion = (req.body.ubicacion || req.body.location || '').trim();

    if (!nombre || !descripcion || !ubicacion || isNaN(fecha.getTime())) {
      return res.status(400).send('Faltan campos obligatorios o fecha inválida');
    }
    if (fecha < new Date()) return res.status(400).send('La fecha debe ser futura');

    const ev = await Event.create({
      nombre, descripcion, fecha, ubicacion,
      pasajeros: [], conductores: [],
      creador: me.nickname
    });

    await addPoints(req.session.userId, POINTS.EVENT_CREATE);
    res.json({ ok: true, event: ev });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al crear evento');
  }
});

app.post('/api/evento/asistencia', isAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const evento = await Event.findById(req.body.eventoId);
  if (!evento) return res.status(404).send('Evento no encontrado');

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
  res.json({ ok: true });
});

app.delete('/api/event/:id', isAuth, async (req, res) => {
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
   🚗 RAITES
======================= */
app.get('/api/rides', isAuth, async (_req, res) => {
  const rides = await Ride.find().sort({ horaSalida: 1 }).lean();
  res.json(rides);
});

app.post('/api/rides', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const auto = (req.body.auto || 'N/A').trim();
    const destino = (req.body.destino || '').trim();
    const puntoReunion = (req.body.puntoReunion || '').trim();
    const horaSalida = new Date(req.body.horaSalida);
    const lugaresTotales = parseInt(req.body.lugaresTotales, 10) || 1;
    const notas = (req.body.notas || '').trim();

    if (!destino || !horaSalida || isNaN(horaSalida.getTime()) || lugaresTotales < 1) {
      return res.status(400).json({ error: 'Datos inválidos para el raite' });
    }
    if (horaSalida < new Date()) return res.status(400).json({ error: 'La hora debe ser futura' });

    const ride = await Ride.create({
      conductorNick: me.nickname,
      auto, destino, puntoReunion, horaSalida,
      lugaresTotales, lugaresDisponibles: lugaresTotales, notas,
      pasajeros: []
    });

    await addPoints(me._id, POINTS.DRIVER);
    res.json({ ok: true, ride });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error creando raite' });
  }
});

app.post('/api/rides/:id/join', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Raite no encontrado' });
    if (ride.conductorNick === me.nickname) return res.status(400).json({ error: 'Eres el conductor' });
    if (ride.lugaresDisponibles <= 0) return res.status(400).json({ error: 'Sin lugares' });
    if (ride.pasajeros.includes(me.nickname)) return res.status(400).json({ error: 'Ya estás en el raite' });

    ride.pasajeros.push(me.nickname);
    ride.lugaresDisponibles = Math.max(0, ride.lugaresDisponibles - 1);
    await ride.save();
    await addPoints(me._id, POINTS.PASSENGER);
    res.json({ ok: true, ride });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al unirse' });
  }
});

app.post('/api/rides/:id/leave', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Raite no encontrado' });

    const idx = ride.pasajeros.indexOf(me.nickname);
    if (idx === -1) return res.status(400).json({ error: 'No estabas en el raite' });

    ride.pasajeros.splice(idx, 1);
    ride.lugaresDisponibles = Math.min(ride.lugaresTotales, ride.lugaresDisponibles + 1);
    await ride.save();
    res.json({ ok: true, ride });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al salir' });
  }
});

app.delete('/api/rides/:id', isAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Raite no encontrado' });
    if (ride.conductorNick !== me.nickname) return res.status(403).json({ error: 'No eres el conductor' });
    await ride.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al borrar raite' });
  }
});

/* =======================
   DEBUG/HEALTH
======================= */
app.get('/api/_debug/session', (req, res) => {
  res.json({ hasCookie: !!req.headers.cookie, sessionId: req.sessionID, userId: req.session.userId || null, accept: req.headers['accept'] || '' });
});
app.get('/api/_debug/db', async (_req, res) => {
  try {
    const conn = mongoose.connection;
    const dbName = conn?.db?.databaseName || null;
    const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cruzadas');
    const masked = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    const users = await User.countDocuments();
    res.json({ ok: true, dbName, mongoUri: masked, usersCount: users });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

/* =======================
   PUERTO
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
