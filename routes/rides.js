// routes/rides.js
const express = require('express');
const mongoose = require('mongoose');

const Ride = require('../models/Ride');
const PassengerQueue = require('../models/PassengerQueue');
const Event = require('../models/Event');

// TIP: como el User se define en server.js, lo recuperamos del registry de Mongoose
// (ya está cargado porque server.js define el modelo antes de montar rutas)
let User;
try { User = mongoose.model('User'); } catch { /* si no existe, no poblamos nicknames */ }

const router = express.Router();

// Middleware de auth (igualito a tu server)
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.accepts('html')) return res.redirect('/');
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

/* ===================== Crear ride con asientos ===================== */
router.post('/rides', requireAuth, async (req, res) => {
  try {
    const { eventoId, espaciosDisponibles, puntoSalida, horarioSalida } = req.body;
    if (!eventoId) return res.status(400).json({ error: 'Falta eventoId' });

    const ride = await Ride.createWithSeats({
      conductorId: req.session.userId,
      eventoId,
      espacios: espaciosDisponibles,
      puntoSalida,
      horarioSalida
    });

    res.json({ mensaje: 'Ride creado', ride });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Error creando ride' });
  }
});

/* ===================== Unirse a la fila (pasajeros) ===================== */
router.post('/fila-pasajeros', requireAuth, async (req, res) => {
  const { eventoId } = req.body;
  if (!eventoId) return res.status(400).json({ error: 'Falta eventoId' });

  const yaEnFila = await PassengerQueue.findOne({
    userId: req.session.userId, eventoId, estado: 'en_espera'
  });
  if (yaEnFila) return res.status(400).json({ error: 'Ya estás en la fila de este evento' });

  await PassengerQueue.create({ userId: req.session.userId, eventoId });
  res.json({ mensaje: 'Agregado a la fila' });
});

/* ===================== Listar rides por evento (con libres) ===================== */
router.get('/rides-disponibles/:eventoId', async (req, res) => {
  try {
    const eventoId = req.params.eventoId;
    const list = await Ride.listAvailableByEvent(eventoId);

    // Enriquecer con nickname del conductor si el modelo User existe
    if (User) {
      const conductorIds = [...new Set(list.map(r => String(r.conductorId)))];
      const conductores = await User.find(
        { _id: { $in: conductorIds } }, { nickname: 1 }
      ).lean();
      const byId = new Map(conductores.map(u => [String(u._id), u.nickname]));
      list.forEach(r => {
        r.conductorId = { _id: r.conductorId, nickname: byId.get(String(r.conductorId)) || 'Conductor' };
      });
    }

    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron cargar los rides' });
  }
});

/* ===================== Reservar asiento ===================== */
router.post('/seleccionar-asiento', requireAuth, async (req, res) => {
  try {
    const { rideId, lugar } = req.body;
    const seatNum = Number(lugar);
    if (!rideId || !Number.isInteger(seatNum) || seatNum <= 0) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const result = await Ride.bookSeat(rideId, req.session.userId, seatNum);
    if (!result.ok) {
      const msg = result.reason === 'ocupado_o_inexistente' ? 'Asiento ocupado' : 'No se pudo reservar';
      return res.status(400).json({ error: msg });
    }

    await PassengerQueue.findOneAndUpdate(
      { userId: req.session.userId, eventoId: result.ride.eventoId },
      { estado: 'asignado' }
    );

    res.json({ mensaje: 'Asiento reservado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al reservar asiento' });
  }
});

/* ===================== Feed de rides (últimos 7 días) ===================== */
router.get('/rides-feed', async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const events = await Event.find({ fecha: { $gte: since } }, { nombre: 1 }).lean();
    const map = new Map(events.map(e => [String(e._id), e.nombre]));

    let query = Ride.find({ eventoId: { $in: [...map.keys()] } })
      .sort({ createdAt: -1 })
      .limit(10);

    if (User) query = query.populate('conductorId', 'nickname');

    const rides = await query.lean();

    const data = rides.map(r => ({
      _id: r._id,
      eventoId: r.eventoId,
      eventoNombre: map.get(String(r.eventoId)) || 'Evento',
      conductorId: r.conductorId, // { _id, nickname } si hay populate
      conductor: r.conductorId?.nickname,
      puntoSalida: r.puntoSalida,
      horarioSalida: r.horarioSalida,
      asientos: r.asientos,
      createdAt: r.createdAt
    }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron cargar los rides' });
  }
});

module.exports = router;
