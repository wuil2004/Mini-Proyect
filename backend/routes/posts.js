const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const auth = require('../middleware/authMiddleware'); 
const mongoose = require('mongoose'); 

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Configurar Cloudinary con tus variables del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configurar el almacenamiento en la nube
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'canary_posts', // Así se llamará la carpeta dentro de tu Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'], // Formatos permitidos
  },
});

// 3. Este es el "middleware" que usaremos en la ruta
const upload = multer({ storage: storage });

// 1. Obtener todos los posts (GET) - Esta se queda igual (pública)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las publicaciones', error });
  }
});

// 2. Crear un nuevo post (POST) - ¡Soporta texto e imágenes en la nube!
// Metemos 'upload.single('image')' para que intercepte el archivo llamado 'image'
router.post('/', auth, upload.single('image'), async (req, res) => { 
  try {
    const { content } = req.body;
    
    // Si el usuario subió un archivo, Multer-Cloudinary nos deja la URL en req.file.path
    const imageUrl = req.file ? req.file.path : null;
    
    const newPost = new Post({ 
        content, 
        author: req.user.username,
        image: imageUrl // Guardamos el link de internet real aquí 
    });
    
    const savedPost = await newPost.save();
    
    // Magia reactiva para que le aparezca a todos en tiempo real
    const io = req.app.get('socketio');
    io.emit('new_post', savedPost);
    
    res.status(201).json(savedPost);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear la publicación', error });
  }
});

// 3. Dar/Quitar "Like" a un post (PUT /api/posts/:id/like)
router.put('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    const index = post.likes.indexOf(req.user.username);

    if (index === -1) {
      post.likes.push(req.user.username);
    } else {
      post.likes.splice(index, 1);
    }

    const updatedPost = await post.save();

    const io = req.app.get('socketio');
    io.emit('post_liked', updatedPost);

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar like', error });
  }
});

// --- NUEVAS RUTAS DE USUARIOS (Buscador y Perfil) ---

// 1. Ruta para buscar usuarios 
router.get('/search', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.json([]);

    const User = mongoose.model('User');
    const usuarios = await User.find({
      username: { $regex: username, $options: 'i' }
    }).select('username').limit(5);

    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

// 2. Ruta para obtener el perfil
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const Post = mongoose.model('Post');

    const userPosts = await Post.find({ author: username }).sort({ createdAt: -1 });

    let totalLikes = 0;
    userPosts.forEach(post => {
      totalLikes += post.likes.length;
    });

    res.json({
      username,
      posts: userPosts,
      totalLikes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

module.exports = router;