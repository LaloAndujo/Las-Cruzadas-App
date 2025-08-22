const express = require('express');
const Event = require('../models/Event');
const router = express.Router();

router.post('/', async (req, res) => {
  const { title, description, date, creator } = req.body;
  const event = new Event({ title, description, date, creator });
  await event.save();
  res.json(event);
});

router.get('/', async (req, res) => {
  const events = await Event.find();
  res.json(events);
});

router.post('/:id/join', async (req, res) => {
  const { nickname } = req.body;
  const event = await Event.findById(req.params.id);
  if (!event.attendees.includes(nickname)) {
    event.attendees.push(nickname);
    await event.save();
  }
  res.json(event);
});

module.exports = router;
