import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://10.53.255.90:5000");

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

  const [networkModal, setNetworkModal] = useState({ isOpen: false, title: "", users: [] });

  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username");

  const cargarFeed = async (type = feedType, nextPage = 1, isLoadMore = false) => {
    if (isLoadMore && (loadingMore || !hasMore)) return;
    if (isLoadMore) setLoadingMore(true);

    try {
      const token = localStorage.getItem("token");
      const baseUrl = type === "global" 
        ? "http://10.53.255.90:5000/api/posts" 
        : "http://10.53.255.90:5000/api/posts/feed/following";

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
        `http://10.53.255.90:5000/api/users/profile/${currentUser}`
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
        `http://10.53.255.90:5000/api/users/search?username=${texto}`
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
        `http://10.53.255.90:5000/api/users/profile/${username}`
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
      await fetch("http://10.53.255.90:5000/api/posts", {
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
        `http://10.53.255.90:5000/api/users/profile/edit`,
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
        `http://10.53.255.90:5000/api/users/profile/${selectedProfile.username}/follow`,
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

  const handleUnfollowFromList = async (userToUnfollow) => {
    const confirmar = window.confirm(`¿Dejar de seguir a @${userToUnfollow}?`);
    if (!confirmar) return;

    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `http://10.53.255.90:5000/api/users/profile/${userToUnfollow}/follow`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        setNetworkModal(prev => ({
          ...prev,
          users: prev.users.filter(u => u !== userToUnfollow)
        }));
        verPerfilUsuario(selectedProfile.username);
      }
    } catch (error) {
      console.error("Error al dejar de seguir:", error);
    }
  };

  const handleLike = async (postId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`http://10.53.255.90:5000/api/posts/${postId}/like`, {
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
      await fetch(`http://10.53.255.90:5000/api/posts/${postId}`, {
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

  const openNetworkModal = (title, usersList) => {
    setNetworkModal({ isOpen: true, title, users: usersList });
  };

  const colors = {
    bgAbsolute: "#000000",
    bgCard: "#0d0d13",
    textMain: "#ffffff",
    textMuted: "#8e8e9f"
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: colors.bgAbsolute, minHeight: "100vh", padding: "1.5rem 1rem", color: colors.textMain, boxSizing: "border-box" }}>
      
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: #000000 !important;
          width: 100%;
          height: 100%;
        }
        @keyframes ledEffect {
          0% { border-color: #00f7ff; box-shadow: 0 0 10px rgba(0, 247, 255, 0.3); }
          25% { border-color: #ff00e0; box-shadow: 0 0 10px rgba(255, 0, 224, 0.3); }
          50% { border-color: #ffea00; box-shadow: 0 0 10px rgba(255, 234, 0, 0.3); }
          75% { border-color: #00ff66; box-shadow: 0 0 10px rgba(0, 255, 102, 0.3); }
          100% { border-color: #00f7ff; box-shadow: 0 0 10px rgba(0, 247, 255, 0.3); }
        }
        .led-border {
          border: 2px solid #00f7ff;
          animation: ledEffect 8s linear infinite;
        }
        .led-border-fast {
          border: 2px solid #00f7ff;
          animation: ledEffect 4s linear infinite;
        }
      `}</style>

      <div style={{ maxWidth: "680px", margin: "0 auto", position: "relative" }}>
        
        {pendingPosts.length > 0 && !selectedProfile && (
          <div style={{ position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
            <button
              onClick={mostrarNuevosPosts}
              style={{
                backgroundColor: "#ff00e0", color: "white", border: "none", padding: "12px 28px", borderRadius: "9999px",
                fontWeight: "800", cursor: "pointer", boxShadow: "0 0 15px rgba(255, 0, 224, 0.6)", fontSize: "1rem", textTransform: "uppercase"
              }}
            >
              ↑ {pendingPosts.length} Trino{pendingPosts.length > 1 ? "s" : ""} nuevo{pendingPosts.length > 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Header */}
        <div className="led-border" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", backgroundColor: colors.bgCard, padding: "1.25rem 2rem", borderRadius: "20px" }}>
          <h2 onClick={clickLogoGeneral} style={{ margin: 0, color: "#00f7ff", cursor: "pointer", fontWeight: "900", fontSize: "1.75rem", display: "flex", alignItems: "center", gap: "10px" }}>
            Canary <span style={{ fontSize: "1.4rem" }}>🐦</span>
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div onClick={() => verPerfilUsuario(currentUser)} style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "6px 16px", borderRadius: "9999px", backgroundColor: "#000000", border: "1px solid rgba(255,255,255,0.1)" }}>
              {myProfileData.profilePicture ? (
                <img src={myProfileData.profilePicture} alt="Yo" style={{ width: "36px", height: "36px", borderRadius: "50%", marginRight: "10px", objectFit: "cover", border: "2px solid #ff00e0" }} />
              ) : (
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", marginRight: "10px", backgroundColor: "#000000", display: "flex", justifyContent: "center", alignItems: "center" }}>👤</div>
              )}
              <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>@{currentUser}</span>
            </div>
            <button onClick={handleLogout} style={{ padding: "0.6rem 1.4rem", backgroundColor: "transparent", color: "#ff4d4d", border: "2px solid #ff4d4d", borderRadius: "9999px", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem" }}>
              Salir
            </button>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div style={{ marginBottom: "2rem", position: "relative" }}>
          <input
            type="text" placeholder="Buscar usuarios..." value={searchQuery} onChange={handleSearch}
            className="led-border"
            style={{ width: "100%", padding: "1rem 1.5rem", borderRadius: "15px", boxSizing: "border-box", fontSize: "1rem", backgroundColor: colors.bgCard, outline: "none", color: colors.textMain }}
          />
          {searchResults.length > 0 && (
            <div className="led-border" style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: colors.bgCard, borderRadius: "15px", zIndex: 100, marginTop: "8px", overflow: "hidden" }}>
              {searchResults.map((user) => (
                <div key={user._id} onClick={() => verPerfilUsuario(user.username)} style={{ padding: "1rem 1.5rem", cursor: "pointer", fontWeight: "700", color: "#ff00e0", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  @{user.username}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vista de Perfil */}
        {selectedProfile ? (
          <div className="led-border" style={{ padding: "2.5rem", borderRadius: "24px", marginBottom: "2.5rem", textAlign: "center", position: "relative", backgroundColor: colors.bgCard }}>
            {selectedProfile.username === currentUser && !isEditingProfile && (
              <button
                onClick={() => { setEditBio(selectedProfile.bio); setIsEditingProfile(true); }}
                style={{ position: "absolute", top: "24px", right: "24px", backgroundColor: "transparent", border: "2px solid #8e8e9f", borderRadius: "9999px", padding: "8px 18px", cursor: "pointer", fontWeight: "700", color: "#8e8e9f" }}
              >
                Editar Perfil
              </button>
            )}

            {selectedProfile.username !== currentUser && (
              <button
                onClick={handleFollow}
                style={{
                  position: "absolute", top: "24px", right: "24px", border: "none", borderRadius: "9999px", padding: "10px 24px", cursor: "pointer", fontWeight: "800", color: "white",
                  backgroundColor: selectedProfile.followers.includes(currentUser) ? "#ff4d4d" : "#00f7ff"
                }}
              >
                {selectedProfile.followers.includes(currentUser) ? "Dejar de seguir" : "Seguir"}
              </button>
            )}

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", width: "100%", boxSizing: "border-box" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.4rem", fontWeight: "900", color: "#00f7ff" }}>Editar Perfil</h3>
                <input type="file" accept="image/*" onChange={(e) => setEditAvatar(e.target.files[0])} style={{ width: "100%", color: colors.textMuted }} />
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={160} className="led-border" style={{ width: "100%", height: "90px", padding: "14px", borderRadius: "10px", resize: "none", outline: "none", fontSize: "1rem", boxSizing: "border-box", backgroundColor: "#000000", color: colors.textMain }} />
                <div style={{ display: "flex", gap: "16px", width: "100%", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setIsEditingProfile(false)} style={{ padding: "10px 24px", borderRadius: "9999px", background: "#000000", border: "2px solid #ff4d4d", color: "#ff4d4d", fontWeight: "700", cursor: "pointer" }}>Cancelar</button>
                  <button type="submit" className="led-border-fast" disabled={isSavingProfile} style={{ padding: "10px 24px", borderRadius: "9999px", background: "#000000", color: "#ffffff", fontWeight: "800", cursor: "pointer" }}>
                    {isSavingProfile ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {selectedProfile.profilePicture ? (
                  <img src={selectedProfile.profilePicture} alt="Avatar" style={{ width: "110px", height: "110px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 16px auto", border: "3px solid #00f7ff" }} />
                ) : (
                  <div style={{ width: "110px", height: "110px", borderRadius: "50%", backgroundColor: "#000000", border: "1px solid rgba(255,255,255,0.1)", margin: "0 auto 16px auto", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "40px" }}>👤</div>
                )}
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.7rem", fontWeight: "900", color: "#ff00e0" }}>
                  {selectedProfile.username === currentUser ? "Mi Perfil" : `@${selectedProfile.username}`}
                </h3>
                <p style={{ color: colors.textMuted, fontSize: "1rem", margin: "0 0 1.5rem 0" }}>
                  {selectedProfile.bio ? `"${selectedProfile.bio}"` : "Sin biografía aún."}
                </p>

                <div style={{ display: "flex", justifyContent: "center", gap: "28px", padding: "16px 0", marginBottom: "1.75rem", backgroundColor: "#000000", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div><span onClick={() => openNetworkModal("Siguiendo", selectedProfile.following)} style={{ color: "white", fontWeight: "800", cursor: "pointer", fontSize: "1.3rem", display: "block" }}>{selectedProfile.following.length}</span> siguiendo</div>
                  <div><span onClick={() => openNetworkModal("Seguidores", selectedProfile.followers)} style={{ color: "white", fontWeight: "800", cursor: "pointer", fontSize: "1.3rem", display: "block" }}>{selectedProfile.followers.length}</span> seguidores</div>
                  <div><span style={{ color: "#ff00e0", fontWeight: "800", fontSize: "1.3rem", display: "block" }}>{profileLikes}</span> likes</div>
                </div>

                <button onClick={clickLogoGeneral} className="led-border-fast" style={{ padding: "0.7rem 1.8rem", backgroundColor: "#000000", color: "#ffffff", borderRadius: "9999px", cursor: "pointer", fontWeight: "800" }}>
                  ← Volver al Muro
                </button>
              </>
            )}
          </div>
        ) : (
          /* Crear Publicación */
          <div className="led-border" style={{ padding: "1.5rem", borderRadius: "20px", marginBottom: "2rem", backgroundColor: colors.bgCard }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                {myProfileData.profilePicture ? (
                  <img src={myProfileData.profilePicture} alt="Yo" style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid #00f7ff" }} />
                ) : (
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#000000", border: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "center", alignItems: "center" }}>👤</div>
                )}
                <textarea placeholder="¿Qué estás pensando?..." value={newContent} onChange={(e) => setNewContent(e.target.value)} maxLength={280} style={{ width: "100%", height: "100px", padding: "0.5rem 0", border: "none", backgroundColor: "transparent", resize: "none", boxSizing: "border-box", fontSize: "1.1rem", outline: "none", color: colors.textMain }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "14px" }}>
                <input type="file" id="imageInput" accept="image/*" onChange={(e) => setSelectedImage(e.target.files[0])} style={{ color: colors.textMuted }} />
                <button type="submit" className="led-border-fast" disabled={isPublishing} style={{ padding: "0.7rem 1.8rem", backgroundColor: isPublishing ? "#000000" : "#000000", color: "#ffffff", borderRadius: "9999px", cursor: "pointer", fontWeight: "800" }}>
                  {isPublishing ? "Enviando..." : "Subir"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros Global / Siguiendo */}
        {!selectedProfile && (
          <div style={{ display: "flex", marginBottom: "1.5rem", backgroundColor: "#000000", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "15px", padding: "6px" }}>
            <button onClick={() => setFeedType("global")} className={feedType === "global" ? "led-border-fast" : ""} style={{ flex: 1, padding: "12px", background: feedType === "global" ? "#0d0d13" : "none", border: "2px solid transparent", borderRadius: "10px", fontWeight: "800", color: "white", cursor: "pointer" }}>
              Global 🌍
            </button>
            <button onClick={() => setFeedType("following")} className={feedType === "following" ? "led-border-fast" : ""} style={{ flex: 1, padding: "12px", background: feedType === "following" ? "#0d0d13" : "none", border: "2px solid transparent", borderRadius: "10px", fontWeight: "800", color: "white", cursor: "pointer" }}>
              Siguiendo 👥
            </button>
          </div>
        )}

        {/* Lista de Publicaciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {posts.length === 0 ? (
            <div className="led-border" style={{ textAlign: 'center', padding: '4rem 2rem', color: colors.textMuted, backgroundColor: colors.bgCard, borderRadius: "16px" }}>
              {feedType === "following" ? "No sigues a nadie o tus amigos no han publicado nada." : "No hay publicaciones en este momento."}
            </div>
          ) : (
            posts.map((post) => {
              const safeLikes = Array.isArray(post.likes) ? post.likes : [];
              return (
                <div key={post._id} className="led-border" style={{ backgroundColor: colors.bgCard, padding: "1.5rem", borderRadius: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div onClick={() => verPerfilUsuario(post.author)} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      {post.authorAvatar ? (
                        <img src={post.authorAvatar} alt="Avatar" style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "12px", objectFit: "cover", border: "2px solid #00f7ff" }} />
                      ) : (
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#000000", border: "1px solid rgba(255,255,255,0.1)", marginRight: "12px", display: "flex", justifyContent: "center", alignItems: "center" }}>👤</div>
                      )}
                      <h4 style={{ margin: 0, color: colors.textMain, fontWeight: "800" }}>@{post.author}</h4>
                    </div>
                    {selectedProfile?.username === currentUser && post.author === currentUser && (
                      <button onClick={() => handleDeletePost(post._id)} style={{ background: "transparent", border: "2px solid #ff4d4d", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", color: "#ff4d4d" }}>🗑️</button>
                    )}
                  </div>
                  
                  <div style={{ paddingLeft: "52px" }}>
                    <p style={{ margin: 0, color: colors.textMain, fontSize: "1.05rem", whiteSpace: "pre-wrap" }}>{post.content}</p>
                    {post.image && (
                      <div className="led-border-fast" style={{ overflow: "hidden", borderRadius: "15px", marginTop: "14px", maxHeight: "400px", backgroundColor: "black" }}>
                        <img src={post.image} alt="Adjunto" onClick={() => setViewerImage(post.image)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in", display: "block" }} />
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem" }}>
                      <span style={{ color: colors.textMuted, fontSize: "0.85rem" }}>{new Date(post.createdAt).toLocaleString()}</span>
                      <button onClick={() => handleLike(post._id)} style={{ background: "none", border: "none", cursor: "pointer", color: safeLikes.includes(currentUser) ? "#ff00e0" : colors.textMuted, fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{safeLikes.includes(currentUser) ? "❤️" : "🤍"}</span> {safeLikes.length}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {loadingMore && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#00f7ff", fontWeight: "700" }}>Cargando más...</div>
        )}

        {/* Lightbox */}
        {viewerImage && (
          <div onClick={() => setViewerImage(null)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.95)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, cursor: "zoom-out" }}>
            <img src={viewerImage} alt="Completa" className="led-border" style={{ maxWidth: "90%", maxHeight: "85vh", objectFit: "contain", borderRadius: "15px" }} />
          </div>
        )}

        {/* Modal Seguidores */}
        {networkModal.isOpen && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
            <div className="led-border" style={{ width: "90%", maxWidth: "450px", borderRadius: "20px", padding: "2rem", maxHeight: "75vh", overflowY: "auto", backgroundColor: colors.bgCard }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "14px", marginBottom: "18px" }}>
                <h3 style={{ margin: 0 }}>{networkModal.title} ({networkModal.users.length})</h3>
                <button onClick={() => setNetworkModal({ isOpen: false, title: "", users: [] })} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "white" }}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {networkModal.users.map((username) => (
                  <div key={username} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#000000", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px" }}>
                    <span style={{ fontWeight: "700", color: "#00f7ff", cursor: "pointer" }} onClick={() => { setNetworkModal({ isOpen: false, title: "", users: [] }); verPerfilUsuario(username); }}>
                      @{username}
                    </span>
                    {networkModal.title === "Siguiendo" && selectedProfile?.username === currentUser && (
                      <button onClick={() => handleUnfollowFromList(username)} style={{ backgroundColor: "transparent", color: "#ff4d4d", border: "2px solid #ff4d4d", padding: "6px 12px", borderRadius: "9999px", cursor: "pointer", fontSize: "0.85rem" }}>
                        Dejar de seguir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Feed;