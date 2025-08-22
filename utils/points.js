const BASE_POINTS = 5;
const POINTS = {
  POST: BASE_POINTS,
  TAG_PER: 1,
  TAG_MAX: 5,
  LIKE_GIVER: 1,
  EVENT_CREATE: BASE_POINTS * 2,
  PASSENGER: Math.floor(BASE_POINTS / 2),
  DRIVER: BASE_POINTS * 3
};
const User = require('../models/User');

async function addPoints(userId, amount) {
  if (!amount) return;
  await User.updateOne({ _id: userId }, { $inc: { points: amount } });
}

module.exports = { POINTS, addPoints };
