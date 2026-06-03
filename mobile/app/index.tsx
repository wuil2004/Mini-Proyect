import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store'; 

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // Animación base para el ciclo de colores LED idéntica al feed
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 8000, // Ciclo coordinado de 8 segundos
        useNativeDriver: false,
      })
    ).start();
  }, []);

  // Interpolación exacta de la regla @keyframes ledEffect del CSS web
  const ledBorderColor = animValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['#00f7ff', '#ff00e0', '#ffea00', '#00ff66', '#00f7ff']
  });

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !username)) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const bodyData = isLogin ? { email, password } : { username, email, password };

    try {
      const response = await fetch(`http://10.53.255.90:5000${endpoint}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Error');

      if (isLogin) {
        await SecureStore.setItemAsync('token', data.token);
        await SecureStore.setItemAsync('username', data.user.username);
        
        Alert.alert('Éxito', `¡Bienvenido @${data.user.username}!`);
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
      <Animated.View style={[styles.card, { borderColor: ledBorderColor }]}>
        
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🐦</Text>
        </View>

        <Text style={styles.title}>{isLogin ? 'Canary' : 'Registro'}</Text>

        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: '#00f7ff' }]}>Nombre de Usuario</Text>
            <Animated.View style={[styles.inputWrapper, { borderColor: ledBorderColor }]}>
              <TextInput
                style={styles.input}
                placeholder="Nombre de usuario"
                placeholderTextColor="#8e8e9f"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </Animated.View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: '#ff00e0' }]}>Correo Electrónico</Text>
          <Animated.View style={[styles.inputWrapper, { borderColor: ledBorderColor }]}>
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#8e8e9f"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Animated.View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: '#ffea00' }]}>Contraseña</Text>
          <Animated.View style={[styles.inputWrapper, { borderColor: ledBorderColor }]}>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor="#8e8e9f"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrapper, { borderColor: ledBorderColor }]}>
          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.buttonText}>{isLogin ? 'Entrar' : 'Registrarse'}</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity 
          onPress={() => {
            setIsLogin(!isLogin);
            setEmail('');
            setPassword('');
            setUsername('');
          }} 
          style={styles.switchContainer}
        >
          <Text style={styles.switchTextMuted}>
            {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <Text style={styles.switchTextActive}>
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
            </Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 16, 
    backgroundColor: '#000000' 
  },
  card: {
    backgroundColor: '#0d0d13',
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 3,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 40
  },
  title: { 
    fontSize: 32, 
    fontWeight: '900', 
    textAlign: 'center', 
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 32,
    textTransform: 'uppercase',
  },
  inputGroup: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 24,
    width: '100%'
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  inputWrapper: {
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden'
  },
  input: { 
    backgroundColor: '#000000', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    color: '#ffffff',
    fontSize: 17,
  },
  buttonWrapper: {
    borderWidth: 2,
    borderRadius: 9999,
    marginTop: 16,
    overflow: 'hidden'
  },
  button: { 
    backgroundColor: '#000000', 
    paddingVertical: 14, 
    alignItems: 'center', 
  },
  buttonText: { 
    color: 'white', 
    fontWeight: '800', 
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  switchContainer: { 
    marginTop: 32, 
    alignItems: 'center' 
  },
  switchTextMuted: {
    fontSize: 15,
    color: '#8e8e9f'
  },
  switchTextActive: { 
    color: '#00f7ff', 
    fontWeight: '800',
  }
});