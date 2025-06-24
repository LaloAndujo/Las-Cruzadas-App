const mongoose = require('mongoose');

const passengerQueueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  estado: {
    type: String,
    enum: ['en_espera', 'asignado'],
    default: 'en_espera'
  }
});

module.exports = mongoose.model('PassengerQueue', passengerQueueSchema);