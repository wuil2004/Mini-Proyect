import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  // Estados para guardar los datos del formulario
  const [isLogin, setIsLogin] = useState(true); // Cambia entre Login y Registro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate(); // Herramienta para cambiar de página

  // Función que se ejecuta al darle al botón de enviar
  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    setError('');

    // Decidimos a qué ruta del backend vamos a llamar
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    // Armamos el JSON que vamos a enviar
    const bodyData = isLogin 
      ? { email, password } 
      : { username, email, password };

    try {
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }

      // Si todo salió bien...
      if (isLogin) {
        // Guardamos el Gafete (Token) en el almacenamiento del navegador
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.username);
        // Lo mandamos directo al Muro principal
        navigate('/');
      } else {
        // Si se registró, le avisamos y lo pasamos a la pantalla de login
        alert('Registro exitoso. ¡Ahora inicia sesión!');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
      </h2>
      
      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Este campo solo aparece si el usuario se está registrando */}
        {!isLogin && (
          <input 
            type="text" 
            placeholder="Nombre de Usuario" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        )}

        <input 
          type="email" 
          placeholder="Correo Electrónico" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        
        <input 
          type="password" 
          placeholder="Contraseña" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <button type="submit" style={{ padding: '0.8rem', backgroundColor: '#1d9bf0', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isLogin ? 'Entrar' : 'Crear Cuenta'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
        {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
        <span 
          style={{ color: '#1d9bf0', cursor: 'pointer', textDecoration: 'underline' }} 
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
        </span>
      </p>
    </div>
  );
};

export default Login;