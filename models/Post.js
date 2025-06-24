const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: String,
  content: String,
  date: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  likedBy: [String], // Lista de apodos que dieron like
  tags: [String]     // Etiquetas tipo @apodo
});

module.exports = mongoose.model('Post', postSchema);