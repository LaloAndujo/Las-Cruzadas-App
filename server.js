// server.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Post = require('./models/Post');
const Event = require('./models/Event');
const Ride = require('./models/Ride'); // NUEVO MODELO DE RIDES

const app = express();

// =======================
// CONFIGURACIÓN BÁSICA
// =======================
mongoose.connect('mongodb://127.0.0.1:27017/cruzadas', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'cruzadas_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/cruzadas' })
}));

app.use(express.static(path.join(__dirname, 'public')));

// =======================
// MIDDLEWARE DE AUTENTICACIÓN
// =======================
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  } else {
    res.redirect('/login.html');
  }
}

// =======================
// RUTAS DE AUTENTICACIÓN
// =======================
app.post('/register', async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
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
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('Usuario no encontrado');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send('Contraseña incorrecta');
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

// =======================
// RUTAS DE POSTS/FEED
// =======================
app.post('/api/posts', isAuthenticated, async (req, res) => {
  try {
    const { content, image, tags } = req.body;
    const user = await User.findById(req.session.userId);

    const post = new Post({
      content,
      image,
      tags,
      user: user._id,
      likes: 0,
      likedBy: [],
      createdAt: new Date()
    });

    await post.save();

    // puntos automáticos por publicar
    user.points += 10;
    await user.save();

    res.json(post);
  } catch (err) {
    res.status(500).send('Error creando post');
  }
});

app.get('/api/posts', isAuthenticated, async (req, res) => {
  const posts = await Post.find().populate('user').sort({ createdAt: -1 });
  res.json(posts);
});

app.post('/api/posts/:id/like', isAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.session.userId;

    if (!post.likedBy.includes(userId)) {
      post.likes += 1;
      post.likedBy.push(userId);

      // sumar puntos por dar like
      const user = await User.findById(userId);
      user.points += 1;
      await user.save();

      await post.save();
    }

    res.json(post);
  } catch (err) {
    res.status(500).send('Error en like');
  }
});

// =======================
// RUTAS DE EVENTOS
// =======================
app.post('/api/events', isAuthenticated, async (req, res) => {
  try {
    const { title, description, date, capacity } = req.body;
    const event = new Event({ title, description, date, capacity, attendees: [] });
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).send('Error creando evento');
  }
});

app.get('/api/events', isAuthenticated, async (req, res) => {
  const events = await Event.find().sort({ date: 1 });
  res.json(events);
});

app.post('/api/events/:id/attend', isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event.attendees.includes(req.session.userId)) {
      event.attendees.push(req.session.userId);
      await event.save();

      const user = await User.findById(req.session.userId);
      user.points += 20; // puntos por asistir
      await user.save();
    }
    res.json(event);
  } catch (err) {
    res.status(500).send('Error al asistir');
  }
});

// =======================
// RUTAS DE RIDES (RAITE)
// =======================
const rideRoutes = require('./routes/rides');
app.use('/rides', rideRoutes);

// =======================
// PUERTO
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
