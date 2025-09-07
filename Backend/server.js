require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Post = require('./models/Post');
const PointsHistory = require('./models/PointsHistory');

const app = express();
const PORT = process.env.PORT || 8000;

// --- Middlewares ---
app.use(express.json());

// CORS (si backend y frontend van en el mismo servicio, puedes quitarlo sin problema)
const allowed = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());
app.use(cors({
  origin: allowed,
  credentials: true
}));

// --- DB Connection ---
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// --- Helpers ---
const generateToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ detail: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ detail: 'Invalid token' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ detail: 'Invalid token' });
  }
};

const awardPoints = async (userId, action, points, description) => {
  await User.updateOne({ _id: userId }, { $inc: { points } });
  const record = await PointsHistory.create({
    user_id: userId,
    action,
    points,
    description,
    approved: true
  });
  return record;
};

// --- Healthcheck simple ---
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Routes (API) ---
app.get('/api', (_req, res) => res.send('🚀 Las Cruzadas API Running'));

// AUTH: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, nickname, password, email } = req.body;

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ detail: 'Username already taken' });

    const user = new User({ username, nickname, password, email, points: 50 });
    await user.save();

    await awardPoints(user._id, 'welcome', 50, '¡Bienvenido a Las Cruzadas!');

    const token = generateToken(user);
    const safe = user.toObject();
    delete safe.password;

    res.json({ access_token: token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// AUTH: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ detail: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ detail: 'Invalid credentials' });

    user.last_active = new Date();
    await user.save();

    const token = generateToken(user);
    const safe = user.toObject();
    delete safe.password;

    res.json({ access_token: token, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// USERS: Me
app.get('/api/users/me', auth, async (req, res) => {
  res.json(req.user);
});

// USERS: Points history
app.get('/api/users/:id/points/history', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user._id) !== String(id) && !req.user.is_admin) {
      return res.status(403).json({ detail: 'Can only view your own points history' });
    }
    const history = await PointsHistory.find({ user_id: id })
      .sort({ created_at: -1 })
      .limit(50);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// POSTS: Create
app.post('/api/posts', auth, async (req, res) => {
  try {
    const { content, image } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ detail: 'Content is required' });
    }

    const post = await Post.create({
      user_id: req.user._id,
      content: content.trim(),
      image: image || null
    });

    await awardPoints(req.user._id, 'post', 10, 'Publicación en el feed');

    const response = {
      id: post._id,
      user_id: String(req.user._id),
      username: req.user.username,
      nickname: req.user.nickname,
      profile_picture: req.user.profile_picture || null,
      content: post.content,
      image: post.image,
      likes: [],
      like_count: 0,
      created_at: post.createdAt,
      is_liked: false
    };

    res.status(201).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// POSTS: List (desc)
app.get('/api/posts', auth, async (_req, res) => {
  try {
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user_id', 'username nickname profile_picture');

    const mapped = posts.map(p => ({
      id: p._id,
      user_id: String(p.user_id._id),
      username: p.user_id.username,
      nickname: p.user_id.nickname,
      profile_picture: p.user_id.profile_picture || null,
      content: p.content,
      image: p.image,
      likes: p.likes.map(String),
      like_count: p.likes.length,
      created_at: p.createdAt,
      is_liked: false
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// POSTS: Toggle like
app.post('/api/posts/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ detail: 'Post not found' });

    const uid = String(req.user._id);
    const hasLiked = post.likes.map(String).includes(uid);

    let action = 'like';
    let points_awarded = 0;

    if (hasLiked) {
      post.likes = post.likes.filter(u => String(u) !== uid);
      action = 'unlike';
    } else {
      post.likes.push(req.user._id);
      const rec = await awardPoints(req.user._id, 'like', 2, 'Like en publicación');
      points_awarded = rec.points;
    }

    await post.save();

    res.json({
      action,
      like_count: post.likes.length,
      points_awarded
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// LEADERBOARD
app.get('/api/leaderboard', async (_req, res) => {
  try {
    const users = await User.find({}, 'nickname points profile_picture')
      .sort({ points: -1 })
      .limit(50);

    const leaderboard = users.map((u, i) => ({
      rank: i + 1,
      nickname: u.nickname,
      points: u.points,
      profile_picture: u.profile_picture || null
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: 'Server error' });
  }
});

// --- Servir el frontend (Vite build) ---
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
// Cualquier ruta que NO sea /api/* la atiende el frontend
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
