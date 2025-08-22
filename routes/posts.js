const express = require('express');
const Post = require('../models/Post');
const router = express.Router();

router.post('/', async (req, res) => {
  const { user, content, tags } = req.body;
  const post = new Post({ user, content, tags });
  await post.save();
  res.json(post);
});

router.get('/', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

router.post('/:id/like', async (req, res) => {
  const { nickname } = req.body;
  const post = await Post.findById(req.params.id);
  if (!post.likedBy.includes(nickname)) {
    post.likes++;
    post.likedBy.push(nickname);
    await post.save();
  }
  res.json(post);
});

module.exports = router;
