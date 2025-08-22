const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { escapeRegex } = require('../utils/regex');

// /api/_debug/db
router.get('/api/_debug/db', async (_req, res) => {
  try {
    const conn = mongoose.connection;
    const dbName = conn?.db?.databaseName || null;
    const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cruzadas');
    const masked = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    const users = await User.countDocuments();
    res.json({ ok: true, dbName, mongoUri: masked, usersCount: users });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// /api/_debug/users/find
router.get('/api/_debug/users/find', async (req, res) => {
  try {
    const q = String(req.query.i || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'Falta ?i=' });
    const emailNorm = q.toLowerCase();
    const idRegex = new RegExp(`^${escapeRegex(q)}$`, 'i');
    const user = await User.findOne({ $or: [{ email: emailNorm }, { username: idRegex }, { nickname: idRegex }] })
      .select('email username nickname createdAt');
    res.json({ ok: true, found: !!user, user });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// /api/_debug/seed
router.post('/api/_debug/seed', async (req, res) => {
  try {
    if (!process.env.SEED_KEY) return res.status(403).json({ ok:false, error:'SEED deshabilitado (SEED_KEY no definido)' });
    if (req.header('X-SEED-KEY') !== process.env.SEED_KEY) return res.status(403).json({ ok:false, error:'SEED_KEY inválido' });

    const email = (req.body?.email || 'test@cruzadas.com').toLowerCase();
    const password = req.body?.password || '123456';
    const nickname = req.body?.nickname || 'Tester';
    const username = req.body?.username || 'tester';

    const exists = await User.findOne({ $or: [{ email }, { nickname }] });
    if (exists) return res.json({ ok: true, note: 'Usuario ya existía', user: { email: exists.email, nickname: exists.nickname } });

    const user = await User.register({ email, password, nickname, username });
    res.json({ ok: true, created: { id: user._id, email: user.email, nickname: user.nickname } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
