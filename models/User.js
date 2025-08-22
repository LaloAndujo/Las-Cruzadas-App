// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const BCRYPT_PREFIX = '$2';

const UserSchema = new mongoose.Schema({
  username: { type: String, trim: true, default: '' },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, select: false },       // estándar actual
  passwordHash: { type: String, select: false },   // legacy
  nickname: { type: String, required: true, trim: true, unique: true },
  points: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },
  qrId: { type: String, unique: true, default: randomUUID },
  profilePic: { type: String, default: '' },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => { delete ret.password; delete ret.passwordHash; return ret; }
  }
});

UserSchema.index({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
UserSchema.index({ nickname: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

UserSchema.pre('save', async function (next) {
  try {
    if (this.isModified('email') && this.email) this.email = this.email.trim().toLowerCase();
    if (!this.qrId) this.qrId = randomUUID();
    if (this.isModified('password') && this.password) {
      if (!this.password.startsWith(BCRYPT_PREFIX)) {
        this.password = await bcrypt.hash(this.password, 10);
      }
    }
    next();
  } catch (err) { next(err); }
});

UserSchema.methods.verifyPassword = async function (plain) {
  const hasNew = typeof this.password === 'string' && this.password.length > 0;
  const hasLegacy = typeof this.passwordHash === 'string' && this.passwordHash.length > 0;

  if (!hasNew && !hasLegacy) {
    const fresh = await this.constructor.findById(this._id).select('+password +passwordHash');
    if (!fresh) return false;
    if (fresh.password && await bcrypt.compare(plain, fresh.password)) return true;
    if (fresh.passwordHash && await bcrypt.compare(plain, fresh.passwordHash)) {
      await fresh.setPassword(plain);
      return true;
    }
    return false;
  }

  if (hasNew && await bcrypt.compare(plain, this.password)) return true;
  if (hasLegacy && await bcrypt.compare(plain, this.passwordHash)) {
    await this.setPassword(plain);
    return true;
  }
  return false;
};

UserSchema.methods.setPassword = async function (plain) {
  this.password = await bcrypt.hash(plain, 10);
  if (this.passwordHash) this.passwordHash = undefined;
  await this.save();
};

UserSchema.statics.register = async function ({ email, password, nickname, username = '' }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  return this.create({ email: emailNorm, password: hash, nickname, username });
};

module.exports = mongoose.model('User', UserSchema);
