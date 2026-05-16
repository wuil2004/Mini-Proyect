# Usamos una imagen ligera de Node.js
FROM node:20-alpine

# Creamos la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias primero
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto de tu API
EXPOSE 4000

# El comando para encenderlo usando tu script de nodemon
CMD ["npm", "run", "dev"]