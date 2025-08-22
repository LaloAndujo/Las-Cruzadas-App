const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { POINTS, addPoints } = require('../utils/points');
const Event = require('../models/Event');
const User = require('../models/User');

async function getUserLite(id) {
  const u = await User.findById(id).lean();
  return u ? { _id: u._id, nickname: u.nickname } : null;
}

router.get('/api/events', requireAuth, async (_req, res) => {
  const events = await Event.find().sort({ fecha: 1 }).lean();
  res.json(events);
});

router.get('/api/events/:id', requireAuth, async (req, res) => {
  const ev = await Event.findById(req.params.id).lean();
  if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(ev);
});

router.post('/api/crear-evento', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);

    const nombre = (req.body.nombre || req.body.title || '').trim();
    const descripcion = (req.body.descripcion || req.body.description || '').trim();
    const fecha = new Date(req.body.fecha || req.body.date);
    const ubicacion = (req.body.ubicacion || req.body.location || '').trim();

    if (!nombre || !descripcion || !ubicacion || isNaN(fecha.getTime())) {
      return res.status(400).send('Faltan campos obligatorios o fecha inválida');
    }
    if (fecha < new Date()) return res.status(400).send('La fecha debe ser futura');

    const ev = await Event.create({
      nombre, descripcion, fecha, ubicacion,
      pasajeros: [], conductores: [],
      creador: me.nickname
    });

    await addPoints(req.session.userId, POINTS.EVENT_CREATE);

    if (req.accepts('html')) return res.redirect('/eventos');
    res.json({ ok: true, event: ev });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al crear evento');
  }
});

router.post('/api/evento/asistencia', requireAuth, async (req, res) => {
  const me = await getUserLite(req.session.userId);
  const evento = await Event.findById(req.body.eventoId);
  if (!evento) return res.status(404).send('Evento no encontrado');

  if (req.body.modo === 'pasajero') {
    if (!evento.pasajeros.includes(me.nickname)) evento.pasajeros.push(me.nickname);
  } else if (req.body.modo === 'conductor') {
    const ya = (evento.conductores || []).some(c => c.nickname === me.nickname);
    if (!ya) {
      evento.conductores.push({
        nickname: me.nickname,
        auto: req.body.auto || 'N/A',
        lugaresDisponibles: parseInt(req.body.lugaresDisponibles, 10) || 1,
        horaSalida: req.body.horaSalida || '',
        puntoReunion: req.body.puntoReunion || ''
      });
    }
  }

  await evento.save();
  if (req.accepts('html')) return res.redirect(`/evento.html?id=${evento._id}`);
  res.json({ ok: true });
});

// Borrar evento (solo creador por nickname)
router.delete('/api/event/:id', requireAuth, async (req, res) => {
  try {
    const me = await getUserLite(req.session.userId);
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
    if (ev.creador !== me.nickname) return res.status(403).json({ error: 'No puedes borrar este evento' });
    await Event.deleteOne({ _id: ev._id });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al borrar evento' });
  }
});

module.exports = router;
