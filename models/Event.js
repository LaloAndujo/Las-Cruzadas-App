const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  nombre: String,
  descripcion: String,
  fecha: Date,
  ubicacion: String,
  pasajeros: [{ type: String }],
  conductores: [{
    nickname: String,
    auto: String,
    lugaresDisponibles: Number,
    horaSalida: String,
    puntoReunion: String
  }]
});

module.exports = mongoose.model('Event', eventSchema);