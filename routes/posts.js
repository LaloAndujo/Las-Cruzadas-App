const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const { addPoints } = require('../utils/points');

async function getUserLite(id) {
  const u = await User.findById(id).lean();
  return u ? { _id: u._id, nickname: u.nickname, points: u.points ?? 0, profilePic: u.profilePic || null } : null;
}

router.post('/api/posts', isAuthenticated, async (req, res) => {
  try {
    const { content, image, tags } = req.body;
    const user = await User.findById(req.session.userId);
    const post = new Post({ content, image, tags, user: user.nickname, likes: 0, likedBy: [] });
    await post.save();
    await addPoints(user._id, 10);
    res.json(post);
  } catch {
    res.status(500).send('Error creando post');
  }
});

router.get('/api/posts', isAuthenticated, async (_req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

router.post('/api/posts/:id/like', isAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const me = await getUserLite(req.session.userId);
    if (!post) return res.status(404).send('Post no encontrado');

    post.likedBy = post.likedBy || [];
    if (!post.likedBy.includes(me.nickname)) {
      post.likes = (post.likes || 0) + 1;
      post.likedBy.push(me.nickname);
      await addPoints(me._id, 1);
      await post.save();
    }
    res.json(post);
  } catch {
    res.status(500).send('Error en like');
  }
});

module.exports = router;
