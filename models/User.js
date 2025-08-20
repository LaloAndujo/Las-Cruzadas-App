// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const BCRYPT_PREFIX = '$2'; // para detectar si ya está hasheado

const UserSchema = new mongoose.Schema({
  username: { type: String, trim: true, default: '' },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true, // normalización adicional en pre('save')
  },

  // Estándar actual (oculto por default)
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

/* ---------- Índices y collation (case-insensitive para email/nickname) ---------- */
UserSchema.index({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
UserSchema.index({ nickname: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

/* ---------- Hooks ---------- */
UserSchema.pre('save', async function(next) {
  try {
    // Normaliza email
    if (this.isModified('email') && this.email) {
      this.email = this.email.trim().toLowerCase();
    }
    // Asegura qrId
    if (!this.qrId) this.qrId = randomUUID();

    // Si cambiaron el password y viene en claro, hashealo aquí (evita double-hash)
    if (this.isModified('password') && this.password) {
      if (!this.password.startsWith(BCRYPT_PREFIX)) {
        this.password = await bcrypt.hash(this.password, 10);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

/* ---------- Métodos de instancia ---------- */
UserSchema.methods.verifyPassword = async function (plain) {
  // intenta contra password (nuevo) y passwordHash (legacy)
  const hasNew = typeof this.password === 'string' && this.password.length > 0;
  const hasLegacy = typeof this.passwordHash === 'string' && this.passwordHash.length > 0;

  // Si password no fue seleccionado (por select:false), vuelve a cargar con los campos
  if (!hasNew && !hasLegacy) {
    const fresh = await this.constructor.findById(this._id).select('+password +passwordHash');
    if (!fresh) return false;

    // compara con nuevo primero
    if (fresh.password && await bcrypt.compare(plain, fresh.password)) {
      return true;
    }
    // compara con legacy y migra si es correcto
    if (fresh.passwordHash && await bcrypt.compare(plain, fresh.passwordHash)) {
      // migración silenciosa a estándar nuevo
      fresh.password = fresh.passwordHash; // se re-hasheará en setPassword (abajo) o guarda directa
      await fresh.setPassword(plain);      // re-hash correcto y limpia passwordHash
      return true;
    }
    return false;
  }

  if (hasNew && await bcrypt.compare(plain, this.password)) return true;

  if (hasLegacy && await bcrypt.compare(plain, this.passwordHash)) {
    // migración silenciosa
    await this.setPassword(plain);
    return true;
  }

  return false;
};

UserSchema.methods.setPassword = async function (plain) {
  this.password = await bcrypt.hash(plain, 10);
  // Opcional: limpia legacy
  if (this.passwordHash) this.passwordHash = undefined;
  await this.save();
};

/* ---------- Métodos estáticos ---------- */
UserSchema.statics.register = async function ({ email, password, nickname, username = '' }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  return this.create({
    email: emailNorm,
    password: hash,  // estándar actual
    nickname,
    username,
  });
};

module.exports = mongoose.model('User', UserSchema);
