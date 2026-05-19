const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  bio: { type: String, default: "¡Hola! Soy nuevo en Canary 🐦", maxLength: 160 },
  profilePicture: { type: String, default: null },
  
  // --- NUEVO: Sistema de Seguidores ---
  followers: { 
    type: [String], // Aquí guardaremos los @nombres de los que te siguen
    default: [] 
  },
  following: { 
    type: [String], // Aquí guardaremos los @nombres de los que tú sigues
    default: [] 
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);