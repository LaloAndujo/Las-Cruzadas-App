// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const UserSchema = new mongoose.Schema({
  username: { type: String, trim: true, default: '' },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },

  // Nuevo estándar
  password: { type: String, select: false },

  // Legacy (para usuarios antiguos)
  passwordHash: { type: String, select: false },

  nickname: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },

  points: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },

  qrId: {
    type: String,
    unique: true,
    default: randomUUID,
  },

  profilePic: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password;
      delete ret.passwordHash;
      return ret;
    }
  }
});

/* ---------- Hooks ---------- */
UserSchema.pre('save', function(next) {
  if (this.isModified('email') && this.email) {
    this.email = this.email.trim().toLowerCase();
  }
  if (!this.qrId) this.qrId = randomUUID();
  next();
});

/* ---------- Métodos ---------- */
UserSchema.methods.verifyPassword = async function (plain) {
  const hash = this.password || this.passwordHash; // fallback
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
};

/* ---------- Estáticos ---------- */
UserSchema.statics.register = async function ({ email, password, nickname, username = '' }) {
  const hash = await bcrypt.hash(password, 10);
  return this.create({
    email,
    password: hash,  // todo lo nuevo se guarda aquí
    nickname,
    username,
  });
};

module.exports = mongoose.model('User', UserSchema);
