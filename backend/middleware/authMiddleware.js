const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 1. Buscamos el token en las cabeceras (headers) de la petición
  const token = req.header('Authorization');

  // 2. Si no trae gafete, no entra
  if (!token) {
    return res.status(401).json({ message: 'No hay token, permiso denegado' });
  }

  try {
    // Los tokens por estándar se envían como "Bearer eyJhbGciOi...", 
    // así que le quitamos la palabra "Bearer " para quedarnos solo con el código
    const tokenLimpio = token.replace('Bearer ', '');

    // 3. Verificamos que el token sea auténtico usando tu palabra secreta
    const decoded = jwt.verify(tokenLimpio, process.env.JWT_SECRET);

    // 4. Si es válido, guardamos los datos del usuario en la petición y lo dejamos pasar
    req.user = decoded;
    next(); 
  } catch (error) {
    res.status(401).json({ message: 'Token no válido o expirado' });
  }
};