import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store'; // <-- 1. Importamos el storage seguro

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !username)) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const bodyData = isLogin ? { email, password } : { username, email, password };

    try {
      // ⚠️ RECUERDA: Cambia "192.168.1.75" por la IP que te dio el comando 'hostname -I'
      const response = await fetch(`http://192.168.2.46:4000${endpoint}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Error');

      if (isLogin) {
        // --- 2. GUARDAMOS LOS DATOS EN EL CELULAR ---
        await SecureStore.setItemAsync('token', data.token);
        await SecureStore.setItemAsync('username', data.user.username);
        
        Alert.alert('Éxito', `¡Bienvenido @${data.user.username}!`);
        
        // Redirigimos al muro móvil
        router.replace('/feed');
      } else {
        Alert.alert('Éxito', 'Usuario registrado. Ahora inicia sesión.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo conectar con el servidor. Verifica la IP y que tu cel esté en el mismo Wi-Fi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</Text>

      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Nombre de Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Correo Electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear Cuenta'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchContainer}>
        <Text style={styles.switchText}>
          {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f0f2f5' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#1d9bf0' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ccc' },
  button: { backgroundColor: '#1d9bf0', padding: 15, borderRadius: 25, alignItems: 'center', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  switchContainer: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#1d9bf0', textDecorationLine: 'underline' },
});