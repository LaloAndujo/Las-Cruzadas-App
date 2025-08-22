const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});
router.get('/eventos', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'eventos.html'));
});

module.exports = router;
