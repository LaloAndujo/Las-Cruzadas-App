// server.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');

// ===== Modelos
const User = require('./models/User');
const Post = require('./models/Post');     // user: nickname (string), timestamps:true
const Event = require('./models/Event');   // incluye campo 'creador' (nickname)
const Ride = require('./models/Ride');

const app = express();

// =======================
// CONFIGURACIÓN BÁSICA
// =======================
mongoose.connect('mongodb://127.0.0.1:27017/cruzadas', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.set('trust proxy', 1);

// Body parsers
app.use(express.urlencoded({ extended: true })); // para forms (post-status)
app.use(express.json());

// Sesión
app.use(session({
  secret: 'cruzadas_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/cruzadas' }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// Static
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// HELPERS / MIDDLEWARE
// =======================
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

// Sistema de puntos
const BASE_POINTS = 5;
const POINTS = {
  POST: BASE_POINTS,                      // publicar
  TAG_PER: 1,                             // por etiqueta
  TAG_MAX: 5,                             // tope etiquetas
  LIKE_GIVER: 1,                          // por dar like
  EVENT_CREATE: BASE_POINTS * 2,          // crear evento
  PASSENGER: Math.floor(BASE_POINTS / 2), // pasajero (confirmar asiento)
  DRIVER: BASE_POINTS * 3                 // conductor (crear ride)
};
async function addPoints(userId, amount) {
  if (!amount) return;
  await User.updateOne({ _id: userId }, { $inc: { points: amount } });
}

// DEBUG sesión (opcional)
app.get('/api/_debug/session', (req, res) => {
  res.json({ hasCookie: !!req.headers.cookie, sessionId: req.sessionID, userId: req.session.userId || null });
});

// =======================
// RUTAS DE AUTENTICACIÓN
// =======================
app.post('/register', async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;
    if (!email || !password || !nickname) return res.status(400).send('Faltan datos');

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).send('Ese correo ya está en uso');
    const nickExists = await User.findOne({ nickname });
    if (nickExists) return res.status(409).send('Ese apodo ya está en uso');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword, // guardamos en "password" (el modelo ya es compatible)
      nickname,
      points: 0
    });
    await user.save();

    req.session.userId = user._id;
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el registro');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Trae ambos hashes si existen (nuevo y legacy)
    const user = await User.findOne({ email: String(email).toLowerCase().trim() })
      .select('+password +passwordHash');

    if (!user) return res.status(400).send('Usuario no encontrado');

    // Usa el método del modelo que ya hace fallback a passwordHash
    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(400).send('Contraseña incorrecta');

    req.session.userId = user._id;
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el login');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// =======================
// RUTAS DE USUARIO
// =======================
app.get('/api/user', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json(user);
});

// QR “user info” (ruta previa)
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

// =======================
// RUTAS DE POSTS/FEED (APIs JSON)
// =======================
app.post('/api/posts', isAuthenticated, async (req, res) => {
  try {
    const { content, image, tags } = req.body;
    const user = await User.findById(req.session.userId);
    const post = new Post({
      content,
      image,
      tags,
      user: user.nickname,  // compat con frontend actual
      likes: 0,
      likedBy: [],
    });
    await post.save();

    // puntos por publicar (API JSON)
    await addPoints(user._id, 10);
    res.json(post);
  } catch (err) {
    res.status(500).send('Error creando post');
  }
});

app.get('/api/posts', isAuthenticated, async (req, res) => {
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
      await addPoints(me._id, 1); // puntos por dar like
      await post.save();
    }
    res.json(post);
  } catch (err) {
    res.status(500).send('Error en like');
  }
});

// =======================
// RUTAS FEED “COMPAT” (para tu frontend actual)
// =======================
app.post('/post-status', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    // tags llega como string JSON desde dashboard.html
    let tags = [];
    if (typeof req.body.tags === 'string' && req.body.tags.trim() !== '') {
      try { tags = JSON.parse(req.body.tags); } catch { tags = []; }
    }

    const content = String(req.body.content || req.body.status || '').slice(0, 1000);
    if (!content.trim()) return res.status(400).send('El contenido no puede estar vacío');

    await Post.create({ user: me.nickname, content, tags });

    // Máx 3 posts con puntos por día
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

// =======================
// RUTAS DE EVENTOS
// =======================
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
      return res.status(400).send('Faltan campos obligatorios o fecha inválida');
    }
    if (fecha < new Date()) return res.status(400).send('La fecha debe ser futura');

    const ev = await Event.create({
      nombre, descripcion, fecha, ubicacion,
      pasajeros: [], conductores: [],
      creador: me.nickname
    });

    await addPoints(req.session.userId, POINTS.EVENT_CREATE);

    if (req.accepts('html')) return res.redirect('/eventos');
    res.json({ ok: true, event: ev });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al crear evento');
  }
});

// Asistencia manual
app.post('/api/evento/asistencia', requireAuth, async (req, res) => {
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
  if (req.accepts('html')) return res.redirect(`/evento.html?id=${evento._id}`);
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

// =======================
// RUTAS DE RIDES (RAITE)
// =======================
const rideRoutes = require('./routes/rides');
app.use('/api', rideRoutes);   // compat para tu frontend (/api/rides, etc.)

// =======================
// PUERTO
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
