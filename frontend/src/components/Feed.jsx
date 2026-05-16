import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:4000");

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [newContent, setNewContent] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  
  // --- NUEVO ESTADO: Para saber si está subiendo la foto y bloquear el botón ---
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLikes, setProfileLikes] = useState(0);

  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username");

  const cargarFeedGeneral = async () => {
    try {
      const response = await fetch("http://localhost:4000/api/posts");
      const data = await response.json();
      setPosts(data);
      setSelectedProfile(null);
    } catch (error) {
      console.error("Error al cargar posts:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    cargarFeedGeneral();

    socket.on("new_post", (postGuardado) => {
      setPosts((postsAnteriores) => [postGuardado, ...postsAnteriores]);
    });

    socket.on("post_liked", (postActualizado) => {
      setPosts((postsAnteriores) =>
        postsAnteriores.map((post) =>
          post._id === postActualizado._id ? postActualizado : post
        )
      );
    });

    return () => {
      socket.off("new_post");
      socket.off("post_liked");
    };
  }, [navigate]);

  const handleSearch = async (e) => {
    const texto = e.target.value;
    setSearchQuery(texto);

    if (!texto.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`http://localhost:4000/api/users/search?username=${texto}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error al buscar usuarios:", error);
    }
  };

  const verPerfilUsuario = async (username) => {
    try {
      setSearchQuery("");
      setSearchResults([]); 
      
      const response = await fetch(`http://localhost:4000/api/users/profile/${username}`);
      const data = await response.json();
      
      setSelectedProfile(data.username);
      setPosts(data.posts);
      setProfileLikes(data.totalLikes);
    } catch (error) {
      console.error("Error al cargar perfil:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Si no hay texto o si YA está publicando, no hacemos nada (evita clones)
    if (!newContent.trim() || isPublishing) return;

    // Bloqueamos el botón
    setIsPublishing(true);

    const token = localStorage.getItem("token");
    
    const formData = new FormData();
    formData.append("content", newContent);
    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    try {
      await fetch("http://localhost:4000/api/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      setNewContent("");
      setSelectedImage(null); 
      document.getElementById("imageInput").value = ""; 
    } catch (error) {
      console.error("Error al publicar:", error);
    } finally {
      // Pase lo que pase (éxito o error), volvemos a desbloquear el botón al final
      setIsPublishing(false);
    }
  };

  const handleLike = async (postId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`http://localhost:4000/api/posts/${postId}/like`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("Error al dar like:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem", position: "relative" }}>
      
      {/* Header Superior */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          backgroundColor: "white",
          padding: "1rem",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h2 
          onClick={cargarFeedGeneral} 
          style={{ margin: 0, color: "#1d9bf0", cursor: "pointer" }}
        >
          Canary 🐦
        </h2>
        <div>
          <span 
            onClick={() => verPerfilUsuario(currentUser)}
            style={{ marginRight: "1rem", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}
          >
            @{currentUser}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
            }}
          >
            Salir
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div style={{ marginBottom: "1.5rem", position: "relative" }}>
        <input
          type="text"
          placeholder="🔍 Buscar usuarios..."
          value={searchQuery}
          onChange={handleSearch}
          style={{
            width: "100%",
            padding: "0.7rem 1rem",
            borderRadius: "20px",
            border: "1px solid #ccc",
            boxSizing: "border-box",
            fontSize: "1rem"
          }}
        />

        {searchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              zIndex: 100,
              marginTop: "5px"
            }}
          >
            {searchResults.map((user) => (
              <div
                key={user._id}
                onClick={() => verPerfilUsuario(user.username)}
                style={{
                  padding: "0.8rem 1rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#1d9bf0",
                  borderBottom: "1px solid #f0f2f5"
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = "#f0f2f5"}
                onMouseOut={(e) => e.target.style.backgroundColor = "white"}
              >
                @{user.username}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProfile ? (
        <div
          style={{
            backgroundColor: "white",
            padding: "1.5rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            textAlign: "center"
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0" }}>Perfil de @{selectedProfile}</h3>
          <p style={{ color: "#666", margin: "0 0 1rem 0" }}>
            ✨ {posts.length} Publicaciones  |  ❤️ {profileLikes} Likes recibidos en total
          </p>
          <button
            onClick={cargarFeedGeneral}
            style={{
              padding: "0.5rem 1.5rem",
              backgroundColor: "#1d9bf0",
              color: "white",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            ⬅ Volver al Feed General
          </button>
        </div>
      ) : (
        /* Caja para redactar un post */
        <div
          style={{
            backgroundColor: "white",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <textarea
              placeholder="¿Qué vas a cantar hoy?..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              maxLength={280}
              style={{
                width: "100%",
                height: "80px",
                padding: "0.8rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
                resize: "none",
                boxSizing: "border-box",
              }}
            />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <input 
                type="file" 
                id="imageInput"
                accept="image/*" 
                onChange={(e) => setSelectedImage(e.target.files[0])}
                style={{ fontSize: "0.9rem" }}
              />

              {/* --- BOTÓN ACTUALIZADO CON ESTADO DE CARGA --- */}
              <button
                type="submit"
                disabled={isPublishing} // Desactiva el clic en HTML
                style={{
                  padding: "0.6rem 1.5rem",
                  backgroundColor: isPublishing ? "#88c9f9" : "#1d9bf0", // Se pone más claro si está cargando
                  color: "white",
                  border: "none",
                  borderRadius: "20px",
                  cursor: isPublishing ? "not-allowed" : "pointer", // Cambia el cursor del mouse
                  fontWeight: "bold",
                }}
              >
                {isPublishing ? "Trinando..." : "Trinar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Muro de publicaciones */}
      <div>
        {posts.map((post) => (
          <div
            key={post._id}
            style={{
              backgroundColor: "white",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <h4 
              onClick={() => verPerfilUsuario(post.author)}
              style={{ margin: "0 0 0.5rem 0", color: "#1d9bf0", cursor: "pointer", display: "inline-block" }}
            >
              @{post.author}
            </h4>
            <p style={{ margin: 0, color: "#555", fontSize: "1.1rem" }}>
              {post.content}
            </p>

            {post.image && (
              <img 
                src={post.image} 
                alt="Imagen del trino" 
                style={{ 
                  width: "100%", 
                  borderRadius: "8px", 
                  marginTop: "1rem",
                  maxHeight: "400px",
                  objectFit: "cover"
                }} 
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "1rem",
              }}
            >
              <small style={{ color: "#aaa" }}>
                {new Date(post.createdAt).toLocaleString()}
              </small>
              <button
                onClick={() => handleLike(post._id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#e0245e",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                {post.likes.includes(currentUser) ? "❤️" : "🤍"}
                {post.likes.length}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Feed;