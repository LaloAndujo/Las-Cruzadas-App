// models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  tags: {
    type: [String],
    default: []
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: {
    type: [String],   // guardamos nicks
    default: []
  }
}, {
  timestamps: true // <- crea createdAt/updatedAt (el feed ya usa createdAt)
});

module.exports = mongoose.model('Post', PostSchema);
