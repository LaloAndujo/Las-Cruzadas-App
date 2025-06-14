
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('🔥 Conectado a MongoDB'))
  .catch(err => console.error('Error de conexión:', err));

// Modelos
const User = mongoose.model('User', new mongoose.Schema({
  nickname: String,
  password: String,
  points: { type: Number, default: 0 },
  profilePic: { type: String, default: '' } // opcional, se puede usar más adelante
}));
const Post = require('./models/Post');
const Event = require('./models/Event');

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'cruzadas_secreta',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas base
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/register', async (req, res) => {
  const { nickname, password } = req.body;
  const existing = await User.findOne({ nickname });
  if (existing) return res.send('Ese apodo ya está en uso. 🧱');

  const user = new User({ nickname, password });
  await user.save();
  req.session.user = user;
  res.redirect('/dashboard');
});

app.post('/login', async (req, res) => {
  const { nickname, password } = req.body;
  const user = await User.findOne({ nickname, password });
  if (!user) return res.send('Datos incorrectos. 🚫');

  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

app.post('/post-status', async (req, res) => {
  if (!req.session.user) return res.redirect('/');

  const newPost = new Post({
    user: req.session.user.nickname,
    content: req.body.status
  });

  await newPost.save();

  // Compensación automática limitada a 3 publicaciones por día
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const mañana = new Date(hoy);
  mañana.setDate(mañana.getDate() + 1);

  const postsHoy = await Post.countDocuments({
    user: req.session.user.nickname,
    date: { $gte: hoy, $lt: mañana }
  });

  if (postsHoy <= 3) {
    await User.updateOne(
      { nickname: req.session.user.nickname },
      { $inc: { points: 5 } }
    );
  }

  res.redirect('/dashboard');
});

// Nuevo: Feed enriquecido con likes, puntos y perfil
app.get('/api/feed', async (req, res) => {
  const posts = await Post.find().sort({ date: -1 }).limit(30);
  const enhancedPosts = await Promise.all(posts.map(async post => {
    const user = await User.findOne({ nickname: post.user });
    return {
      _id: post._id,
      user: post.user,
      content: post.content,
      date: post.date,
      likes: post.likes,
      tags: post.tags,
      points: user ? user.points : 0,
      profilePic: user ? user.profilePic || null : null
    };
  }));
  res.json(enhancedPosts);
});

// Nuevo: Like por post por usuario
app.post('/like/:postId', async (req, res) => {
  if (!req.session.user) return res.status(401).send('No autorizado');

  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).send('Publicación no encontrada');

  if (post.likedBy.includes(req.session.user.nickname)) {
    return res.status(400).send('Ya diste like');
  }

  post.likes += 1;
  post.likedBy.push(req.session.user.nickname);
  await post.save();

  res.json({ success: true, newLikes: post.likes });
});

// Generador de QR
app.get('/api/generate-qr', async (req, res) => {
  const nickname = req.query.user || 'desconocido';
  const qrData = `https://lascruzadas.com/perfil/${nickname}`;
  const qrImage = await QRCode.toDataURL(qrData);
  res.json({ qr: qrImage });
});

// Vistas para eventos
app.get('/eventos', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/events.html'));
});

app.get('/evento.html', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/evento.html'));
});

// API para eventos
app.get('/api/events', async (req, res) => {
  const events = await Event.find().sort({ fecha: 1 });
  res.json(events);
});

app.get('/api/events/:id', async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).send('Evento no encontrado');
  res.json(event);
});

app.post('/api/evento/asistencia', async (req, res) => {
  if (!req.session.user) return res.redirect('/');

  const evento = await Event.findById(req.body.eventoId);
  if (!evento) return res.send('Evento no encontrado');

  if (req.body.modo === 'pasajero') {
    if (!evento.pasajeros.includes(req.session.user.nickname)) {
      evento.pasajeros.push(req.session.user.nickname);
    }
  } else if (req.body.modo === 'conductor') {
    const yaRegistrado = evento.conductores.some(c => c.nickname === req.session.user.nickname);
    if (!yaRegistrado) {
      evento.conductores.push({
        nickname: req.session.user.nickname,
        auto: req.body.auto,
        lugaresDisponibles: parseInt(req.body.lugaresDisponibles),
        horaSalida: req.body.horaSalida,
        puntoReunion: req.body.puntoReunion
      });
    }
  }

  await evento.save();
  res.redirect(`/evento.html?id=${evento._id}`);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`🟢 Servidor corriendo en el puerto ${PORT}`);
});
