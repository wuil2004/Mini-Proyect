import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, Image, ActivityIndicator, Modal, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as ImagePicker from 'expo-image-picker';

const SERVER_IP = '10.53.255.90'; 
const socket = io(`http://${SERVER_IP}:5000`);

interface Post {
  _id: string;
  content: string;
  author: string;
  likes: string[];
  image?: string; 
  authorAvatar?: string; 
  createdAt: string;
}

interface UserSearch {
  _id: string;
  username: string;
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);

  const [newContent, setNewContent] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  
  const flatListRef = useRef<FlatList>(null);
  const currentUserRef = useRef<string>(''); 
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearch[]>([]);
  
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileLikes, setProfileLikes] = useState<number>(0);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [myProfileData, setMyProfileData] = useState({ bio: '', profilePicture: null });

  const [feedType, setFeedType] = useState<'global' | 'following'>('global');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [networkModal, setNetworkModal] = useState({ isOpen: false, title: '', users: [] as string[] });

  const router = useRouter();

  // Animación base para el ciclo de colores LED
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 8000, 
        useNativeDriver: false, 
      })
    ).start();
  }, []);

  // Interpolación de colores para emular la regla @keyframes ledEffect del CSS
  const ledBorderColor = animValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['#00f7ff', '#ff00e0', '#ffea00', '#00ff66', '#00f7ff']
  });

  const cargarFeed = async (type: 'global' | 'following' = feedType, nextPage = 1, isLoadMore = false) => {
    if (isLoadMore && (loadingMore || !hasMore)) return;
    if (isLoadMore) setLoadingMore(true);

    try {
      const token = await SecureStore.getItemAsync('token');
      const baseUrl = type === 'global' 
        ? `http://${SERVER_IP}:5000/api/posts`
        : `http://${SERVER_IP}:5000/api/posts/feed/following`;

      const response = await fetch(`${baseUrl}?page=${nextPage}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          Alert.alert("Sesión caducada", "Por favor, vuelve a iniciar sesión.");
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
          setSelectedProfile(null);
          setPendingPosts([]);
        }

        if (data.length < 10) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (error) {
      console.error('Error al cargar posts:', error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
    }
  };

  const loadMyData = async (user: string) => {
    try {
      const response = await fetch(`http://${SERVER_IP}:5000/api/users/profile/${user}`);
      if (response.ok) {
        const data = await response.json();
        setMyProfileData({ bio: data.bio, profilePicture: data.profilePicture });
      }
    } catch (error) {
      console.log('No pude cargar tu foto', error);
    }
  };

  useEffect(() => {
    const inicializarFeed = async () => {
      const token = await SecureStore.getItemAsync('token');
      const user = await SecureStore.getItemAsync('username');
      
      if (!token || !user) {
        router.replace('/');
        return;
      }
      setCurrentUser(user);
      currentUserRef.current = user; 
      
      setPage(1);
      setHasMore(true);
      cargarFeed(feedType, 1, false);
      loadMyData(user);
    };

    inicializarFeed();

    socket.on('new_post', (postGuardado: Post) => {
      if (postGuardado.author === currentUserRef.current) {
        setPosts((postsAnteriores) => [postGuardado, ...postsAnteriores]);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else {
        setPendingPosts((prev) => [postGuardado, ...prev]);
      }
    });

    socket.on('post_liked', (postActualizado: Post) => {
      setPosts((postsAnteriores) =>
        postsAnteriores.map((post) => (post._id === postActualizado._id ? postActualizado : post))
      );
    });

    socket.on('post_deleted', (idEliminado: string) => {
      setPosts((postsAnteriores) => postsAnteriores.filter((post) => post._id !== idEliminado));
      setPendingPosts((prev) => prev.filter((post) => post._id !== idEliminado));
    });

    return () => {
      socket.off('new_post');
      socket.off('post_liked');
      socket.off('post_deleted');
    };
  }, [feedType]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`http://${SERVER_IP}:5000/api/users/search?username=${text}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
    }
  };

  const verPerfilUsuario = async (username: string) => {
    try {
      setSearchQuery('');
      setSearchResults([]);
      const response = await fetch(`http://${SERVER_IP}:5000/api/users/profile/${username}`);
      
      if (!response.ok) return;

      const data = await response.json();
      
      setSelectedProfile({
        username: data.username,
        bio: data.bio,
        profilePicture: data.profilePicture,
        followers: data.followers || [],
        following: data.following || []
      });
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setProfileLikes(data.totalLikes);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.8, 
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const pickAvatarImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, 
    });
    if (!result.canceled) setEditAvatar(result.assets[0].uri);
  };

  const handlePublish = async () => {
    if (!newContent.trim() || isPublishing) return;
    setIsPublishing(true); 
    const token = await SecureStore.getItemAsync('token');
    
    const formData = new FormData();
    formData.append('content', newContent);

    if (selectedImage) {
      const filename = selectedImage.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      formData.append('image', { uri: selectedImage, name: filename, type } as any); 
    }

    try {
      await fetch(`http://${SERVER_IP}:5000/api/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      setNewContent('');
      setSelectedImage(null); 
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la publicación');
    } finally {
      setIsPublishing(false); 
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const token = await SecureStore.getItemAsync('token');
    
    const formData = new FormData();
    formData.append('bio', editBio);

    if (editAvatar) {
      const filename = editAvatar.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      formData.append('image', { uri: editAvatar, name: filename, type } as any);
    }

    try {
      const response = await fetch(`http://${SERVER_IP}:5000/api/users/profile/edit`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setMyProfileData(data.user);
        setIsEditingProfile(false);
        verPerfilUsuario(currentUser); 
      }
    } catch (error) {
      Alert.alert("Error", "Fallo de conexión al guardar");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFollow = async () => {
    const token = await SecureStore.getItemAsync('token');
    try {
      const response = await fetch(`http://${SERVER_IP}:5000/api/users/profile/${selectedProfile.username}/follow`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        verPerfilUsuario(selectedProfile.username); 
      }
    } catch (error) {
      console.error('Error al procesar el follow:', error);
    }
  };

  const handleUnfollowFromList = (userToUnfollow: string) => {
    Alert.alert(
      "Dejar de seguir",
      `¿Seguro que quieres dejar de seguir a @${userToUnfollow}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar", style: "destructive",
          onPress: async () => {
            const token = await SecureStore.getItemAsync('token');
            try {
              const response = await fetch(`http://${SERVER_IP}:5000/api/users/profile/${userToUnfollow}/follow`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                setNetworkModal(prev => ({
                  ...prev,
                  users: prev.users.filter(u => u !== userToUnfollow)
                }));
                verPerfilUsuario(selectedProfile.username);
              }
            } catch (e) {                          
              console.log(e);
            }
          }
        }
      ]
    );
  };

  const handleLike = async (postId: string) => {
    const token = await SecureStore.getItemAsync('token');
    try {
      await fetch(`http://${SERVER_IP}:5000/api/posts/${postId}/like`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error al procesar el like:', error);
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert(
      "¿Eliminar trino?", "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            const token = await SecureStore.getItemAsync('token');
            try {
              await fetch(`http://${SERVER_IP}:5000/api/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
            } catch (error) {
              Alert.alert("Error", "Fallo de red al eliminar");
            }
          }
        }
      ]
    );
  };

  const mostrarNuevosPosts = () => {
    setPosts((prev) => [...pendingPosts, ...prev]); 
    setPendingPosts([]); 
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); 
  };

  const clickLogoGeneral = () => {
    setFeedType('global');
    setPage(1);
    setHasMore(true);
    cargarFeed('global', 1, false);
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('username');
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {pendingPosts.length > 0 && !selectedProfile && (
        <TouchableOpacity style={styles.floatingButton} onPress={mostrarNuevosPosts}>
          <Text style={styles.floatingButtonText}>
            ↑ {pendingPosts.length} Trino{pendingPosts.length > 1 ? "s" : ""} nuevo{pendingPosts.length > 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <Animated.View style={[styles.header, { borderColor: ledBorderColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {selectedProfile && (
            <TouchableOpacity onPress={clickLogoGeneral} style={styles.backHeaderButton}>
              <Text style={styles.backHeaderButtonText}>← Volver</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={clickLogoGeneral}>
            <Text style={styles.headerTitle}>Canary <Text style={{fontSize: 18}}>🐦</Text></Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => verPerfilUsuario(currentUser)} style={styles.headerUserPill}>
            {myProfileData.profilePicture ? (
              <Image source={{ uri: myProfileData.profilePicture }} style={styles.miniAvatar} />
            ) : (
              <View style={[styles.miniAvatar, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#ffffff', fontSize: 12 }}>👤</Text>
              </View>
            )}
            <Text style={styles.username}>@{currentUser}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <Animated.View style={{ borderColor: ledBorderColor, borderWidth: 2, borderRadius: 15 }}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Buscar usuarios..." 
            placeholderTextColor="#8e8e9f" 
            value={searchQuery} 
            onChangeText={handleSearch} 
          />
        </Animated.View>
      </View>

      {searchResults.length > 0 && (
        <Animated.View style={[styles.searchResultsBox, { borderColor: ledBorderColor }]}>
          {searchResults.map((item) => (
            <TouchableOpacity key={item._id} style={styles.searchResultItem} onPress={() => verPerfilUsuario(item.username)}>
              <Text style={styles.searchResultText}>@{item.username}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* CAJA DE PUBLICACIÓN TOTALMENTE INDEPENDIENTE FUERA DE LA LISTA (SOLUCIONA EL COLOQUEO DEL TECLADO) */}
      {!selectedProfile && (
        <View style={{ paddingHorizontal: 10 }}>
          <Animated.View style={[styles.publishBox, { borderColor: ledBorderColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
              {myProfileData.profilePicture ? (
                <Image source={{ uri: myProfileData.profilePicture }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#00f7ff', objectFit: 'cover' }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, color: 'white' }}>👤</Text>
                </View>
              )}
              <TextInput 
                style={styles.input} 
                placeholder="¿Qué estás pensando?..." 
                placeholderTextColor="#8e8e9f" 
                value={newContent} 
                onChangeText={setNewContent} 
                maxLength={280} 
                multiline 
              />
            </View>
            {selectedImage && (
              <View style={{ position: 'relative', marginTop: 10, marginLeft: 64 }}>
                <Image source={{ uri: selectedImage }} style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderColor: '#ff00e0' }} />
                <TouchableOpacity style={{ position: 'absolute', top: -5, left: 65, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 15, padding: 4 }} onPress={() => setSelectedImage(null)}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={pickImage} style={styles.cameraButton}>
                <Text style={{ fontSize: 14, color: '#8e8e9f', fontWeight: '700' }}>Adjuntar archivo</Text>
              </TouchableOpacity>
              <Animated.View style={{ borderRadius: 25, borderWidth: 2, borderColor: ledBorderColor }}>
                <TouchableOpacity style={styles.publishButton} onPress={handlePublish} disabled={isPublishing}>
                  {isPublishing ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.publishButtonText}>Trinar</Text>}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Muro / Lista Principal */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 30, paddingHorizontal: 10 }}
        onEndReached={() => {
          if (!selectedProfile && hasMore && !loadingMore) {
            setPage(prev => {
              const next = prev + 1;
              cargarFeed(feedType, next, true);
              return next;
            });
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={() => (
          <View>
            {/* --- SECCIÓN DE PERFIL --- */}
            {selectedProfile && (
              <Animated.View style={[styles.profileHeaderBox, { borderColor: ledBorderColor }]}>
                {selectedProfile.username === currentUser && !isEditingProfile && (
                  <TouchableOpacity onPress={() => { setEditBio(selectedProfile.bio); setEditAvatar(selectedProfile.profilePicture); setIsEditingProfile(true); }} style={styles.editProfileButton}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: '#8e8e9f' }}>Editar Perfil</Text>
                  </TouchableOpacity>
                )}

                {selectedProfile.username !== currentUser && (
                  <TouchableOpacity onPress={handleFollow} style={[styles.followButton, { backgroundColor: selectedProfile.followers.includes(currentUser) ? '#ff4d4d' : '#00f7ff' }]}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
                      {selectedProfile.followers.includes(currentUser) ? "Dejar de seguir" : "Seguir"}
                    </Text>
                  </TouchableOpacity>
                )}

                {isEditingProfile ? (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', marginBottom: 15, color: '#00f7ff' }}>Editar Perfil</Text>
                    <TouchableOpacity onPress={pickAvatarImage} style={{ marginBottom: 15, alignItems: 'center' }}>
                      {editAvatar ? <Image source={{ uri: editAvatar }} style={styles.bigAvatar} /> : <View style={[styles.bigAvatar, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}><Text style={{ color: '#fff', fontSize: 14 }}>Foto</Text></View>}
                      <Text style={{ color: '#ff00e0', marginTop: 5, fontWeight: 'bold' }}>Cambiar foto</Text>
                    </TouchableOpacity>
                    
                    <Animated.View style={{ width: '100%', borderColor: ledBorderColor, borderWidth: 2, borderRadius: 10 }}>
                      <TextInput style={styles.bioInput} placeholder="Escribe algo sobre ti..." placeholderTextColor="#8e8e9f" value={editBio} onChangeText={setEditBio} multiline maxLength={160} />
                    </Animated.View>

                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 15, justifyContent: 'flex-end', width: '100%' }}>
                      <TouchableOpacity onPress={() => setIsEditingProfile(false)} style={[styles.profileActionBtn, { backgroundColor: '#000000', borderWidth: 2, borderColor: '#ff4d4d' }]}><Text style={{ fontWeight: '700', color: '#ff4d4d' }}>Cancelar</Text></TouchableOpacity>
                      <Animated.View style={{ borderRadius: 20, borderWidth: 2, borderColor: ledBorderColor }}>
                        <TouchableOpacity onPress={handleSaveProfile} disabled={isSavingProfile} style={[styles.profileActionBtn, { backgroundColor: '#000000' }]}>
                          {isSavingProfile ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: '800' }}>Guardar</Text>}
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </View>
                ) : (
                  <>
                    {selectedProfile.profilePicture ? <Image source={{ uri: selectedProfile.profilePicture }} style={styles.bigAvatar} /> : <View style={[styles.bigAvatar, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}><Text style={{ fontSize: 40, color: 'white' }}>👤</Text></View>}
                    <Text style={styles.profileName}>{selectedProfile.username === currentUser ? "Mi Perfil" : `@${selectedProfile.username}`}</Text>
                    <Text style={styles.profileBio}>{selectedProfile.bio ? `"${selectedProfile.bio}"` : "Sin biografía aún."}</Text>
                    
                    <View style={styles.statsContainer}>
                      <TouchableOpacity style={{alignItems: 'center'}} onPress={() => setNetworkModal({ isOpen: true, title: 'Siguiendo', users: selectedProfile.following })}>
                        <Text style={styles.statNumber}>{selectedProfile.following.length}</Text>
                        <Text style={styles.statText}>siguiendo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{alignItems: 'center'}} onPress={() => setNetworkModal({ isOpen: true, title: 'Seguidores', users: selectedProfile.followers })}>
                        <Text style={styles.statNumber}>{selectedProfile.followers.length}</Text>
                        <Text style={styles.statText}>seguidores</Text>
                      </TouchableOpacity>
                      <View style={{alignItems: 'center'}}>
                        <Text style={[styles.statNumber, {color: '#ff00e0'}]}>{profileLikes}</Text>
                        <Text style={styles.statText}>likes</Text>
                      </View>
                    </View>
                    
                    <Animated.View style={{ borderRadius: 25, borderWidth: 2, borderColor: ledBorderColor, marginTop: 10 }}>
                      <TouchableOpacity style={styles.backButton} onPress={clickLogoGeneral}>
                        <Text style={styles.backButtonText}>← Volver al Muro</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </>
                )}
              </Animated.View>
            )}

            {/* Filtros Global / Siguiendo */}
            {!selectedProfile && (
              <View style={styles.tabsContainer}>
                <Animated.View style={[styles.tabButtonWrapper, feedType === 'global' && { borderColor: ledBorderColor, borderWidth: 2, borderRadius: 10 }]}>
                  <TouchableOpacity style={[styles.tabButton, feedType === 'global' && styles.activeTabButton]} onPress={() => setFeedType('global')}>
                    <Text style={styles.tabText}>Global 🌍</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={[styles.tabButtonWrapper, feedType === 'following' && { borderColor: ledBorderColor, borderWidth: 2, borderRadius: 10 }]}>
                  <TouchableOpacity style={[styles.tabButton, feedType === 'following' && styles.activeTabButton]} onPress={() => setFeedType('following')}>
                    <Text style={styles.tabText}>Siguiendo 👥</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </View>
        )}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#00f7ff" style={{ margin: 20 }} /> : null}
        ListEmptyComponent={() => (
          <Animated.View style={[styles.emptyComponentContainer, { borderColor: ledBorderColor }]}>
            <Text style={{ color: '#8e8e9f', textAlign: 'center', fontSize: 15 }}>
              {feedType === 'following' ? "No sigues a nadie o tus amigos no han publicado nada." : "No hay publicaciones en este momento."}
            </Text>
          </Animated.View>
        )}
        renderItem={({ item }) => {
          const safeLikes = Array.isArray(item.likes) ? item.likes : [];
          return (
            <Animated.View style={[styles.postCard, { borderColor: ledBorderColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity onPress={() => verPerfilUsuario(item.author)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.authorAvatar ? <Image source={{ uri: item.authorAvatar }} style={styles.postAvatar} /> : <View style={[styles.postAvatar, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}><Text style={{ fontSize: 16, color: 'white' }}>👤</Text></View>}
                  <Text style={styles.postAuthor}>@{item.author}</Text>
                </TouchableOpacity>
                {selectedProfile?.username === currentUser && item.author === currentUser && (
                  <TouchableOpacity onPress={() => handleDeletePost(item._id)} style={styles.deleteButton}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ paddingLeft: 52 }}>
                <Text style={styles.postContent}>{item.content}</Text>
                {item.image && (
                  <Animated.View style={[styles.postImageContainer, { borderColor: ledBorderColor }]}>
                    <TouchableOpacity onPress={() => setViewerImage(item.image || null)}>
                      <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
                    </TouchableOpacity>
                  </Animated.View>
                )}
                <View style={styles.postFooter}>
                  <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleString()}</Text>
                  <TouchableOpacity onPress={() => handleLike(item._id)} style={styles.likeButton}>
                    <Text style={{ fontSize: 15, color: safeLikes.includes(currentUser) ? '#ff00e0' : '#8e8e9f' }}>
                      {safeLikes.includes(currentUser) ? '❤️' : '🤍'}
                    </Text>
                    <Text style={[styles.likeText, { color: safeLikes.includes(currentUser) ? '#ff00e0' : '#8e8e9f' }]}>
                      {safeLikes.length}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        }}
      />

      {/* Visor de imágenes Lightbox */}
      <Modal visible={!!viewerImage} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.closeModalButton} onPress={() => setViewerImage(null)}><Text style={styles.closeModalText}>✕</Text></TouchableOpacity>
          {viewerImage && (
            <Animated.Image source={{ uri: viewerImage }} style={[styles.fullScreenImage, { borderColor: ledBorderColor, borderWidth: 2, borderRadius: 15 }]} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Modal Seguidores / Siguiendo */}
      <Modal visible={networkModal.isOpen} transparent={true} animationType="slide">
        <View style={styles.modalBackground}>
          <Animated.View style={[styles.modalContentBox, { borderColor: ledBorderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{networkModal.title} ({networkModal.users.length})</Text>
              <TouchableOpacity onPress={() => setNetworkModal({ isOpen: false, title: '', users: [] })}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {networkModal.users.length === 0 ? (
                <Text style={styles.emptyModalText}>No hay usuarios en esta lista aún.</Text>
              ) : (
                networkModal.users.map((username) => (
                  <View key={username} style={styles.modalUserRow}>
                    <TouchableOpacity 
                      onPress={() => {
                        setNetworkModal({ isOpen: false, title: '', users: [] });
                        verPerfilUsuario(username);
                      }}
                    >
                      <Text style={styles.modalUserText}>@{username}</Text>
                    </TouchableOpacity>

                    {networkModal.title === 'Siguiendo' && selectedProfile?.username === currentUser && (
                      <TouchableOpacity 
                        style={styles.unfollowListBtn}
                        onPress={() => handleUnfollowFromList(username)}
                      >
                        <Text style={styles.unfollowListText}>Dejar de seguir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  floatingButton: { position: 'absolute', top: 90, alignSelf: 'center', backgroundColor: '#ff00e0', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 25, zIndex: 100, elevation: 5 },
  floatingButtonText: { color: 'white', fontWeight: '800', fontSize: 15, textTransform: 'uppercase' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d0d13', paddingVertical: 15, paddingHorizontal: 20, borderWidth: 2, borderRadius: 20, marginHorizontal: 10, marginTop: 10, marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#00f7ff', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backHeaderButton: { backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderColor: '#ff00e0' },
  backHeaderButtonText: { color: '#ff00e0', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00f7ff' },
  username: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  logoutButton: { backgroundColor: '#ff4d4d', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  logoutText: { color: 'white', fontWeight: '700', fontSize: 13 },
  searchContainer: { marginHorizontal: 10, marginBottom: 15 },
  searchInput: { backgroundColor: '#0d0d13', padding: 12, borderRadius: 15, color: '#ffffff', fontSize: 15 },
  searchResultsBox: { backgroundColor: '#0d0d13', marginHorizontal: 10, padding: 10, borderRadius: 15, borderWidth: 2, gap: 10, marginBottom: 15 },
  searchResultItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#000000' },
  searchResultText: { color: '#00f7ff', fontWeight: '700' },
  publishBox: { backgroundColor: '#0d0d13', padding: 20, borderRadius: 20, borderWidth: 2, marginBottom: 20 },
  input: { flex: 1, color: '#ffffff', fontSize: 16, minHeight: 60, textAlignVertical: 'top', padding: 5 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  cameraButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#1a1a24' },
  publishButton: { backgroundColor: '#000000', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 25 },
  publishButtonText: { color: 'white', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tabButtonWrapper: { flex: 1 },
  tabButton: { backgroundColor: '#0d0d13', paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  activeTabButton: { backgroundColor: '#000000' },
  tabText: { color: 'white', fontWeight: '700', fontSize: 14 },
  emptyComponentContainer: { backgroundColor: '#0d0d13', padding: 30, borderRadius: 20, borderWidth: 2 },
  postCard: { backgroundColor: '#0d0d13', padding: 20, borderRadius: 20, borderWidth: 2, marginBottom: 15 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ff00e0' },
  postAuthor: { color: '#ffffff', fontWeight: '800', fontSize: 16, marginLeft: 12 },
  deleteButton: { padding: 5 },
  postContent: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
  postImageContainer: { marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 2, maxHeight: 220 },
  postImage: { width: '100%', height: 220 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  postDate: { color: '#8e8e9f', fontSize: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#000000', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15 },
  likeText: { fontWeight: '700', fontSize: 13 },
  profileHeaderBox: { backgroundColor: '#0d0d13', padding: 24, borderRadius: 24, borderWidth: 2, alignItems: 'center', marginBottom: 20, position: 'relative' },
  editProfileButton: { position: 'absolute', top: 16, right: 16, backgroundColor: '#1a1a24', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  followButton: { position: 'absolute', top: 16, right: 16, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 12 },
  bigAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#00f7ff', marginBottom: 12, objectFit: 'cover' },
  profileName: { color: '#ffffff', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  profileBio: { color: '#8e8e9f', fontSize: 14, textAlign: 'center', paddingHorizontal: 10, marginBottom: 16 },
  statsContainer: { flexDirection: 'row', gap: 24, justifyContent: 'center', width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16, marginBottom: 12 },
  statNumber: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  statText: { color: '#8e8e9f', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  backButton: { backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 25 },
  backButtonText: { color: '#00f7ff', fontWeight: '800', fontSize: 14 },
  bioInput: { backgroundColor: '#000000', color: '#ffffff', padding: 12, borderRadius: 10, height: 80, textAlignVertical: 'top', width: '100%' },
  profileActionBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  closeModalButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 },
  closeModalText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  fullScreenImage: { width: '100%', height: '80%' },
  modalContentBox: { backgroundColor: '#0d0d13', width: '100%', maxWidth: 400, borderRadius: 24, borderWidth: 3, padding: 20, alignItems: 'center' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 10 },
  modalTitle: { color: '#00f7ff', fontSize: 18, fontWeight: '900' },
  closeX: { color: '#8e8e9f', fontSize: 18, fontWeight: 'bold' },
  emptyModalText: { color: '#8e8e9f', textAlign: 'center', marginVertical: 20 },
  modalUserRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: '#000000', padding: 12, borderRadius: 12, marginBottom: 10 },
  modalUserText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  unfollowListBtn: { backgroundColor: '#ff4d4d', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  unfollowListText: { color: 'white', fontSize: 12, fontWeight: '700' },
  headerUserPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a24', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15 }
});