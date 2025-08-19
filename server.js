// server.js (FINAL)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const MongoStore = require('connect-mongo');
const { randomUUID } = require('crypto'); // ✅ nativo, no 'uuid'

const app = express();
const PORT = process.env.PORT || 3000;

/* ===================== DB ===================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🔥 Conectado a MongoDB'))
  .catch(err => console.error('Error de conexión:', err));

/* ===================== Modelos ===================== */
const userSchema = new mongoose.Schema({
  nickname: { type: String, required: true, unique: true, trim: true, index: true },
  password: { type: String, required: true },   // HASH
  points:   { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },
  qrId: { type: String, unique: true, default: randomUUID },
  profilePic: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const Post = require('./models/Post');
const Event = require('./models/Event');
const Ride  = require('./models/Ride');
const PassengerQueue = require('./models/PassengerQueue');

/* ===================== Middlewares base ===================== */
app.set('trust proxy', 1); // Render/Proxies ✅

app.use(helmet({
  contentSecurityPolicy: false,               // no bloquees inline scripts
  crossOriginResourcePolicy: false,
  frameguard: { action: 'sameorigin' }
}));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  name: 'lc.sid',
  secret: process.env.SESSION_SECRET || 'cambia_esto_en_.env',
  resave: false,
  saveUninitialized: false,
  proxy: true,                                // ✅ detrás de proxy
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 60 * 60 * 24 * 7
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true' ? true : false, // 👈 usa .env
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

/* ===================== Helpers ===================== */
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    if (req.accepts('html')) return res.redirect('/');
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

const getUserLite = async id => {
  const u = await User.findById(id).lean();
  return u ? { _id: u._id, nickname: u.nickname, points: u.points, pendingPoints: u.pendingPoints, qrId: u.qrId, profilePic: u.profilePic } : null;
};

/* ===================== HTML ===================== */
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/dashboard',         requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/eventos',           requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/events.html')));
app.get('/evento.html',       requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/evento.html')));
app.get('/feed.html',         requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/feed.html')));
app.get('/crear-evento.html', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/crear-evento.html')));
app.get('/qr.html',           requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/qr.html')));
app.get('/dashboard.html',    requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/events.html',       requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public/events.html')));

// Static DESPUÉS de proteger HTML
app.use(express.static(path.join(__dirname, 'public')));

/* ===================== Auth ===================== */
app.post('/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    if (!nickname || !password) return res.status(400).send('Faltan datos');

    const exists = await User.findOne({ nickname });
    if (exists) return res.status(409).send('Ese apodo ya está en uso. 🧱');

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ nickname, password: hash });
    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al registrar');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    const user = await User.findOne({ nickname });
    if (!user) return res.status(400).send('Datos incorrectos. 🚫');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).send('Datos incorrectos. 🚫');

    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (e) {
    console.error(e);
    res.status(500).send('Error de inicio de sesión');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ===================== Usuario ===================== */
app.get('/api/user', requireAuth, async (req, res) => {
  const u = await getUserLite(req.session.userId);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(u);
});

app.get('/api/user/points', requireAuth, async (req, res) => {
  const u = await getUserLite(req.session.userId);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ points: u.points, pendingPoints: u.pendingPoints });
});

// DEBUG opcional
app.get('/api/_debug/session', (req, res) => {
  res.json({ hasCookie: !!req.headers.cookie, sessionId: req.sessionID, userId: req.session.userId || null });
});

/* ===================== Feed ===================== */
// Publicar estado + sumar puntos (máx 3/día)
app.post('/post-status', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    // Parse seguro de tags
    let tags = [];
    if (typeof req.body.tags === 'string' && req.body.tags.trim() !== '') {
      try { tags = JSON.parse(req.body.tags); } catch { tags = []; }
    }

    const content = String(req.body.status || '').slice(0, 1000);
    if (!content.trim()) return res.status(400).send('El contenido no puede estar vacío');

    await Post.create({ user: me.nickname, content, tags });

    // contar posts de hoy usando createdAt
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const mañana = new Date(hoy); mañana.setDate(mañana.getDate() + 1);
    const postsHoy = await Post.countDocuments({
      user: me.nickname,
      createdAt: { $gte: hoy, $lt: mañana }
    });

    if (postsHoy <= 3) {
      await User.updateOne({ _id: req.session.userId }, { $inc: { points: 5 } });
    }

    res.redirect('/feed.html');
  } catch (e) {
    console.error('Error al publicar:', e);
    res.status(500).send('Error al publicar');
  }
});

app.get('/api/feed', async (_req, res) => {
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

  res.json({ success: true, newLikes: post.likes });
});

/* ===================== QR ===================== */
app.get('/api/my-qr', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const payload = JSON.stringify({ t: 'cruzadas-qr', id: me.qrId, n: me.nickname });
    const dataUrl = await QRCode.toDataURL(payload);
    res.json({ dataUrl, qrId: me.qrId, nickname: me.nickname });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo generar el QR' });
  }
});

// Compat
app.get('/api/generate-qr', async (req, res) => {
  const nickname = (req.query.user || 'desconocido').trim();
  const qrData = `https://lascruzadas.com/perfil/${encodeURIComponent(nickname)}`;
  const qrImage = await QRCode.toDataURL(qrData);
  res.json({ qr: qrImage });
});

