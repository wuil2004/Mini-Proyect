# Usamos Node.js igual que en el backend
FROM node:20-alpine

# Carpeta de trabajo
WORKDIR /app

# Copiamos dependencias e instalamos
COPY package*.json ./
RUN npm install

# Copiamos el resto del código de React
COPY . .

# Vite usa por defecto el puerto 5173
EXPOSE 5173

# Encendemos Vite permitiendo que escuche fuera del contenedor (--host)
CMD ["npm", "run", "dev", "--", "--host"]