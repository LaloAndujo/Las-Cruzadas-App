const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  nickname: { type: String, required: true },
  points: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },
  qrId: { type: String, unique: true, default: uuidv4 }
}, { timestamps: true });

UserSchema.methods.verifyPassword = async function (pw) {
  return bcrypt.compare(pw, this.passwordHash);
};

UserSchema.statics.register = async function ({ email, password, nickname }) {
  const hash = await bcrypt.hash(password, 10);
  return this.create({ email, passwordHash: hash, nickname });
};

module.exports = mongoose.model('User', UserSchema);
