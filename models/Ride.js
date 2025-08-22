const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  driver: String,
  seats: Number,
  passengers: [String]
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
