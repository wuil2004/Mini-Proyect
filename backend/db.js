const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Intentamos conectarnos usando la variable del archivo .env
    await mongoose.connect(process.env.MONGO_URI);
    console.log('¡Conectado a la base de datos MongoDB!');
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1); // Detiene el servidor si falla la conexión
  }
};

module.exports = connectDB;