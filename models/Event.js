// models/Event.js
const mongoose = require('mongoose');

const ConductorSchema = new mongoose.Schema({
  nickname: { type: String, required: true, trim: true },
  auto:      { type: String, required: true, trim: true }, // p.ej. "Sedán", "SUV"...
  lugaresDisponibles: {
    type: Number,
    required: true,
    min: [1, 'Debe haber al menos 1 lugar'],
    max: [8, 'Demasiados lugares (máx 8)']
  },
  horaSalida:   { type: String, required: true, trim: true }, // "18:30" o texto corto
  puntoReunion: { type: String, required: true, trim: true }
}, { _id: false });

const EventSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del evento es obligatorio'],
    trim: true,
    maxlength: 140
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  fecha: {
    type: Date,
    required: [true, 'La fecha del evento es obligatoria'],
    index: true
  },
  ubicacion: {
    type: String,
    required: [true, 'La ubicación es obligatoria'],
    trim: true,
    maxlength: 200
  },

  // Nuevo: creador del evento
  creador: {
    type: String, // guardamos nickname del usuario creador
    required: [true, 'El creador del evento es obligatorio'],
    trim: true
  },

  // Participantes
  pasajeros: [{
    type: String, // guardamos nickname
    trim: true
  }],

  conductores: [ConductorSchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* ---------- Virtuales de compatibilidad (frontend) ---------- */
EventSchema.virtual('titulo').get(function () { return this.nombre; });
EventSchema.virtual('lugar').get(function () { return this.ubicacion; });

/* ---------- Virtuales útiles ---------- */
// Conteos rápidos
EventSchema.virtual('totalPasajeros').get(function () {
  return (this.pasajeros || []).length;
});
EventSchema.virtual('totalConductores').get(function () {
  return (this.conductores || []).length;
});
EventSchema.virtual('lugaresTotales').get(function () {
  return (this.conductores || []).reduce((acc, c) => acc + (c.lugaresDisponibles || 0), 0);
});

// Si además manejas asientos por Ride, este es “meta-capacidad” declarada en el evento
EventSchema.virtual('lugaresLibres').get(function () {
  return (this.conductores || []).reduce((acc, c) => acc + (c.lugaresDisponibles || 0), 0) - (this.pasajeros?.length || 0);
});

/* ---------- Validaciones ligeras ---------- */
// Evita duplicar pasajeros por nickname (a nivel documento)
EventSchema.pre('save', function (next) {
  if (Array.isArray(this.pasajeros)) {
    const set = new Set(this.pasajeros.map(p => (p || '').trim()));
    this.pasajeros = Array.from(set).filter(Boolean);
  }
  next();
});

/* ---------- Índices recomendados ---------- */
EventSchema.index({ fecha: 1 });
EventSchema.index({ nombre: 'text', ubicacion: 'text' }); // búsquedas por texto

/* ---------- Métodos/Estáticos prácticos ---------- */
EventSchema.statics.upcoming = function () {
  return this.find({ fecha: { $gte: new Date() } }).sort({ fecha: 1 });
};
EventSchema.statics.past = function () {
  return this.find({ fecha: { $lt: new Date() } }).sort({ fecha: -1 });
};

module.exports = mongoose.model('Event', EventSchema);
