import React, { useState, useEffect, useCallback, useRef } from 'react';import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // El rol es el emitido por Laravel Sanctum en /auth/login. No se modifica
  // desde la interfaz: sólo el ADMINISTRADOR lo cambia en /settings#usuarios.
  const role = user?.role || 'ADMINISTRADOR';

  // Refleja en el estado global (y en localStorage) los cambios que el
  // usuario haga sobre su propio perfil desde el modal del Topbar.
  //
  // El merge se calcula FUERA del updater de setState: escribir en
  // localStorage dentro de un updater es un efecto secundario que React
  // puede ejecutar cero, una o dos veces según el batching.
  const userRef = useRef(user);
  userRef.current = user;

  const handleProfileUpdated = useCallback((patch) => {
    if (!patch) return;
    const next = { ...(userRef.current || {}), ...patch };
    localStorage.setItem('micromaster_user', JSON.stringify(next));
    setUser(next);
  }, [setUser]);

  useEffect(() => {
    if (!user || location.pathname === '/login') return;

    // /stock admite tambien acceso de SOLO LECTURA (supervisor consultando bodega)
    const needsReadOnly = location.pathname === '/stock';
    const module = ROUTE_MODULES[location.pathname];
    const allowed = needsReadOnly
      ? hasReadAccess(role, 'inventory_stock')
      : hasModuleAccess(role, module);

    if (!module || !allowed) {
      navigate(getDefaultRoute(role), { replace: true });
    }
  }, [role, location.pathname]);

  // Anclajes internos: el sidebar navega a /ruta#seccion de la misma vista
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.pathname, location.hash]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('micromaster_token');
    localStorage.removeItem('micromaster_user');
    setUser(null);
    navigate('/login', { replace: true });
  }, [setUser, navigate]);

  return (
    <div className="flex h-dvh bg-cream overflow-hidden">
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
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        <Topbar user={user} onMenuToggle={() => setSidebarOpen((v) => !v)} onProfileUpdated={handleProfileUpdated} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 md:p-6 bg-cream dark:bg-slate-900 transition-colors">
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

  // Aplica el tema oscuro ANTES de que se monte la interfaz, para que un
  // recarga no desajuste el color. Tailwind usa la clase `dark` en <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', user?.theme === 'dark');
  }, [user?.theme]);

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
          {/* PÚBLICAS: acceso sin sesión. El registro no entrega token,
              la cuenta nace PENDING y debe aprobar el ADMINISTRADOR. */}
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
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
