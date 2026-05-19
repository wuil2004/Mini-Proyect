import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, Image, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as ImagePicker from 'expo-image-picker';

const SERVER_IP = '192.168.2.46'; 
const socket = io(`http://${SERVER_IP}:4000`);

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

  const cargarFeed = async (type: 'global' | 'following' = feedType, nextPage = 1, isLoadMore = false) => {
    if (isLoadMore && (loadingMore || !hasMore)) return;
    if (isLoadMore) setLoadingMore(true);

    try {
      const token = await SecureStore.getItemAsync('token');
      const baseUrl = type === 'global' 
        ? `http://${SERVER_IP}:4000/api/posts`
        : `http://${SERVER_IP}:4000/api/posts/feed/following`;

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
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/profile/${user}`);
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
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/search?username=${text}`);
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
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/profile/${username}`);
      
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
      await fetch(`http://` + SERVER_IP + `:4000/api/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      setNewContent('');
      setSelectedImage(null); 
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la publicación');
    } finally { // <-- CORREGIDO: Se eliminó la palabra basura "platform:"
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
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/profile/edit`, {
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
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/profile/${selectedProfile.username}/follow`, {
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
              const response = await fetch(`http://${SERVER_IP}:4000/api/users/profile/${userToUnfollow}/follow`, {
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
      await fetch(`http://${SERVER_IP}:4000/api/posts/${postId}/like`, {
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
              await fetch(`http://${SERVER_IP}:4000/api/posts/${postId}`, {
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
            ↑ {pendingPosts.length} Trino{pendingPosts.length > 1 ? 's' : ''} nuevo{pendingPosts.length > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={clickLogoGeneral}>
          <Text style={styles.headerTitle}>Canary 🐦</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => verPerfilUsuario(currentUser)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {myProfileData.profilePicture ? (
              <Image source={{ uri: myProfileData.profilePicture }} style={styles.miniAvatar} />
            ) : (
              <View style={[styles.miniAvatar, { backgroundColor: '#e1e8ed', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 16 }}>👤</Text>
              </View>
            )}
            <Text style={styles.username}>@{currentUser}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="🔍 Buscar usuarios..." placeholderTextColor="#888" value={searchQuery} onChangeText={handleSearch} />
      </View>

      {searchResults.length > 0 && (
        <View style={styles.searchResultsBox}>
          {searchResults.map((item) => (
            <TouchableOpacity key={item._id} style={styles.searchResultItem} onPress={() => verPerfilUsuario(item.username)}>
              <Text style={styles.searchResultText}>@{item.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* --- SECCIÓN DE PERFIL --- */}
      {selectedProfile ? (
        <View style={styles.profileHeaderBox}>
          {selectedProfile.username === currentUser && !isEditingProfile && (
            <TouchableOpacity onPress={() => { setEditBio(selectedProfile.bio); setEditAvatar(selectedProfile.profilePicture); setIsEditingProfile(true); }} style={styles.editProfileButton}>
              <Text style={{ fontWeight: 'bold', fontSize: 12 }}>✏️ Editar</Text>
            </TouchableOpacity>
          )}

          {selectedProfile.username !== currentUser && (
            <TouchableOpacity onPress={handleFollow} style={[styles.followButton, { backgroundColor: selectedProfile.followers.includes(currentUser) ? '#dc3545' : '#1d9bf0' }]}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{selectedProfile.followers.includes(currentUser) ? "Dejar de seguir" : "Seguir"}</Text>
            </TouchableOpacity>
          )}

          {isEditingProfile ? (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Editar mi perfil</Text>
              <TouchableOpacity onPress={pickAvatarImage} style={{ marginBottom: 15, alignItems: 'center' }}>
                {editAvatar ? <Image source={{ uri: editAvatar }} style={styles.bigAvatar} /> : <View style={[styles.bigAvatar, { backgroundColor: '#e1e8ed', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 30 }}>📸</Text></View>}
                <Text style={{ color: '#1d9bf0', marginTop: 5, fontWeight: 'bold' }}>Cambiar foto</Text>
              </TouchableOpacity>
              <TextInput style={styles.bioInput} placeholder="Escribe algo sobre ti..." value={editBio} onChangeText={setEditBio} multiline maxLength={160} />
              <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setIsEditingProfile(false)} style={[styles.profileActionBtn, { backgroundColor: '#ccc' }]}><Text style={{ fontWeight: 'bold' }}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} disabled={isSavingProfile} style={[styles.profileActionBtn, { backgroundColor: '#1d9bf0' }]}>
                  {isSavingProfile ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: 'bold' }}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {selectedProfile.profilePicture ? <Image source={{ uri: selectedProfile.profilePicture }} style={styles.bigAvatar} /> : <View style={[styles.bigAvatar, { backgroundColor: '#e1e8ed', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 40 }}>👤</Text></View>}
              <Text style={styles.profileName}>{selectedProfile.username === currentUser ? "Mi Espacio Personal" : `@${selectedProfile.username}`}</Text>
              <Text style={styles.profileBio}>"{selectedProfile.bio}"</Text>
              
              <View style={styles.statsContainer}>
                <TouchableOpacity onPress={() => setNetworkModal({ isOpen: true, title: 'Siguiendo', users: selectedProfile.following })}>
                  <Text style={styles.statText}><Text style={styles.statNumber}>{selectedProfile.following.length}</Text> Siguiendo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNetworkModal({ isOpen: true, title: 'Seguidores', users: selectedProfile.followers })}>
                  <Text style={styles.statText}><Text style={styles.statNumber}>{selectedProfile.followers.length}</Text> Seguidores</Text>
                </TouchableOpacity>
                <Text style={styles.statText}><Text style={[styles.statNumber, {color: '#e0245e'}]}>{profileLikes}</Text> Likes</Text>
              </View>
              
              <TouchableOpacity style={styles.backButton} onPress={clickLogoGeneral}><Text style={styles.backButtonText}>⬅ Volver al Muro</Text></TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.publishBox}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            {myProfileData.profilePicture ? <Image source={{ uri: myProfileData.profilePicture }} style={{ width: 45, height: 45, borderRadius: 22.5 }} /> : <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#e1e8ed', justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 20 }}>👤</Text></View>}
            <TextInput style={styles.input} placeholder="¿Qué vas a cantar hoy?..." placeholderTextColor="#aaa" value={newContent} onChangeText={setNewContent} maxLength={280} multiline />
          </View>
          {selectedImage && (
            <View style={{ position: 'relative', marginTop: 10, marginLeft: 55 }}>
              <Image source={{ uri: selectedImage }} style={{ width: 80, height: 80, borderRadius: 10 }} />
              <TouchableOpacity style={{ position: 'absolute', top: -5, left: 65, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 2 }} onPress={() => setSelectedImage(null)}><Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>❌</Text></TouchableOpacity>
            </View>
          )}
          <View style={[styles.actionRow, { paddingLeft: 45 }]}>
            <TouchableOpacity onPress={pickImage} style={styles.cameraButton}><Text style={{ fontSize: 20 }}>📸</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.publishButton, isPublishing && { backgroundColor: '#88c9f9' }]} onPress={handlePublish} disabled={isPublishing}>
              {isPublishing ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.publishButtonText}>Trinar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!selectedProfile && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabButton, feedType === 'global' && styles.activeTabButton]} onPress={() => setFeedType('global')}>
            <Text style={[styles.tabText, feedType === 'global' && styles.activeTabText]}>Global 🌍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, feedType === 'following' && styles.activeTabButton]} onPress={() => setFeedType('following')}>
            <Text style={[styles.tabText, feedType === 'following' && styles.activeTabText]}>Siguiendo 👥</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Muro */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
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
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#1d9bf0" style={{ margin: 20 }} /> : null}
        ListEmptyComponent={() => (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ color: '#888', textAlign: 'center', fontSize: 16 }}>
              {feedType === 'following' ? "🐦 Aún no sigues a nadie. ¡Busca usuarios en la barra o explora el Global!" : "No hay publicaciones disponibles."}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const safeLikes = Array.isArray(item.likes) ? item.likes : [];
          return (
            <View style={styles.postCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <TouchableOpacity onPress={() => verPerfilUsuario(item.author)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.authorAvatar ? <Image source={{ uri: item.authorAvatar }} style={styles.miniAvatar} /> : <View style={[styles.miniAvatar, { backgroundColor: '#e1e8ed', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 16 }}>👤</Text></View>}
                  <Text style={styles.postAuthor}>@{item.author}</Text>
                </TouchableOpacity>
                {selectedProfile?.username === currentUser && item.author === currentUser && (
                  <TouchableOpacity onPress={() => handleDeletePost(item._id)} style={styles.deleteButton}><Text style={{ fontSize: 14 }}>🗑️</Text></TouchableOpacity>
                )}
              </View>
              <Text style={[styles.postContent, { paddingLeft: 45 }]}>{item.content}</Text>
              {item.image && (
                <TouchableOpacity onPress={() => setViewerImage(item.image || null)} style={{ paddingLeft: 45 }}>
                  <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
                </TouchableOpacity>
              )}
              <View style={[styles.postFooter, { paddingLeft: 45 }]}>
                <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                <TouchableOpacity onPress={() => handleLike(item._id)} style={styles.likeButton}>
                  <Text style={{ fontSize: 14 }}>{safeLikes.includes(currentUser) ? '❤️' : '🤍'}</Text>
                  <Text style={styles.likeText}>{safeLikes.length}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Visor de imágenes normal */}
      <Modal visible={!!viewerImage} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.closeModalButton} onPress={() => setViewerImage(null)}><Text style={styles.closeModalText}>Cerrar ✕</Text></TouchableOpacity>
          {viewerImage && <Image source={{ uri: viewerImage }} style={styles.fullScreenImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* --- MODAL NATIVO DE SEGUIDORES / SIGUIENDO --- */}
      <Modal visible={networkModal.isOpen} transparent={true} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContentBox}>
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
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', paddingTop: 5 },
  floatingButton: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: '#1d9bf0', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, zIndex: 100, elevation: 5 },
  floatingButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1d9bf0' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  username: { fontWeight: 'bold', marginRight: 10, color: '#333', textDecorationLine: 'underline' },
  logoutButton: { backgroundColor: '#dc3545', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15 },
  logoutText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  miniAvatar: { width: 35, height: 35, borderRadius: 17.5, marginRight: 10 },
  bigAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, borderWidth: 3, borderColor: '#1d9bf0' },
  searchContainer: { backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  searchInput: { backgroundColor: '#f0f2f5', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, fontSize: 15, color: '#333' },
  searchResultsBox: { backgroundColor: 'white', marginHorizontal: 12, borderRadius: 8, elevation: 5, position: 'absolute', top: 112, left: 0, right: 0, zIndex: 50 },
  searchResultItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  searchResultText: { fontSize: 15, fontWeight: 'bold', color: '#1d9bf0' },
  profileHeaderBox: { backgroundColor: 'white', padding: 15, margin: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed', alignItems: 'center', position: 'relative' },
  editProfileButton: { position: 'absolute', top: 15, right: 15, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: '#ccc' },
  followButton: { position: 'absolute', top: 15, right: 15, paddingVertical: 6, paddingHorizontal: 18, borderRadius: 20 },
  bioInput: { width: '100%', height: 60, backgroundColor: '#f0f2f5', borderRadius: 8, padding: 10, textAlignVertical: 'top' },
  profileActionBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  profileBio: { fontSize: 14, color: '#555', fontStyle: 'italic', marginBottom: 10, textAlign: 'center', paddingHorizontal: 20 },
  statsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 15 },
  statText: { fontSize: 13, color: '#666', textDecorationLine: 'underline' },
  statNumber: { fontWeight: 'bold', color: '#1d9bf0', fontSize: 15 },
  backButton: { backgroundColor: '#1d9bf0', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  backButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  publishBox: { backgroundColor: 'white', padding: 15, margin: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed' },
  input: { flex: 1, height: 60, textAlignVertical: 'top', fontSize: 16, color: '#333', backgroundColor: '#f0f2f5', borderRadius: 8, padding: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cameraButton: { padding: 5 },
  publishButton: { backgroundColor: '#1d9bf0', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, minWidth: 80, alignItems: 'center' },
  publishButtonText: { color: 'white', fontWeight: 'bold' },
  tabsContainer: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed', overflow: 'hidden' },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTabButton: { borderBottomColor: '#1d9bf0' },
  tabText: { fontWeight: 'bold', color: '#888', fontSize: 14 },
  activeTabText: { color: '#1d9bf0' },
  postCard: { backgroundColor: 'white', padding: 15, marginHorizontal: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed' },
  postAuthor: { fontWeight: 'bold', fontSize: 15, color: '#1d9bf0' },
  postContent: { fontSize: 16, color: '#333', marginBottom: 10, marginTop: 5 },
  postImage: { width: '100%', height: 250, borderRadius: 8, marginTop: 10 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f2f5', paddingTop: 8 },
  postDate: { color: '#888', fontSize: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f3', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15 },
  likeText: { fontSize: 14, fontWeight: 'bold', color: '#e0245e', marginLeft: 6 },
  deleteButton: { padding: 5, backgroundColor: '#f8d7da', borderRadius: 10 },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  closeModalButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 },
  closeModalText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  fullScreenImage: { width: '100%', height: '80%' },

  modalContentBox: { backgroundColor: 'white', width: '85%', borderRadius: 12, padding: 20, alignItems: 'center', elevation: 10 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 15 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  closeX: { fontSize: 18, color: '#aaa', fontWeight: 'bold' },
  emptyModalText: { textAlign: 'center', color: '#888', fontStyle: 'italic', marginVertical: 20 },
  modalUserRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginBottom: 8, width: '100%' },
  modalUserText: { fontWeight: 'bold', color: '#1d9bf0', fontSize: 15 },
  unfollowListBtn: { backgroundColor: '#dc3545', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  unfollowListText: { color: 'white', fontSize: 11, fontWeight: 'bold' }
});