const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { POINTS, addPoints } = require('../utils/points');
const Post = require('../models/Post');
const User = require('../models/User');

async function getUserLite(id) {
  const u = await User.findById(id).lean();
  return u ? { _id: u._id, nickname: u.nickname, points: u.points ?? 0, profilePic: u.profilePic || null } : null;
}

router.post('/post-status', requireAuth, async (req, res) => {
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
    const postsHoy = await Post.countDocuments({ user: me.nickname, createdAt: { $gte: hoy, $lt: mañana } });

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

router.get('/api/feed', requireAuth, async (_req, res) => {
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

router.post('/like/:postId', requireAuth, async (req, res) => {
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

router.delete('/api/post/:id', requireAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  if (post.user !== me.nickname) return res.status(403).json({ error: 'No eres el autor' });
  await Post.deleteOne({ _id: post._id });
  res.json({ ok: true });
});

module.exports = router;
