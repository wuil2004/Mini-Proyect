import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Feed from './components/Feed'; // <-- 1. Importamos el Feed

function App() {
  return (
    <Router>
      <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', color: '#333' }}>
        <Routes>
          {/* 2. Colocamos el Feed en la ruta principal */}
          <Route path="/" element={<Feed />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;