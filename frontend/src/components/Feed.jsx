import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:4000");

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);

  const [newContent, setNewContent] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLikes, setProfileLikes] = useState(0);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [myProfileData, setMyProfileData] = useState({
    bio: "",
    profilePicture: null,
  });

  const [feedType, setFeedType] = useState("global");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // --- NUEVO ESTADO: Controla la ventana de Seguidores / Siguiendo ---
  const [networkModal, setNetworkModal] = useState({ isOpen: false, title: "", users: [] });

  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username");

  const cargarFeed = async (type = feedType, nextPage = 1, isLoadMore = false) => {
    if (isLoadMore && (loadingMore || !hasMore)) return;
    if (isLoadMore) setLoadingMore(true);

    try {
      const token = localStorage.getItem("token");
      const baseUrl = type === "global" 
        ? "http://localhost:4000/api/posts" 
        : "http://localhost:4000/api/posts/feed/following";

      const response = await fetch(`${baseUrl}?page=${nextPage}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          alert("Tu sesión caducó o el token es inválido. Vuelve a ingresar.");
          handleLogout();
        }
        return; 
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        if (isLoadMore) {
          setPosts((prev) => [...prev, ...data]);
        } else {
          setPosts(data);
        }

        if (data.length < 10) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (error) {
      console.error("Error al cargar posts:", error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
    }
  };

  const loadMyData = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/profile/${currentUser}`
      );
      if (response.ok) {
        const data = await response.json();
        setMyProfileData({ bio: data.bio, profilePicture: data.profilePicture });
      }
    } catch (error) {
      console.log("No pude cargar tu foto", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (selectedProfile) return;

      const totalHeight = document.documentElement.offsetHeight;
      const currentScroll = window.innerHeight + document.documentElement.scrollTop;
      
      if (currentScroll >= totalHeight - 100) {
        if (hasMore && !loadingMore) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1;
            cargarFeed(feedType, nextPage, true);
            return nextPage;
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMore, feedType, selectedProfile]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setPage(1);
    setHasMore(true);
    cargarFeed(feedType, 1, false);
    loadMyData(); 

    socket.on("new_post", (postGuardado) => {
      const activeUser = localStorage.getItem("username");
      if (postGuardado.author === activeUser) {
        setPosts((postsAnteriores) => [postGuardado, ...postsAnteriores]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setPendingPosts((prev) => [postGuardado, ...prev]);
      }
    });

    socket.on("post_liked", (postActualizado) => {
      setPosts((postsAnteriores) =>
        postsAnteriores.map((post) =>
          post._id === postActualizado._id ? postActualizado : post
        )
      );
    });

    socket.on("post_deleted", (idEliminado) => {
      setPosts((postsAnteriores) =>
        postsAnteriores.filter((post) => post._id !== idEliminado)
      );
      setPendingPosts((prev) =>
        prev.filter((post) => post._id !== idEliminado)
      );
    });

    return () => {
      socket.off("new_post");
      socket.off("post_liked");
      socket.off("post_deleted");
    };
  }, [navigate, feedType]); 

  const handleSearch = async (e) => {
    const texto = e.target.value;
    setSearchQuery(texto);
    if (!texto.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/search?username=${texto}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Error al buscar usuarios:", error);
    }
  };

  const verPerfilUsuario = async (username) => {
    try {
      setSearchQuery("");
      setSearchResults([]);
      const response = await fetch(
        `http://localhost:4000/api/users/profile/${username}`
      );
      if (!response.ok) return;
      const data = await response.json();

      setSelectedProfile({
        username: data.username,
        bio: data.bio,
        profilePicture: data.profilePicture,
        followers: data.followers || [], 
        following: data.following || [],
      });
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setProfileLikes(data.totalLikes);
    } catch (error) {
      console.error("Error al cargar perfil:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newContent.trim() || isPublishing) return;

    setIsPublishing(true);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("content", newContent);
    if (selectedImage) formData.append("image", selectedImage);

    try {
      await fetch("http://localhost:4000/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      setNewContent("");
      setSelectedImage(null);
      document.getElementById("imageInput").value = "";
    } catch (error) {
      console.error("Error al publicar:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("bio", editBio);
    if (editAvatar) formData.append("image", editAvatar);

    try {
      const response = await fetch(
        `http://localhost:4000/api/users/profile/edit`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMyProfileData(data.user);
        setIsEditingProfile(false);
        verPerfilUsuario(currentUser);
      }
    } catch (error) {
      alert("Error al actualizar perfil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFollow = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/profile/${selectedProfile.username}/follow`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        verPerfilUsuario(selectedProfile.username);
      }
    } catch (error) {
      console.error("Error al procesar seguimiento:", error);
    }
  };

  // --- NUEVA FUNCIÓN: Dejar de seguir desde la lista del Modal ---
  const handleUnfollowFromList = async (userToUnfollow) => {
    const confirmar = window.confirm(`¿Dejar de seguir a @${userToUnfollow}?`);
    if (!confirmar) return;

    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/profile/${userToUnfollow}/follow`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        // Sacarlo visualmente de la lista del modal de inmediato
        setNetworkModal(prev => ({
          ...prev,
          users: prev.users.filter(u => u !== userToUnfollow)
        }));
        // Actualizar los números del perfil de fondo
        verPerfilUsuario(selectedProfile.username);
      }
    } catch (error) {
      console.error("Error al dejar de seguir:", error);
    }
  };

  const handleLike = async (postId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`http://localhost:4000/api/posts/${postId}/like`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("Error al dar like:", error);
    }
  };

  const handleDeletePost = async (postId) => {
    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar este trino?"
    );
    if (!confirmar) return;
    const token = localStorage.getItem("token");
    try {
      await fetch(`http://localhost:4000/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("Error al eliminar post:", error);
    }
  };

  const mostrarNuevosPosts = () => {
    setPosts((postsActuales) => [...pendingPosts, ...postsActuales]);
    setPendingPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clickLogoGeneral = () => {
    setFeedType("global");
    setSelectedProfile(null);
    setPage(1);
    setHasMore(true);
    cargarFeed("global", 1, false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  // --- FUNCIÓN PARA ABRIR EL MODAL DE LISTAS ---
  const openNetworkModal = (title, usersList) => {
    setNetworkModal({ isOpen: true, title, users: usersList });
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem", position: "relative" }}>
      
      {pendingPosts.length > 0 && !selectedProfile && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
          <button
            onClick={mostrarNuevosPosts}
            style={{
              backgroundColor: "#1d9bf0", color: "white", border: "none", padding: "10px 20px", borderRadius: "25px",
              fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.2)", fontSize: "1rem",
            }}
          >
            ↑ {pendingPosts.length} Trino{pendingPosts.length > 1 ? "s" : ""} nuevo{pendingPosts.length > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* --- HEADER --- */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem",
          backgroundColor: "white", padding: "1rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h2 onClick={clickLogoGeneral} style={{ margin: 0, color: "#1d9bf0", cursor: "pointer" }}>
          Canary 🐦
        </h2>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div onClick={() => verPerfilUsuario(currentUser)} style={{ display: "flex", alignItems: "center", cursor: "pointer", marginRight: "1rem" }}>
            {myProfileData.profilePicture ? (
              <img src={myProfileData.profilePicture} alt="Yo" style={{ width: "35px", height: "35px", borderRadius: "50%", marginRight: "8px", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "35px", height: "35px", borderRadius: "50%", marginRight: "8px", backgroundColor: "#e1e8ed", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "18px" }}>👤</div>
            )}
            <span style={{ fontWeight: "bold" }}>@{currentUser}</span>
          </div>
          <button onClick={handleLogout} style={{ padding: "0.5rem 1rem", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "20px", cursor: "pointer" }}>
            Salir
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem", position: "relative" }}>
        <input
          type="text" placeholder="🔍 Buscar usuarios..." value={searchQuery} onChange={handleSearch}
          style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "20px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "1rem" }}
        />
        {searchResults.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", zIndex: 100, marginTop: "5px" }}>
            {searchResults.map((user) => (
              <div key={user._id} onClick={() => verPerfilUsuario(user.username)} style={{ padding: "0.8rem 1rem", cursor: "pointer", fontWeight: "bold", color: "#1d9bf0", borderBottom: "1px solid #f0f2f5" }}>
                @{user.username}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- SECCIÓN DE PERFIL --- */}
      {selectedProfile ? (
        <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", textAlign: "center", position: "relative" }}>
          
          {selectedProfile.username === currentUser && !isEditingProfile && (
            <button
              onClick={() => { setEditBio(selectedProfile.bio); setIsEditingProfile(true); }}
              style={{ position: "absolute", top: "15px", right: "15px", background: "none", border: "1px solid #ccc", borderRadius: "20px", padding: "5px 15px", cursor: "pointer", fontWeight: "bold" }}
            >
              ✏️ Editar
            </button>
          )}

          {selectedProfile.username !== currentUser && (
            <button
              onClick={handleFollow}
              style={{
                position: "absolute", top: "15px", right: "15px", border: "none", borderRadius: "20px", padding: "6px 18px", cursor: "pointer", fontWeight: "bold", color: "white",
                backgroundColor: selectedProfile.followers.includes(currentUser) ? "#dc3545" : "#1d9bf0", 
              }}
            >
              {selectedProfile.followers.includes(currentUser) ? "Dejar de seguir" : "Seguir"}
            </button>
          )}

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <h3>Editar mi perfil</h3>
              <label style={{ width: "100%", textAlign: "left", fontWeight: "bold", fontSize: "0.9rem" }}>Nueva foto de perfil:</label>
              <input type="file" accept="image/*" onChange={(e) => setEditAvatar(e.target.files[0])} style={{ width: "100%", marginBottom: "10px" }} />
              <label style={{ width: "100%", textAlign: "left", fontWeight: "bold", fontSize: "0.9rem" }}>Biografía:</label>
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={160} style={{ width: "100%", height: "60px", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", resize: "none" }} />
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setIsEditingProfile(false)} style={{ padding: "8px 20px", borderRadius: "20px", border: "1px solid #ccc", cursor: "pointer", background: "white" }}>Cancelar</button>
                <button type="submit" disabled={isSavingProfile} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", cursor: "pointer", background: "#1d9bf0", color: "white", fontWeight: "bold" }}>
                  {isSavingProfile ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          ) : (
            <>
              {selectedProfile.profilePicture ? (
                <img src={selectedProfile.profilePicture} alt="Avatar" style={{ width: "100px", height: "100px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px auto", border: "3px solid #1d9bf0" }} />
              ) : (
                <div style={{ width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "#e1e8ed", margin: "0 auto 10px auto", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "40px" }}>👤</div>
              )}

              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem" }}>
                {selectedProfile.username === currentUser ? "Mi Espacio Personal" : `@${selectedProfile.username}`}
              </h3>

              <p style={{ color: "#333", fontSize: "1rem", fontStyle: "italic", marginBottom: "0.5rem", padding: "0 20px" }}>
                "{selectedProfile.bio}"
              </p>

              {/* --- ACTUALIZADO: Los números ahora son botones clickeables que abren el Modal --- */}
              <p style={{ color: "#666", fontSize: "0.95rem", margin: "0 0 1rem 0" }}>
                🤝 <span onClick={() => openNetworkModal("Siguiendo", selectedProfile.following)} style={{ color: "#1d9bf0", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>{selectedProfile.following.length}</span> Siguiendo  |  
                👥 <span onClick={() => openNetworkModal("Seguidores", selectedProfile.followers)} style={{ color: "#1d9bf0", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>{selectedProfile.followers.length}</span> Followers  |  
                ❤️ <span style={{ color: "#e0245e", fontWeight: "bold" }}>{profileLikes}</span> Likes
              </p>

              <button onClick={clickLogoGeneral} style={{ padding: "0.5rem 1.5rem", backgroundColor: "#1d9bf0", color: "white", border: "none", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>
                ⬅ Volver al Muro
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "8px", marginBottom: "2rem", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              {myProfileData.profilePicture ? (
                <img src={myProfileData.profilePicture} alt="Yo" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "45px", height: "45px", borderRadius: "50%", backgroundColor: "#e1e8ed", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "20px" }}>👤</div>
              )}
              <textarea placeholder="¿Qué vas a cantar hoy?..." value={newContent} onChange={(e) => setNewContent(e.target.value)} maxLength={280} style={{ width: "100%", height: "80px", padding: "0.8rem", borderRadius: "8px", border: "none", backgroundColor: "#f0f2f5", resize: "none", boxSizing: "border-box", fontSize: "1.1rem" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <input type="file" id="imageInput" accept="image/*" onChange={(e) => setSelectedImage(e.target.files[0])} style={{ fontSize: "0.9rem" }} />
              <button type="submit" disabled={isPublishing} style={{ padding: "0.6rem 1.5rem", backgroundColor: isPublishing ? "#88c9f9" : "#1d9bf0", color: "white", border: "none", borderRadius: "20px", cursor: isPublishing ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                {isPublishing ? "Trinando..." : "Trinar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!selectedProfile && (
        <div style={{ display: "flex", borderBottom: "1px solid #e1e8ed", marginBottom: "1rem", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <button 
            onClick={() => setFeedType("global")}
            style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: feedType === "global" ? "4px solid #1d9bf0" : "none", fontWeight: "bold", color: feedType === "global" ? "#1d9bf0" : "#666", cursor: "pointer", transition: "all 0.2s" }}
          >
            Global 🌍
          </button>
          <button 
            onClick={() => setFeedType("following")}
            style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: feedType === "following" ? "4px solid #1d9bf0" : "none", fontWeight: "bold", color: feedType === "following" ? "#1d9bf0" : "#666", cursor: "pointer", transition: "all 0.2s" }}
          >
            Siguiendo 👥
          </button>
        </div>
      )}

      <div>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', backgroundColor: 'white', borderRadius: '8px' }}>
            {feedType === "following" ? "🐦 Aún no sigues a nadie, ¡busca usuarios en la barra o explora el Feed Global!" : "No hay publicaciones disponibles."}
          </div>
        ) : (
          posts.map((post) => {
            const safeLikes = Array.isArray(post.likes) ? post.likes : [];
            return (
              <div key={post._id} style={{ backgroundColor: "white", padding: "1rem", borderRadius: "8px", marginBottom: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div onClick={() => verPerfilUsuario(post.author)} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    {post.authorAvatar ? (
                      <img src={post.authorAvatar} alt="Avatar" style={{ width: "35px", height: "35px", borderRadius: "50%", marginRight: "10px", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "35px", height: "35px", borderRadius: "50%", backgroundColor: "#e1e8ed", marginRight: "10px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "18px" }}>👤</div>
                    )}
                    <h4 style={{ margin: 0, color: "#1d9bf0" }}>@{post.author}</h4>
                  </div>
                  {selectedProfile?.username === currentUser && post.author === currentUser && (
                    <button onClick={() => handleDeletePost(post._id)} style={{ background: "#f8d7da", border: "none", padding: "5px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "1.1rem" }} title="Eliminar trino">🗑️</button>
                  )}
                </div>
                <p style={{ margin: 0, color: "#333", fontSize: "1.1rem", paddingLeft: "45px" }}>{post.content}</p>
                {post.image && (
                  <img src={post.image} alt="Imagen del trino" onClick={() => setViewerImage(post.image)} style={{ width: "calc(100% - 45px)", marginLeft: "45px", borderRadius: "12px", marginTop: "10px", maxHeight: "400px", objectFit: "cover", cursor: "pointer" }} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingLeft: "45px" }}>
                  <small style={{ color: "#aaa" }}>{new Date(post.createdAt).toLocaleString()}</small>
                  <button onClick={() => handleLike(post._id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e0245e", fontWeight: "bold", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "5px" }}>
                    {safeLikes.includes(currentUser) ? "❤️" : "🤍"} {safeLikes.length}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {loadingMore && (
        <div style={{ textAlign: "center", padding: "10px", fontWeight: "bold", color: "#1d9bf0" }}>
          🔄 Cargando más trinos cantarines...
        </div>
      )}

      {viewerImage && (
        <div onClick={() => setViewerImage(null)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, cursor: "zoom-out" }}>
          <button onClick={() => setViewerImage(null)} style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", padding: "10px 15px", borderRadius: "20px", fontSize: "1.2rem", cursor: "pointer" }}>Cerrar ✕</button>
          <img src={viewerImage} alt="Visor" style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", borderRadius: "8px", boxShadow: "0 0 20px rgba(0,0,0,0.5)" }} />
        </div>
      )}

      {/* --- NUEVO: MODAL PARA VER SEGUIDORES Y SIGUIENDO --- */}
      {networkModal.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "white", width: "90%", maxWidth: "400px", borderRadius: "12px", padding: "1.5rem", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, color: "#333" }}>{networkModal.title} ({networkModal.users.length})</h3>
              <button onClick={() => setNetworkModal({ isOpen: false, title: "", users: [] })} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            
            {networkModal.users.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888", fontStyle: "italic" }}>No hay usuarios en esta lista aún.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {networkModal.users.map((username) => (
                  <div key={username} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
                    <span 
                      style={{ fontWeight: "bold", color: "#1d9bf0", cursor: "pointer" }}
                      onClick={() => {
                        setNetworkModal({ isOpen: false, title: "", users: [] });
                        verPerfilUsuario(username);
                      }}
                    >
                      @{username}
                    </span>
                    
                    {/* Botón rápido para dejar de seguir (Solo si es mi propia lista de "Siguiendo") */}
                    {networkModal.title === "Siguiendo" && selectedProfile?.username === currentUser && (
                      <button 
                        onClick={() => handleUnfollowFromList(username)}
                        style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "5px 10px", borderRadius: "15px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}
                      >
                        Dejar de seguir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Feed;