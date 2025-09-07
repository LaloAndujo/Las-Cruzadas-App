const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    nickname: { type: String, required: true },
    email: { type: String },
    password: { type: String, required: true },
    points: { type: Number, default: 50 }, // bonus de bienvenida
    is_admin: { type: Boolean, default: false },
    profile_picture: { type: String, default: "" },
    last_active: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Encriptar password
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
