const express = require('express');
const User = require('../models/User');
const QRCode = require('qrcode');
const router = express.Router();

// Registro
router.post('/register', async (req, res) => {
  try {
    const { nickname, email, password } = req.body;
    const user = new User({ nickname, email, password });
    await user.save();

    // Generar QR
    const qr = await QRCode.toDataURL(nickname);
    user.qrCode = qr;
    await user.save();

    req.session.user = user;
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }
    req.session.user = user;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
