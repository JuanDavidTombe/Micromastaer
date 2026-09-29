import React, { useState, useEffect, useCallback } from 'react';import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import MicroCost from './pages/MicroCost';
import MicroStock from './pages/MicroStock';
import MicroDelivery from './pages/MicroDelivery';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { getDefaultRoute, hasModuleAccess, hasReadAccess } from './constants/roles';

const ROUTE_MODULES = {
  '/': 'dashboard',
  '/stock': 'inventory_stock',
  '/cost': 'recipes_production',
  '/orders': 'orders_delivery',
  '/delivery': 'orders_delivery',
  '/reports': 'reports_simulations',
  '/settings': 'administration',
};

function AuthenticatedApp({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user || location.pathname === '/login') return;

    // /stock admite tambien acceso de SOLO LECTURA (supervisor consultando bodega)
    const needsReadOnly = location.pathname === '/stock';
    const module = ROUTE_MODULES[location.pathname];
    const allowed = needsReadOnly
      ? hasReadAccess(user.role, 'inventory_stock')
      : hasModuleAccess(user.role, module);

    if (!module || !allowed) {
      navigate(getDefaultRoute(user.role), { replace: true });
    }
  }, [user, location.pathname]);

  // Anclajes internos: el sidebar navega a /ruta#seccion de la misma vista
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.pathname, location.hash]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('micromaster_token');
    localStorage.removeItem('micromaster_user');
    setUser(null);
    navigate('/login', { replace: true });
  }, [setUser, navigate]);

  const role = user?.role || 'ADMINISTRADOR';

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        user={user}
        sidebarOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col md:ml-64">
        <Topbar user={user} onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-cream">
          <Routes>
            {/* INICIO: exclusivo del administrador */}
            {hasModuleAccess(role, 'dashboard') && (
              <Route path="/" element={<Dashboard user={user} />} />
            )}

            {/* INVENTARIO & STOCK: escritura para admin+operario, lectura para supervisor */}
            {hasReadAccess(role, 'inventory_stock') && (
              <Route path="/stock" element={<MicroStock user={user} />} />
            )}

            {/* RECETAS & PRODUCCIÓN: admin + supervisor */}
            {hasModuleAccess(role, 'recipes_production') && (
              <Route path="/cost" element={<MicroCost user={user} />} />
            )}

            {/* PEDIDOS & ENTREGAS: admin + operario (una sola entrada, dos vistas) */}
            {hasModuleAccess(role, 'orders_delivery') && (
              <>
                <Route path="/orders" element={<Orders user={user} />} />
                <Route path="/delivery" element={<MicroDelivery user={user} />} />
              </>
            )}

            {/* REPORTES & SIMULACIONES: admin + contador (solo lectura/descarga) */}
            {hasModuleAccess(role, 'reports_simulations') && (
              <Route path="/reports" element={<Reports user={user} />} />
            )}

            {/* ADMINISTRACIÓN: solo admin */}
            {hasModuleAccess(role, 'administration') && (
              <Route path="/settings" element={<Settings user={user} />} />
            )}

            <Route path="*" element={<Navigate to={getDefaultRoute(role)} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('micromaster_token');
    const userData = localStorage.getItem('micromaster_user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('micromaster_token', token);
    localStorage.setItem('micromaster_user', JSON.stringify(userData));
    setUser(userData);
  };

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <AuthenticatedApp user={user} setUser={setUser} />
    </Router>
  );
}

export default App;
