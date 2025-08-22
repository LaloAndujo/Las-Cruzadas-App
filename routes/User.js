const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

router.get('/api/user', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json(user);
});

router.get('/api/user/qr', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const qrData = `Usuario: ${user.nickname}, ID: ${user._id}`;
    const qrImage = await QRCode.toDataURL(qrData);
    res.json({ qrImage });
  } catch {
    res.status(500).send('Error generando QR');
  }
});

router.get('/api/generate-qr', async (req, res) => {
  try {
    const nickname = (req.query.user || 'desconocido').trim();
    const qrData = `https://lascruzadas.com/perfil/${encodeURIComponent(nickname)}`;
    const qr = await QRCode.toDataURL(qrData);
    res.json({ qr });
  } catch {
    res.status(500).json({ error: 'No se pudo generar el QR' });
  }
});

module.exports = router;
