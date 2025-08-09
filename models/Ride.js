// models/Ride.js
const mongoose = require('mongoose');

const AsientoSchema = new mongoose.Schema({
  lugar: {
    type: Number,
    required: true,
    min: [1, 'El número de asiento debe ser >= 1']
  },
  ocupadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { _id: false });

const RideSchema = new mongoose.Schema({
  conductorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },

  // Espacios disponibles (se mantiene por compatibilidad),
  // pero lo recalculamos desde los asientos en pre('save').
  espaciosDisponibles: {
    type: Number,
    required: true,
    min: [0, 'No puede ser negativo']
  },

  puntoSalida: { type: String, trim: true, default: '' },
  horarioSalida: { type: String, trim: true, default: '' },

  asientos: {
    type: [AsientoSchema],
    validate: {
      validator: v => Array.isArray(v) && v.length > 0,
      message: 'Debe existir al menos un asiento'
    }
  },

  pasajeros: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* ---------- Virtuales ---------- */
RideSchema.virtual('capacidad').get(function () {
  return (this.asientos || []).length;
});

RideSchema.virtual('lugaresLibres').get(function () {
  return (this.asientos || []).reduce((acc, a) => acc + (a.ocupadoPor ? 0 : 1), 0);
});

/* ---------- Índices útiles ---------- */
RideSchema.index({ eventoId: 1, createdAt: 1 });     // listar rides por evento
RideSchema.index({ eventoId: 1, 'asientos.ocupadoPor': 1 }); // consultas por ocupación

/* ---------- Consistencia: recalcular disponibles antes de guardar ---------- */
RideSchema.pre('save', function (next) {
  this.espaciosDisponibles = this.lugaresLibres;
  // Limpia duplicados en pasajeros (por si acaso)
  if (Array.isArray(this.pasajeros)) {
    const set = new Set(this.pasajeros.map(id => id.toString()));
    this.pasajeros = Array.from(set);
  }
  next();
});

/* ---------- Métodos de instancia ---------- */

// Reserva de asiento ATÓMICA por número (evita doble asignación concurrente)
RideSchema.statics.bookSeat = async function (rideId, userId, lugar) {
  const query = {
    _id: rideId,
    'asientos.lugar': lugar,
    'asientos.ocupadoPor': null
  };
  const update = {
    $set: { 'asientos.$.ocupadoPor': userId },
    $addToSet: { pasajeros: userId },
    $inc: { espaciosDisponibles: -1 }
  };
  const opts = { new: true };
  const updated = await this.findOneAndUpdate(query, update, opts);
  if (!updated) {
    return { ok: false, reason: 'ocupado_o_inexistente' };
  }
  return { ok: true, ride: updated };
};

// Reserva el PRIMER asiento libre si no te importa el número
RideSchema.statics.bookFirstFreeSeat = async function (rideId, userId) {
  // Encuentra el ride y el primer asiento libre
  const ride = await this.findById(rideId).lean();
  if (!ride) return { ok: false, reason: 'ride_no_encontrado' };
  const free = (ride.asientos || []).find(a => !a.ocupadoPor);
  if (!free) return { ok: false, reason: 'sin_lugares' };
  return this.bookSeat(rideId, userId, free.lugar);
};

// Liberar asiento
RideSchema.statics.releaseSeat = async function (rideId, userIdOrLugar) {
  let query, update;

  if (typeof userIdOrLugar === 'number') {
    // por lugar
    query = { _id: rideId, 'asientos.lugar': userIdOrLugar };
    update = {
      $set: { 'asientos.$.ocupadoPor': null },
      $inc: { espaciosDisponibles: 1 }
    };
  } else {
    // por userId
    query = { _id: rideId, 'asientos.ocupadoPor': userIdOrLugar };
    update = {
      $set: { 'asientos.$.ocupadoPor': null },
      $inc: { espaciosDisponibles: 1 }
    };
  }

  const updated = await this.findOneAndUpdate(query, update, { new: true });
  if (!updated) return { ok: false, reason: 'no_encontrado' };

  // Opcional: quitar pasajero si ya no ocupa ningún asiento
  const stillSeated = updated.asientos.some(a => a.ocupadoPor && a.ocupadoPor.toString() === String(userIdOrLugar));
  if (!stillSeated && typeof userIdOrLugar !== 'number') {
    await this.updateOne({ _id: rideId }, { $pull: { pasajeros: userIdOrLugar } });
  }
  return { ok: true, ride: updated };
};

/* ---------- Estáticos prácticos ---------- */

// Crear ride con N asientos numerados 1..N
RideSchema.statics.createWithSeats = async function ({
  conductorId, eventoId, espacios, puntoSalida = '', horarioSalida = ''
}) {
  const n = parseInt(espacios, 10);
  if (!n || n < 1) throw new Error('Espacios inválidos');
  const asientos = Array.from({ length: n }, (_, i) => ({ lugar: i + 1, ocupadoPor: null }));
  return this.create({
    conductorId, eventoId,
    espaciosDisponibles: n,
    puntoSalida, horarioSalida,
    asientos,
    pasajeros: []
  });
};

// Listar rides con cálculo de libres desde Mongo (agregación)
RideSchema.statics.listAvailableByEvent = async function (eventoId) {
  return this.aggregate([
    { $match: { eventoId: new mongoose.Types.ObjectId(eventoId) } },
    {
      $addFields: {
        lugaresLibres: {
          $size: {
            $filter: {
              input: '$asientos',
              as: 'a',
              cond: { $eq: ['$$a.ocupadoPor', null] }
            }
          }
        },
        capacidad: { $size: '$asientos' }
      }
    },
    { $sort: { lugaresLibres: -1, createdAt: 1 } }
  ]);
};

module.exports = mongoose.model('Ride', RideSchema);
