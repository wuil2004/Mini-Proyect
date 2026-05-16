import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';
import { SafeAreaView } from 'react-native-safe-area-context'; 
// --- NUEVO: Importamos la librería para la galería ---
import * as ImagePicker from 'expo-image-picker';

const SERVER_IP = '192.168.0.111'; 
const socket = io(`http://${SERVER_IP}:4000`);

interface Post {
  _id: string;
  content: string;
  author: string;
  likes: string[];
  image?: string; // <-- Le decimos a TypeScript que el post puede traer imagen
  createdAt: string;
}

interface UserSearch {
  _id: string;
  username: string;
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newContent, setNewContent] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  
  // --- NUEVOS ESTADOS PARA IMÁGENES Y CARGA ---
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearch[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [profileLikes, setProfileLikes] = useState<number>(0);

  const router = useRouter();

  const cargarFeedGeneral = async () => {
    try {
      const response = await fetch(`http://${SERVER_IP}:4000/api/posts`);
      const data = await response.json();
      setPosts(data);
      setSelectedProfile(null);
    } catch (error) {
      console.error('Error al cargar posts:', error);
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
      cargarFeedGeneral();
    };

    inicializarFeed();

    socket.on('new_post', (postGuardado: Post) => {
      setPosts((postsAnteriores) => [postGuardado, ...postsAnteriores]);
    });

    socket.on('post_liked', (postActualizado: Post) => {
      setPosts((postsAnteriores) =>
        postsAnteriores.map((post) => (post._id === postActualizado._id ? postActualizado : post))
      );
    });

    return () => {
      socket.off('new_post');
      socket.off('post_liked');
    };
  }, []);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/search?username=${text}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
    }
  };

  const verPerfilUsuario = async (username: string) => {
    try {
      setSearchQuery('');
      setSearchResults([]);
      
      const response = await fetch(`http://${SERVER_IP}:4000/api/users/profile/${username}`);
      const data = await response.json();
      
      setSelectedProfile(data.username);
      setPosts(data.posts);
      setProfileLikes(data.totalLikes);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    }
  };

  // --- NUEVO: Función para abrir la galería ---
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Te deja recortar la foto
      quality: 0.8, // Comprime un poco para que suba rápido
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // --- ACTUALIZADO: Mandar datos por FormData en React Native ---
  const handlePublish = async () => {
    if (!newContent.trim() || isPublishing) return;

    setIsPublishing(true); // Bloqueamos el botón
    const token = await SecureStore.getItemAsync('token');
    
    const formData = new FormData();
    formData.append('content', newContent);

    // En React Native, FormData pide estos 3 datos para procesar un archivo local
    if (selectedImage) {
      const filename = selectedImage.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('image', {
        uri: selectedImage,
        name: filename,
        type,
      } as any); // "as any" para que TypeScript no chille
    }

    try {
      await fetch(`http://${SERVER_IP}:4000/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      setNewContent('');
      setSelectedImage(null); // Limpiamos foto
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la publicación');
    } finally {
      setIsPublishing(false); // Desbloqueamos el botón
    }
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

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('username');
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={cargarFeedGeneral}>
          <Text style={styles.headerTitle}>Canary 🐦</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => verPerfilUsuario(currentUser)}>
            <Text style={styles.username}>@{currentUser}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar usuarios..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <View style={styles.searchResultsBox}>
          {searchResults.map((item) => (
            <TouchableOpacity 
              key={item._id} 
              style={styles.searchResultItem}
              onPress={() => verPerfilUsuario(item.username)}
            >
              <Text style={styles.searchResultText}>@{item.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedProfile ? (
        <View style={styles.profileHeaderBox}>
          <Text style={styles.profileName}>Perfil de @{selectedProfile}</Text>
          <Text style={styles.profileStats}>✨ {posts.length} Posts  |  ❤️ {profileLikes} Likes totales</Text>
          <TouchableOpacity style={styles.backButton} onPress={cargarFeedGeneral}>
            <Text style={styles.backButtonText}>⬅ Volver al Feed General</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Caja para publicar */
        <View style={styles.publishBox}>
          <TextInput
            style={styles.input}
            placeholder="¿Qué vas a cantar hoy?..."
            placeholderTextColor="#aaa"
            value={newContent}
            onChangeText={setNewContent}
            maxLength={280}
            multiline
          />
          
          {/* Miniatura de la foto si seleccionaste una */}
          {selectedImage && (
            <View style={{ position: 'relative', marginTop: 10 }}>
              <Image source={{ uri: selectedImage }} style={{ width: 80, height: 80, borderRadius: 10 }} />
              <TouchableOpacity 
                style={{ position: 'absolute', top: -5, left: 65, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 2 }}
                onPress={() => setSelectedImage(null)} // Botón para quitar la foto
              >
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>❌</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actionRow}>
            {/* Botón de la cámara */}
            <TouchableOpacity onPress={pickImage} style={styles.cameraButton}>
              <Text style={{ fontSize: 20 }}>📸</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.publishButton, isPublishing && { backgroundColor: '#88c9f9' }]} 
              onPress={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.publishButtonText}>Trinar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Muro */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <TouchableOpacity onPress={() => verPerfilUsuario(item.author)}>
              <Text style={styles.postAuthor}>@{item.author}</Text>
            </TouchableOpacity>
            
            <Text style={styles.postContent}>{item.content}</Text>
            
            {/* Renderizar imagen del post si existe en Cloudinary */}
            {item.image && (
              <Image 
                source={{ uri: item.image }} 
                style={styles.postImage} 
                resizeMode="cover"
              />
            )}
            
            <View style={styles.postFooter}>
              <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              
              <TouchableOpacity onPress={() => handleLike(item._id)} style={styles.likeButton}>
                <Text style={{ fontSize: 14 }}>
                  {item.likes.includes(currentUser) ? '❤️' : '🤍'}
                </Text>
                <Text style={styles.likeText}>{item.likes.length}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', paddingTop: 5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1d9bf0' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  username: { fontWeight: 'bold', marginRight: 10, color: '#333', textDecorationLine: 'underline' },
  logoutButton: { backgroundColor: '#dc3545', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15 },
  logoutText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  searchContainer: { backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  searchInput: { backgroundColor: '#f0f2f5', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, fontSize: 15, color: '#333' },
  searchResultsBox: { backgroundColor: 'white', marginHorizontal: 12, borderRadius: 8, elevation: 5, position: 'absolute', top: 112, left: 0, right: 0, zIndex: 50 },
  searchResultItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  searchResultText: { fontSize: 15, fontWeight: 'bold', color: '#1d9bf0' },
  profileHeaderBox: { backgroundColor: 'white', padding: 15, margin: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed', alignItems: 'center' },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  profileStats: { fontSize: 14, color: '#666', marginBottom: 12 },
  backButton: { backgroundColor: '#1d9bf0', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  backButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  publishBox: { backgroundColor: 'white', padding: 15, margin: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed' },
  input: { height: 60, textAlignVertical: 'top', fontSize: 16, color: '#333' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cameraButton: { padding: 5 },
  publishButton: { backgroundColor: '#1d9bf0', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, minWidth: 80, alignItems: 'center' },
  publishButtonText: { color: 'white', fontWeight: 'bold' },
  postCard: { backgroundColor: 'white', padding: 15, marginHorizontal: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e1e8ed' },
  postAuthor: { fontWeight: 'bold', fontSize: 14, color: '#1d9bf0', marginBottom: 5 },
  postContent: { fontSize: 16, color: '#333', marginBottom: 10 },
  postImage: { width: '100%', height: 250, borderRadius: 8, marginTop: 10 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f2f5', paddingTop: 8 },
  postDate: { color: '#888', fontSize: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f3', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15 },
  likeText: { fontSize: 14, fontWeight: 'bold', color: '#e0245e', marginLeft: 6 },
});