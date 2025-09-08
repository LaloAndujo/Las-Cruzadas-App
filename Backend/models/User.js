const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true, trim: true },
    nickname: { type: String, required: true, trim: true },
    email:    { type: String, trim: true },
    password: { type: String, required: true, minlength: 6 },
    points:   { type: Number, default: 50 },       // bono de bienvenida
    is_admin: { type: Boolean, default: false },
    profile_picture: { type: String, default: '' },
    last_active: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Hash de contraseña
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Comparar contraseña
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
