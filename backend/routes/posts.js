const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const auth = require('../middleware/authMiddleware'); 
const mongoose = require('mongoose'); 

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'canary_posts', allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
});

const upload = multer({ storage: storage });

// ==========================================
// 1. FEED GLOBAL (Con Paginación / Scroll Infinito)
// ==========================================
router.get('/', async (req, res) => {
  try {
    // Recibimos qué página quiere ver el usuario (por defecto la 1) y cuántos posts por página (10)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Calculamos cuántos posts saltarnos. Si es la pág 1, salta 0. Si es la pág 2, salta 10.
    const skip = (page - 1) * limit;

    // Buscamos con .skip() y .limit()
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
    const User = mongoose.model('User');

    const postsConAvatars = await Promise.all(
      posts.map(async (post) => {
        const usuario = await User.findOne({ username: post.author }).select('profilePicture').lean();
        return { ...post, authorAvatar: usuario ? usuario.profilePicture : null };
      })
    );

    res.json(postsConAvatars);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las publicaciones globales', error });
  }
});

// ==========================================
// 2. FEED PERSONAL (Con Paginación / Scroll Infinito)
// ==========================================
router.get('/feed/following', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const User = mongoose.model('User');
    const currentUser = await User.findOne({ username: req.user.username }).lean();

    const autoresPermitidos = [...currentUser.following, req.user.username];

    const posts = await Post.find({ author: { $in: autoresPermitidos } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const postsConAvatars = await Promise.all(
      posts.map(async (post) => {
        const usuario = await User.findOne({ username: post.author }).select('profilePicture').lean();
        return { ...post, authorAvatar: usuario ? usuario.profilePicture : null };
      })
    );

    res.json(postsConAvatars);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar tu feed personal', error });
  }
});

// 3. Crear un nuevo post (POST)
router.post('/', auth, upload.single('image'), async (req, res) => { 
  try {
    const { content } = req.body;
    const imageUrl = req.file ? req.file.path : null;
    
    const newPost = new Post({ content, author: req.user.username, image: imageUrl });
    const savedPost = await newPost.save();
    
    const User = mongoose.model('User');
    const usuario = await User.findOne({ username: req.user.username }).select('profilePicture').lean();

    const postParaEmitir = { ...savedPost.toObject(), authorAvatar: usuario ? usuario.profilePicture : null };

    const io = req.app.get('socketio');
    io.emit('new_post', postParaEmitir);
    
    res.status(201).json(postParaEmitir);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear la publicación', error });
  }
});

// 4. Dar/Quitar "Like"
router.put('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Publicación no encontrada' });

    const index = post.likes.indexOf(req.user.username);
    if (index === -1) post.likes.push(req.user.username);
    else post.likes.splice(index, 1);

    const updatedPost = await post.save();
    const io = req.app.get('socketio');
    io.emit('post_liked', updatedPost);

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar like', error });
  }
});

// 5. Buscar usuarios 
router.get('/search', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.json([]);

    const User = mongoose.model('User');
    const usuarios = await User.find({ username: { $regex: username, $options: 'i' } }).select('username').limit(5);
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

// 6. Obtener Perfil (Limitamos a los últimos 30 posts para no saturar)
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const Post = mongoose.model('Post');
    const User = mongoose.model('User');

    const userInfo = await User.findOne({ username }).select('bio profilePicture followers following');
    if (!userInfo) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Le ponemos un límite de 30 al perfil para protegerlo también
    const userPosts = await Post.find({ author: username }).sort({ createdAt: -1 }).limit(30).lean();

    const postsConAvatars = userPosts.map(post => ({ ...post, authorAvatar: userInfo.profilePicture }));

    let totalLikes = 0;
    postsConAvatars.forEach(post => { totalLikes += (post.likes || []).length; });

    res.json({
      username,
      bio: userInfo.bio,
      profilePicture: userInfo.profilePicture,
      followers: userInfo.followers, 
      following: userInfo.following, 
      posts: postsConAvatars,
      totalLikes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// 7. SEGUIR / DEJAR DE SEGUIR
router.put('/profile/:username/follow', auth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const userToFollow = await User.findOne({ username: req.params.username });
    const currentUser = await User.findOne({ username: req.user.username });

    if (!userToFollow || !currentUser) return res.status(404).json({ message: "Usuario no encontrado" });
    
    if (userToFollow.username === currentUser.username) {
      return res.status(400).json({ message: "No puedes seguirte a ti mismo" });
    }

    const isFollowing = currentUser.following.includes(userToFollow.username);

    if (isFollowing) {
      currentUser.following = currentUser.following.filter(u => u !== userToFollow.username);
      userToFollow.followers = userToFollow.followers.filter(u => u !== currentUser.username);
    } else {
      currentUser.following.push(userToFollow.username);
      userToFollow.followers.push(currentUser.username);
    }

    await currentUser.save();
    await userToFollow.save();

    res.json({ 
      message: isFollowing ? 'Dejaste de seguir al usuario' : 'Ahora sigues al usuario', 
      isFollowing: !isFollowing 
    });

  } catch (error) {
    console.log("Error al seguir/dejar de seguir:", error);
    res.status(500).json({ error: 'Error interno al procesar el follow' });
  }
});

// 8. Editar el perfil
router.put('/profile/edit', auth, upload.single('image'), async (req, res) => {
  try {
    const { bio } = req.body;
    const User = mongoose.model('User');
    
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (bio !== undefined) user.bio = bio;

    if (req.file) {
      if (user.profilePicture) {
        try {
          const urlParts = user.profilePicture.split('/');
          const folderAndFile = urlParts.slice(-2).join('/');
          const publicId = folderAndFile.split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (err) { }
      }
      user.profilePicture = req.file.path;
    }

    await user.save();
    res.json({ message: 'Perfil actualizado exitosamente', user: { bio: user.bio, profilePicture: user.profilePicture } });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});

// 9. Eliminar un post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Publicación no encontrada' });
    if (post.author !== req.user.username) return res.status(403).json({ message: 'No tienes permiso para borrar este trino' });

    if (post.image) {
      try {
        const urlParts = post.image.split('/');
        const folderAndFile = urlParts.slice(-2).join('/');
        const publicId = folderAndFile.split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (e) { }
    }

    await post.deleteOne();
    const io = req.app.get('socketio');
    io.emit('post_deleted', req.params.id);

    res.json({ message: 'Trino e imagen eliminados correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar la publicación' });
  }
});

module.exports = router;