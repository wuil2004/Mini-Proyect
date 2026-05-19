# Canary 🐦 - Red Social Multiplataforma en Tiempo Real

Canary es una aplicación full-stack inspirada en Twitter/X que permite a los usuarios publicar mensajes con imágenes, interactuar en tiempo real y gestionar su propia red de contactos. El proyecto cuenta con un backend robusto en Node.js, un cliente web construido en React (Vite) y una aplicación móvil nativa desarrollada con React Native (Expo).

---

## 🚀 Características del Proyecto

- **Autenticación Segura:** Registro e inicio de sesión utilizando JSON Web Tokens (JWT) con almacenamiento persistente seguro (`SecureStore` en móvil / `localStorage` en web).
- **Muro en Tiempo Real (Websockets):** Sincronización instantánea de publicaciones y "Likes" utilizando Socket.io en todas las plataformas.
- **Carga de Imágenes en la Nube:** Integración completa con Cloudinary mediante Multer para el procesamiento, compresión y almacenamiento de fotos de perfil y posts.
- **Scroll Infinito (Paginación):** Optimización de consultas a la base de datos MongoDB utilizando esquemas de `skip` y `limit` de 10 en 10 posts para prevenir bloqueos de memoria.
- **Sistema de Seguidores Dinámico:** Pestañas separadas para el Muro Global y el Muro de Siguiendo, además de modales interactivos para auditar seguidores y realizar *unfollow* inmediato.

---

## 🛠️ Arquitectura del Sistema

El proyecto está estructurado como un monorepositorio con tres componentes principales:

1. **`backend/`**: Servidor API REST y servidor WebSocket corriendo sobre Node.js, Express y Mongoose.
2. **`frontend/`**: Aplicación web SPA optimizada y veloz con React, Vite y CSS embebido.
3. **`mobile/`**: Aplicación móvil nativa para Android/iOS usando React Native, Expo y Expo Router.

---

## 📌 Configuración y Cambios Clave para Despliegue Local

Para que la aplicación funcione correctamente en tu red local (especialmente la comunicación con el celular), se deben ajustar los siguientes puntos clave:

### 1. Variables de Entorno del Backend (`backend/.env`)
Asegúrate de tener un archivo `.env` configurado con tus credenciales de MongoDB y Cloudinary:
```env
MONGO_URI=mongodb://root:example@mongo:27017/minitwitter?authSource=admin
JWT_SECRET=TuPalabraSecretaSuperSegura
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret