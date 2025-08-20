// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Email requerido'],
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      required: [true, 'Username requerido'],
      unique: true,
      index: true,
    },
    nickname: { type: String, trim: true, default: '' },

    // OJO: select:false para no exponerlo, pero en login lo solicitamos con .select('+password')
    password: {
      type: String,
      required: [true, 'Password requerido'],
      minlength: [6, 'Mínimo 6 caracteres'],
      select: false,
    },

    // Campos que ya usas o planeas usar
    points: { type: Number, default: 0 },
    roles: { type: [String], default: ['user'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Evitar re-hash si no cambió el password
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function (candidate) {
  // this.password existe solamente si fue seleccionado con .select('+password')
  return bcrypt.compare(candidate, this.password);
};

// En algunos despliegues, los índices únicos necesitan este hook para evitar errores ruidosos
UserSchema.post('save', function (error, doc, next) {
  if (error && error.code === 11000) {
    next(new Error('Email o username ya están en uso.'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('User', UserSchema);
