const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxLength: 280 // Al puro estilo de micro-blogging
  },
  author: {
    type: String,
    required: true,
    default: "Anónimo" 
  },
  image: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  likes: {
    type: [String], // Guardamos los usernames de quienes dieron like
    default: []
  }
}, {
  timestamps: true // Esto agrega automáticamente 'createdAt' y 'updatedAt' a cada post
});

module.exports = mongoose.model('Post', postSchema);