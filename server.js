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
  points: { type: Number, default: 0 }
}));

const Post = require('./models/Post');

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'cruzadas_secreta',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
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

// Redirección segura a dashboard con sessionStorage para el frontend
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const nickname = req.session.user.nickname;
  res.send(`
    <script>
      sessionStorage.setItem('nickname', '${nickname}');
      window.location.href = '/dashboard.html';
    </script>
  `);
});

// Publicar estado
app.post('/post-status', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const newPost = new Post({
    user: req.session.user.nickname,
    content: req.body.status
  });
  await newPost.save();
  res.redirect('/dashboard');
});

// Feed de publicaciones
app.get('/api/feed', async (req, res) => {
  const posts = await Post.find().sort({ date: -1 }).limit(30);
  res.json(posts);
});

// Generador de QR único
app.get('/api/generate-qr', async (req, res) => {
  const nickname = req.query.user || 'desconocido';
  const qrData = `https://lascruzadas.com/perfil/${nickname}`;
  const qrImage = await QRCode.toDataURL(qrData);
  res.json({ qr: qrImage });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`🟢 Servidor corriendo en el puerto ${PORT}`);
});
