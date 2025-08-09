// models/PassengerQueue.js
const mongoose = require('mongoose');

const PassengerQueueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  estado: {
    type: String,
    enum: ['en_espera', 'asignado'],
    default: 'en_espera',
    index: true
  },
  // Opcional: a qué ride quedó asignado
  assignedRideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    default: null
  },
  // Opcional: notas/metadata
  notes: { type: String, trim: true, maxlength: 280 }
}, {
  timestamps: true,               // createdAt = orden en la fila
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Índices:
 * - Un único en (userId, eventoId, estado) evita que el mismo user esté dos veces
 *   en la misma fila "en_espera", pero sí permite un registro extra cuando pase a "asignado".
 */
PassengerQueueSchema.index({ userId: 1, eventoId: 1, estado: 1 }, { unique: true });

// Para sacar el "siguiente" rápido (FIFO)
PassengerQueueSchema.index({ eventoId: 1, estado: 1, createdAt: 1 });

/* ---------- Métodos estáticos útiles ---------- */

// Encola si no está ya en espera; devuelve el doc existente si ya estaba.
PassengerQueueSchema.statics.enqueue = async function (userId, eventoId) {
  try {
    const doc = await this.findOneAndUpdate(
      { userId, eventoId, estado: 'en_espera' },
      { $setOnInsert: { userId, eventoId, estado: 'en_espera' } },
      { new: true, upsert: true }
    );
    return { ok: true, doc, created: doc.createdAt === doc.updatedAt };
  } catch (err) {
    // choque por índice único => ya estaba
    if (err && err.code === 11000) {
      const doc = await this.findOne({ userId, eventoId, estado: 'en_espera' });
      return { ok: true, doc, created: false };
    }
    throw err;
  }
};

// Saca al siguiente de la fila (FIFO) y lo marca como asignado.
// Si pasas rideId, también lo guarda.
PassengerQueueSchema.statics.dequeueNext = async function (eventoId, rideId = null) {
  const doc = await this.findOneAndUpdate(
    { eventoId, estado: 'en_espera' },
    { $set: { estado: 'asignado', assignedRideId: rideId } },
    { sort: { createdAt: 1 }, new: true }
  );
  return doc; // null si la fila está vacía
};

// ¿El usuario está esperando para ese evento?
PassengerQueueSchema.statics.isWaiting = function (userId, eventoId) {
  return this.exists({ userId, eventoId, estado: 'en_espera' });
};

module.exports = mongoose.model('PassengerQueue', PassengerQueueSchema);
