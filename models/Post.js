const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: String, required: true },
  content: { type: String, required: true },
  likes: { type: Number, default: 0 },
  likedBy: [String],
  tags: [String], // etiquetas de otros cruzados
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
