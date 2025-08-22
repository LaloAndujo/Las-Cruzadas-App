const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { wantsJSON } = require('../utils/http');
const { escapeRegex } = require('../utils/regex');

// Debug de sesión
router.get('/api/_debug/session', (req, res) => {
  res.json({ hasCookie: !!req.headers.cookie, sessionId: req.sessionID, userId: req.session.userId || null, accept: req.headers['accept'] || '' });
});

// Registro
router.post('/register', async (req, res) => {
  try {
    const { username = '', email, password, nickname } = req.body;
    if (!email || !password || !nickname) {
      return wantsJSON(req)
        ? res.status(400).json({ error: 'Faltan datos' })
        : res.redirect('/login.html?error=' + encodeURIComponent('Faltan datos'));
    }
    const emailNorm = String(email).trim().toLowerCase();
    const [byEmail, byNick] = await Promise.all([
      User.findOne({ email: emailNorm }),
      User.findOne({ nickname })
    ]);
    if (byEmail) {
      return wantsJSON(req)
        ? res.status(409).json({ error: 'Ese correo ya está en uso' })
        : res.redirect('/login.html?error=' + encodeURIComponent('Ese correo ya está en uso'));
    }
    if (byNick) {
      return wantsJSON(req)
        ? res.status(409).json({ error: 'Ese apodo ya está en uso' })
        : res.redirect('/login.html?error=' + encodeURIComponent('Ese apodo ya está en uso'));
    }
    const user = await User.register({ email: emailNorm, password, nickname, username });
    req.session.userId = String(user._id);
    return wantsJSON(req) ? res.json({ ok: true, redirect: '/dashboard.html' }) : res.redirect('/dashboard.html');
  } catch (err) {
    console.error('Error en el registro:', err);
    const msg = (err && err.code === 11000)
      ? (err.keyPattern?.email ? 'Ese correo ya está en uso' : err.keyPattern?.nickname ? 'Ese apodo ya está en uso' : 'Duplicado')
      : 'Error en el registro';
    return wantsJSON(req) ? res.status(500).json({ error: msg }) : res.redirect('/login.html?error=' + encodeURIComponent(msg));
  }
});

// Login (email | username | nickname) + password
router.post('/login', async (req, res) => {
  try {
    const idRaw = (req.body.emailOrUser ?? req.body.email ?? req.body.username ?? req.body.nickname ?? '').toString().trim();
    const passRaw = (req.body.password ?? req.body.pass ?? req.body.pwd ?? '').toString();
    if (!idRaw || !passRaw) {
      return wantsJSON(req)
        ? res.status(400).json({ error: 'Faltan credenciales' })
        : res.redirect('/login.html?error=' + encodeURIComponent('Faltan credenciales'));
    }

    const emailNorm = idRaw.toLowerCase();
    const idRegex = new RegExp(`^${escapeRegex(idRaw)}$`, 'i');
    const user = await User.findOne({
      $or: [{ email: emailNorm }, { username: idRegex }, { nickname: idRegex }]
    }).select('+password +passwordHash');

    if (!user) {
      return wantsJSON(req)
        ? res.status(400).json({ error: 'Usuario no encontrado' })
        : res.redirect('/login.html?error=' + encodeURIComponent('Usuario no encontrado'));
    }

    const ok = await user.verifyPassword(passRaw);
    if (!ok) {
      return wantsJSON(req)
        ? res.status(400).json({ error: 'Contraseña incorrecta' })
        : res.redirect('/login.html?error=' + encodeURIComponent('Contraseña incorrecta'));
    }

    req.session.userId = String(user._id);
    return wantsJSON(req) ? res.json({ ok: true, redirect: '/dashboard.html' }) : res.redirect('/dashboard.html');
  } catch (err) {
    console.error('Error en el login:', err);
    return wantsJSON(req) ? res.status(500).json({ error: 'Error en el login' }) : res.redirect('/login.html?error=' + encodeURIComponent('Error en el login'));
  }
});

router.post('/auth/login', (req, res, next) => { req.url = '/login'; next(); });

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('cruzadas.sid');
    res.redirect('/login.html');
  });
});

module.exports = router;
