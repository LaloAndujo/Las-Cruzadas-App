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
  profilePic: { type: String, default: '' }
}));
const Post = require('./models/Post');
const Event = require('./models/Event');
const Ride = require('./models/Ride');
const PassengerQueue = require('./models/PassengerQueue');

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
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
    content: req.body.status,
    tags: req.body.tags ? JSON.parse(req.body.tags) : []
  });

  await newPost.save();

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

app.get('/api/generate-qr', async (req, res) => {
  const nickname = req.query.user || 'desconocido';
  const qrData = `https://lascruzadas.com/perfil/${nickname}`;
  const qrImage = await QRCode.toDataURL(qrData);
  res.json({ qr: qrImage });
});

app.get('/eventos', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/events.html'));
});

app.get('/evento.html', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/evento.html'));
});

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

app.get('/api/user', async (req, res) => {
  if (!req.session.user) return res.status(401).send('No autorizado');
  const user = await User.findOne({ nickname: req.session.user.nickname });
  if (!user) return res.status(404).send('Usuario no encontrado');
  res.json({ nickname: user.nickname, points: user.points });
});

app.post('/api/rides', async (req, res) => {
  const { eventoId, espaciosDisponibles, puntoSalida, horarioSalida } = req.body;
  if (!req.session.user) return res.status(401).send('No autorizado');

  const asientos = Array.from({ length: espaciosDisponibles }, (_, i) => ({
    lugar: i + 1,
    ocupadoPor: null
  }));

  const nuevoRide = new Ride({
    conductorId: req.session.user._id,
    eventoId,
    espaciosDisponibles,
    puntoSalida,
    horarioSalida,
    asientos,
    pasajeros: []
  });

  await nuevoRide.save();
  res.json({ mensaje: 'Ride creado', ride: nuevoRide });
});

app.post('/api/fila-pasajeros', async (req, res) => {
  const { eventoId } = req.body;
  if (!req.session.user) return res.status(401).send('No autorizado');

  const yaEnFila = await PassengerQueue.findOne({ userId: req.session.user._id, eventoId, estado: 'en_espera' });
  if (yaEnFila) return res.status(400).send('Ya estás en la fila de este evento');

  const pasajero = new PassengerQueue({ userId: req.session.user._id, eventoId });
  await pasajero.save();
  res.json({ mensaje: 'Agregado a la fila' });
});

app.get('/api/rides-disponibles/:eventoId', async (req, res) => {
  const rides = await Ride.find({ eventoId: req.params.eventoId }).populate('conductorId', 'nickname').lean();
  const disponibles = rides.map(ride => {
    const lugaresLibres = ride.asientos.filter(a => !a.ocupadoPor).length;
    return { ...ride, lugaresLibres };
  });
  res.json(disponibles);
});

app.post('/api/seleccionar-asiento', async (req, res) => {
  const { rideId, lugar } = req.body;
  if (!req.session.user) return res.status(401).send('No autorizado');

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).send('Ride no encontrado');

  const asiento = ride.asientos.find(a => a.lugar === parseInt(lugar));
  if (!asiento || asiento.ocupadoPor) return res.status(400).send('Asiento ocupado');

  asiento.ocupadoPor = req.session.user._id;
  ride.pasajeros.push(req.session.user._id);
  ride.espaciosDisponibles--;

  await ride.save();

  await PassengerQueue.findOneAndUpdate(
    { userId: req.session.user._id, eventoId: ride.eventoId },
    { estado: 'asignado' }
  );

  res.json({ mensaje: 'Asiento reservado' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`🟢 Servidor corriendo en el puerto ${PORT}`);
});