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

// 4. Eliminar un post (DELETE /api/posts/:id) - ¡Limpia MongoDB Y Cloudinary!
router.delete('/:id', auth, async (req, res) => {
  try {
    // 1. Buscamos el post en la base de datos
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    // 2. Verificamos que el usuario logueado sea el dueño
    if (post.author !== req.user.username) {
      return res.status(403).json({ message: 'No tienes permiso para borrar este trino' });
    }

    // --- NUEVO: SI EL POST TIENE IMAGEN, LA BORRAMOS DE CLOUDINARY ---
    if (post.image) {
      try {
        // Cloudinary necesita el "Public ID" (el nombre del archivo sin la URL completa)
        // Ejemplo de URL: https://res.cloudinary.com/demo/image/upload/v1234/canary_posts/foto.jpg
        // Queremos sacar: "canary_posts/foto"
        const urlParts = post.image.split('/');
        const folderAndFile = urlParts.slice(-2).join('/'); // Toma "canary_posts/foto.jpg"
        const publicId = folderAndFile.split('.')[0]; // Quita el ".jpg" y deja "canary_posts/foto"

        // Le pegamos a la API de Cloudinary para destruirla
        await cloudinary.uploader.destroy(publicId);
        console.log(`☁️ Imagen eliminada de Cloudinary: ${publicId}`);
      } catch (cloudinaryError) {
        // Si por algo falla Cloudinary, lo reportamos pero dejamos que el código siga para no trabar el borrado
        console.log("⚠️ Error al borrar de Cloudinary, pero se continuará con MongoDB:", cloudinaryError);
      }
    }

    // 3. Ahora sí, lo borramos de MongoDB
    await post.deleteOne();

    // 4. Le avisamos a todos por WebSockets
    const io = req.app.get('socketio');
    io.emit('post_deleted', req.params.id);

    res.json({ message: 'Trino e imagen eliminados correctamente' });
  } catch (error) {
    console.log("Error al eliminar:", error);
    res.status(500).json({ message: 'Error al eliminar la publicación', error });
  }
});

module.exports = router;