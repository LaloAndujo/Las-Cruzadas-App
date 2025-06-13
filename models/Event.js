const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  nombre: String,
  descripcion: String,
  fecha: Date,
  lugar: String,
  pasajeros: [{ type: String }], // lista de nicknames
  conductores: [{
    nickname: String,
    auto: String,
    lugaresDisponibles: Number,
    horaSalida: String,
    puntoReunion: String
  }]
});

module.exports = mongoose.model('Event', eventSchema);