// models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId: {                          // Relación con User
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userNickname: {                    // Guardamos el apodo para consultas rápidas sin populate
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  date: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{                           // Lista de @usuarios etiquetados
    type: String,
    trim: true
  }],
  lastEdited: { type: Date, default: null }
}, {
  timestamps: true
});

/* ---------- ÍNDICES ---------- */
// Para feed global ordenado por fecha
PostSchema.index({ date: -1 });
// Para buscar posts de un usuario rápido
PostSchema.index({ userId: 1, date: -1 });
// Para buscar posts donde está etiquetado
PostSchema.index({ tags: 1 });

/* ---------- MÉTODOS ---------- */

// Like con control de duplicados a nivel esquema
PostSchema.methods.addLike = async function (userId) {
  if (this.likedBy.some(id => id.toString() === userId.toString())) {
    return { success: false, message: 'Ya diste like' };
  }
  this.likedBy.push(userId);
  this.likes = this.likedBy.length;
  await this.save();
  return { success: true, likes: this.likes };
};

// Eliminar like
PostSchema.methods.removeLike = async function (userId) {
  const index = this.likedBy.findIndex(id => id.toString() === userId.toString());
  if (index === -1) return { success: false, message: 'No habías dado like' };
  this.likedBy.splice(index, 1);
  this.likes = this.likedBy.length;
  await this.save();
  return { success: true, likes: this.likes };
};

module.exports = mongoose.model('Post', PostSchema);
