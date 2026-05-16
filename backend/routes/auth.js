const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. Registro de usuario (POST /api/auth/register)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Verificar si el correo o el @usuario ya existen en la base de datos
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'El usuario o correo ya está registrado' });
    }

    // Encriptar la contraseña (creamos un "salt" y luego hasheamos)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear y guardar el nuevo usuario
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await newUser.save();

    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al registrar', error });
  }
});

// 2. Inicio de sesión (POST /api/auth/login)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar al usuario por su correo
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Comparar la contraseña ingresada con la contraseña encriptada en la base de datos
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Crear el "gafete virtual" (Token JWT) usando la clave secreta de tu archivo .env
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // El token expira en 1 día por seguridad
    );

    // Devolvemos el token y los datos básicos del usuario
    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión', error });
  }
});

module.exports = router;