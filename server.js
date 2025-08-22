require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');

const app = express();

/* ===== DB ===== */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cruzadas';
mongoose.connect(MONGO_URI, { autoIndex: true })
  .then(()=> console.log('MongoDB conectado'))
  .catch(err=>{ console.error('Error conectando MongoDB:', err.message); process.exit(1); });

app.set('trust proxy', 1);

/* ===== Parsers ===== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ===== CORS (opcional si front en otro dominio) ===== */
const allowed = (process.env.ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean);
if (allowed.length) {
  app.use(cors({ origin: allowed, credentials: true }));
}

/* ===== Sesión ===== */
const SESSION_SECRET = process.env.SESSION_SECRET || 'cruzadas_secret';
app.use(session({
  name: 'cruzadas.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'sessions', ttl: 60*60*24*7 }),
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000*60*60*24*7
  }
}));

/* ===== Static ===== */
app.use(express.static(path.join(__dirname, 'public')));

/* ===== Rutas ===== */
app.use(require('./routes/auth'));    // /login, /register, /logout (+ alias)
app.use(require('./routes/User'));    // /api/user, /api/user/qr, /api/generate-qr
app.use(require('./routes/posts'));   // /api/posts (+ like JSON)
app.use(require('./routes/feed'));    // compat: /post-status, /api/feed, /like/:id, delete post
app.use(require('./routes/events'));  // /api/events... crear/asistencia/borrar
app.use('/api', require('./routes/rides')); // ya la tienes (compat /api/rides)
app.use(require('./routes/debug'));   // endpoints de debug
app.use(require('./routes/pages'));   // /dashboard, /eventos (sirven HTML)

/* ===== Health ===== */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ===== Puerto ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
