// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto'); // ✅ sin dependencia externa

const UserSchema = new mongoose.Schema({
  // opcional en tu server viejo
  username: { type: String, trim: true, default: '' },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true, // normaliza
  },

  // guardamos el HASH aquí (tu server lo llama "password")
  password: {
    type: String,
    required: true,
    select: false, // no se devuelve por defecto en queries
  },

  nickname: {
    type: String,
    required: true,
    trim: true,
    unique: true, // si te diera conflicto por duplicados viejos, cámbialo a index: true
  },

  points: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },

  qrId: {
    type: String,
    unique: true,
    default: randomUUID, // 👈 genera uno nuevo si no existe
  },

  profilePic: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password; // oculta hash al serializar
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
UserSchema.methods.verifyPassword = function (plain) {
  // OJO: si haces findOne({ _id }) sin .select('+password'), password no viene
  // usa User.findById(id).select('+password') cuando vayas a verificar
  return bcrypt.compare(plain, this.password);
};

/* ---------- Estáticos ---------- */
UserSchema.statics.register = async function ({ email, password, nickname, username = '' }) {
  const hash = await bcrypt.hash(password, 10);
  return this.create({
    email,
    password: hash,
    nickname,
    username,
  });
};

module.exports = mongoose.model('User', UserSchema);