/* ===================== Eventos ===================== */
app.get('/api/events', async (_req, res) => {
  const events = await Event.find().sort({ fecha: 1 }).lean();
  res.json(events);
});

app.get('/api/events/:id', async (req, res) => {
  const event = await Event.findById(req.params.id).lean();
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(event);
});

app.post('/api/crear-evento', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, fecha, ubicacion } = req.body;
    if (!nombre || !descripcion || !fecha || !ubicacion) return res.status(400).send('Faltan campos obligatorios');

    const when = new Date(fecha);
    if (isNaN(when.getTime())) return res.status(400).send('Fecha inválida');
    if (when < new Date()) return res.status(400).send('La fecha debe ser futura');

    const ev = await Event.create({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fecha: when,
      ubicacion: ubicacion.trim(),
      pasajeros: [],
      conductores: []
    });

    if (req.accepts('html')) return res.redirect('/eventos');
    res.json({ ok: true, event: ev });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al crear evento');
  }
});

app.post('/api/evento/asistencia', requireAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const evento = await Event.findById(req.body.eventoId);
  if (!evento) return res.status(404).send('Evento no encontrado');

  if (req.body.modo === 'pasajero') {
    if (!evento.pasajeros.includes(me.nickname)) evento.pasajeros.push(me.nickname);
  } else if (req.body.modo === 'conductor') {
    const ya = evento.conductores.some(c => c.nickname === me.nickname);
    if (!ya) {
      evento.conductores.push({
        nickname: me.nickname,
        auto: req.body.auto,
        lugaresDisponibles: parseInt(req.body.lugaresDisponibles, 10),
        horaSalida: req.body.horaSalida,
        puntoReunion: req.body.puntoReunion
      });
    }
  }

  await evento.save();
  if (req.accepts('html')) return res.redirect(`/evento.html?id=${evento._id}`);
  res.json({ ok: true });
});

/* ===================== Rides ===================== */
app.post('/api/rides', requireAuth, async (req, res) => {
  try {
    const { eventoId, espaciosDisponibles, puntoSalida, horarioSalida } = req.body;
    if (!eventoId) return res.status(400).json({ error: 'Falta eventoId' });

    const ride = await Ride.createWithSeats({
      conductorId: req.session.userId,
      eventoId,
      espacios: espaciosDisponibles,
      puntoSalida,
      horarioSalida
    });

    res.json({ mensaje: 'Ride creado', ride });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Error creando ride' });
  }
});

app.post('/api/fila-pasajeros', requireAuth, async (req, res) => {
  const { eventoId } = req.body;
  const yaEnFila = await PassengerQueue.findOne({ userId: req.session.userId, eventoId, estado: 'en_espera' });
  if (yaEnFila) return res.status(400).json({ error: 'Ya estás en la fila de este evento' });

  await PassengerQueue.create({ userId: req.session.userId, eventoId });
  res.json({ mensaje: 'Agregado a la fila' });
});

app.get('/api/rides-disponibles/:eventoId', async (req, res) => {
  try {
    const eventoId = req.params.eventoId;
    const list = await Ride.listAvailableByEvent(eventoId);

    const conductorIds = [...new Set(list.map(r => String(r.conductorId)))];
    const conductores = await User.find({ _id: { $in: conductorIds } }, { nickname: 1 }).lean();
    const byId = new Map(conductores.map(u => [String(u._id), u.nickname]));

    const out = list.map(r => ({
      ...r,
      conductorId: { _id: r.conductorId, nickname: byId.get(String(r.conductorId)) || 'Conductor' }
    }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron cargar los rides' });
  }
});

app.post('/api/seleccionar-asiento', requireAuth, async (req, res) => {
  try {
    const { rideId, lugar } = req.body;
    const seatNum = parseInt(lugar, 10);
    if (!rideId || !Number.isInteger(seatNum) || seatNum <= 0) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const result = await Ride.bookSeat(rideId, req.session.userId, seatNum);
    if (!result.ok) {
      const msg = result.reason === 'ocupado_o_inexistente' ? 'Asiento ocupado' : 'No se pudo reservar';
      return res.status(400).json({ error: msg });
    }

    await PassengerQueue.findOneAndUpdate(
      { userId: req.session.userId, eventoId: result.ride.eventoId },
      { estado: 'asignado' }
    );

    res.json({ mensaje: 'Asiento reservado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al reservar asiento' });
  }
});

app.get('/api/rides-feed', async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const events = await Event.find({ fecha: { $gte: since } }, { nombre: 1 }).lean();
    const map = new Map(events.map(e => [String(e._id), e.nombre]));

    const rides = await Ride.find({ eventoId: { $in: [...map.keys()] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('conductorId', 'nickname')
      .lean();

    const data = rides.map(r => ({
      _id: r._id,
      eventoId: r.eventoId,
      eventoNombre: map.get(String(r.eventoId)) || 'Evento',
      conductorId: r.conductorId,
      conductor: r.conductorId?.nickname,
      puntoSalida: r.puntoSalida,
      horarioSalida: r.horarioSalida,
      asientos: r.asientos,
      createdAt: r.createdAt
    }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron cargar los rides' });
  }
});

/* ===================== Server ===================== */
app.listen(PORT, () => console.log(`🟢 Servidor corriendo en el puerto ${PORT}`));
