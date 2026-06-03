import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const bodyData = isLogin 
      ? { email, password } 
      : { username, email, password };

    try {
      const response = await fetch(`http://10.53.255.90:5000${endpoint}`, {
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

      if (isLogin) {
        // Si inicia sesión con éxito, guardamos token y vamos al muro
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user ? data.user.username : username);
        navigate('/'); 
      } else {
        // REGRESO AL COMPORTAMIENTO ANTERIOR: Si se registra con éxito, limpia campos,
        // avisa al usuario y lo pasa a la pestaña de login para que inicie sesión manualmente
        alert('¡Registro exitoso! Por favor, inicia sesión con tus credenciales.');
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setUsername('');
      }
      
    } catch (err) {
      setError(err.message);
    }
  };

  const colors = {
    bgAbsolute: "#000000",
    bgCard: "#0d0d13",
    textMain: "#ffffff",
    textMuted: "#8e8e9f"
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", backgroundColor: colors.bgAbsolute, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", color: colors.textMain, boxSizing: "border-box" }}>
      
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: #000000 !important;
          width: 100%;
          height: 100%;
        }
        @keyframes ledEffect {
          0% { border-color: #00f7ff; box-shadow: 0 0 12px rgba(0, 247, 255, 0.35); }
          25% { border-color: #ff00e0; box-shadow: 0 0 12px rgba(255, 0, 224, 0.35); }
          50% { border-color: #ffea00; box-shadow: 0 0 12px rgba(255, 234, 0, 0.35); }
          75% { border-color: #00ff66; box-shadow: 0 0 12px rgba(0, 255, 102, 0.35); }
          100% { border-color: #00f7ff; box-shadow: 0 0 12px rgba(0, 247, 255, 0.35); }
        }
        .led-container {
          border: 3px solid #00f7ff;
          animation: ledEffect 6s linear infinite;
        }
        .led-input {
          border: 2px solid #00f7ff;
          animation: ledEffect 8s linear infinite;
        }
      `}</style>

      <div className="led-container" style={{ width: '100%', maxWidth: '420px', padding: '3rem 2.5rem', backgroundColor: colors.bgCard, borderRadius: '24px', boxSizing: 'border-box' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '1.25rem', fontSize: '2.5rem' }}>
          <span>🐦</span>
        </div>
        
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', margin: '0 0 2rem 0', fontWeight: '900', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {isLogin ? 'Canary' : 'Registro'}
        </h2>
        
        {error && (
          <div style={{ backgroundColor: "rgba(255, 77, 77, 0.15)", color: "#ff4d4d", padding: '1rem', borderRadius: '12px', border: `2px solid #ff4d4d`, marginBottom: '1.5rem', fontSize: '0.95rem', fontWeight: '700', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {!isLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: '800', color: "#00f7ff" }}>Nombre de Usuario</label>
              <input 
                type="text" 
                placeholder="Nombre de usuario" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
                className="led-input"
                style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '1.05rem', outline: 'none', backgroundColor: '#000000', color: colors.textMain, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '800', color: "#ff00e0" }}>Correo Electrónico</label>
            <input 
              type="email" 
              placeholder="correo@ejemplo.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="led-input"
              style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '1.05rem', outline: 'none', backgroundColor: '#000000', color: colors.textMain, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '800', color: "#ffea00" }}>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="led-input"
              style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '1.05rem', outline: 'none', backgroundColor: '#000000', color: colors.textMain, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" className="led-input" style={{ padding: '0.9rem', backgroundColor: "#000000", color: "white", borderRadius: '9999px', cursor: 'pointer', fontWeight: '800', fontSize: '1.1rem', marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {isLogin ? 'Entrar' : 'Registrarse'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2rem', marginBottom: 0, fontSize: '0.95rem', color: colors.textMuted }}>
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <span 
            style={{ color: "#00f7ff", cursor: 'pointer', fontWeight: '800' }} 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setEmail('');
              setPassword('');
              setUsername('');
            }}
          >
            {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;