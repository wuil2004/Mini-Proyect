const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const connectDB = require('./db');

// Inicializamos la app de Express
const app = express();

// Middlewares básicos
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json()); 

// --- RUTAS DE LA API ---
app.use('/api/auth', require('./routes/auth')); 
app.use('/api/posts', require('./routes/posts'));
// Conectamos las funciones de usuarios directamente aquí:
app.use('/api/users', require('./routes/posts')); 

// Creamos el servidor HTTP (necesario para Socket.io)
const server = http.createServer(app);

// Inicializamos Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});
app.set('socketio', io);

io.on('connection', (socket) => {
  console.log(`Usuario conectado con ID: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

app.get('/', (req, res) => {
  res.send('¡API de Canary funcionando al 100%!');
});

// Conectar a MongoDB
connectDB();

// Encendemos el servidor
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});