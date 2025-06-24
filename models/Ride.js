const mongoose = require('mongoose');

const asientoSchema = new mongoose.Schema({
  lugar: Number,
  ocupadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

const rideSchema = new mongoose.Schema({
  conductorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  espaciosDisponibles: {
    type: Number,
    required: true
  },
  puntoSalida: String,
  horarioSalida: String,
  asientos: [asientoSchema],
  pasajeros: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

module.exports = mongoose.model('Ride', rideSchema);