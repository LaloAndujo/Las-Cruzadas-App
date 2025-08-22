const express = require('express');
const Ride = require('../models/Ride');
const router = express.Router();

router.post('/', async (req, res) => {
  const { eventId, driver, seats } = req.body;
  const ride = new Ride({ eventId, driver, seats, passengers: [] });
  await ride.save();
  res.json(ride);
});

router.get('/:eventId', async (req, res) => {
  const rides = await Ride.find({ eventId: req.params.eventId });
  res.json(rides);
});

router.post('/:id/join', async (req, res) => {
  const { nickname } = req.body;
  const ride = await Ride.findById(req.params.id);
  if (ride.passengers.length < ride.seats) {
    ride.passengers.push(nickname);
    await ride.save();
  }
  res.json(ride);
});

module.exports = router;
