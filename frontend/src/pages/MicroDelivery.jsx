import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { delivery, orders as ordersApi } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ModuleTabs from '../components/ModuleTabs';
import DriverAvatar from '../components/DriverAvatar';
import LogisticsMap from '../components/LogisticsMap';
import RouteFormModal from '../components/RouteFormModal';
import IncidentsPanel from '../components/IncidentsPanel';
import { hasModuleAccess, can } from '../constants/roles';

const POLL_MS = 5000;
const GPS_PING_MS = 8000;

// ---------------------------------------------------------------------------
// Utilidades de geometría (idénticas en espíritu al GpsSimulator del backend)
// ---------------------------------------------------------------------------
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearing(a, b) {
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function routePath(route) {
  const path = [];
  if (route.origin_lat != null) path.push({ lat: Number(route.origin_lat), lng: Number(route.origin_lng) });
  route.stops.forEach((s) => path.push({ lat: s.latitude, lng: s.longitude }));
  return path;
}

function interpolate(path, phase) {
  if (!path.length) return null;
  if (path.length === 1) return { latitude: path[0].lat, longitude: path[0].lng, heading: 0 };
  const lens = path.slice(0, -1).map((p, i) => haversineKm(p, path[i + 1]));
  const total = lens.reduce((s, v) => s + v, 0) || 1;
  let target = Math.max(0, Math.min(1, phase)) * total;
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= target || i === lens.length - 1) {
      const ratio = lens[i] > 0 ? Math.max(0, Math.min(1, (target - acc) / lens[i])) : 1;
      const a = path[i];
      const b = path[i + 1];
      return {
        latitude: a.lat + (b.lat - a.lat) * ratio,
        longitude: a.lng + (b.lng - a.lng) * ratio,
        heading: bearing(a, b),
      };
    }
    acc += lens[i];
  }
  return null;
}

function formatDuration(min) {
  if (min == null) return '—';
  const m = Math.round(Number(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export default function MicroDelivery({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const canAccess = hasModuleAccess(role, 'orders_delivery');
  const isManager = role === 'ADMINISTRADOR' || role === 'OPERARIO_LOGISTICO';
  const canCreate = can(role, 'create') && canAccess;
  const canUpdate = can(role, 'update') && canAccess;

  const [routes, setRoutes] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [incSummary, setIncSummary] = useState(null);
  const [cobroOrders, setCobroOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [gpsLive, setGpsLive] = useState(false);
  const [toast, setToast] = useState('');
  const gpsTimer = useRef(null);

  // --- Cobro OTP / pagos (sección existente, ahora colapsada) ---
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpResult, setOtpResult] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const refreshRoutes = useCallback(() => {
    return delivery
      .getRoutes()
      .then((res) => {
        setRoutes(res.data.routes || []);
        setRouteSummary(res.data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshIncidents = useCallback(() => {
    return delivery
      .getIncidents()
      .then((res) => {
        setIncidents(res.data.incidents || []);
        setIncSummary(res.data.summary || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canAccess) return undefined;
    refreshRoutes();
    refreshIncidents();
    delivery.getOrders().then((res) => setCobroOrders(res.data.orders || [])).catch(() => {});
    if (isManager) {
      delivery.getDrivers().then((res) => setDrivers(res.data.drivers || [])).catch(() => {});
      ordersApi.list({ status: 'pending' }).then((res) => setPendingOrders(res.data.orders || [])).catch(() => {});
    }
    const id = setInterval(() => {
      refreshRoutes();
      refreshIncidents();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [canAccess, isManager, refreshRoutes, refreshIncidents]);

  // ------------------------------------------------------------------
  // GPS EN VIVO: la web transmite una coordenada real a la API.
  // Mientras está activa, driver_gps.source pasa a 'real' (<= 90 s).
  // ------------------------------------------------------------------
  const pingGps = useCallback(async () => {
    const route = routes.find((r) => r.id === selectedRouteId) || routes.find((r) => r.status === 'in_progress') || routes[0];
    if (!route) return;
    const path = routePath(route);
    if (!path.length) return;
    const period = Math.max(1, route.stops.length) * 90;
    const phase = ((Date.now() / 1000) % period) / period;
    const pos = interpolate(path, phase);
    if (!pos) return;
    const payload = {
      latitude: Number(pos.latitude.toFixed(6)),
      longitude: Number(pos.longitude.toFixed(6)),
      speed_kmh: route.status === 'in_progress' ? 46.5 : 0,
      heading: pos.heading,
    };
    if (isManager && route.driver?.id) payload.driver_id = route.driver.id;
    try {
      await delivery.sendLocation(payload);
    } catch (e) {
      /* sin conexión: se mantiene el último punto */
    }
  }, [routes, selectedRouteId, isManager]);

  useEffect(() => {
    if (!gpsLive) {
      if (gpsTimer.current) clearInterval(gpsTimer.current);
      gpsTimer.current = null;
      return undefined;
    }
    pingGps();
    gpsTimer.current = setInterval(pingGps, GPS_PING_MS);
    return () => clearInterval(gpsTimer.current);
  }, [gpsLive, pingGps]);

  // ------------------------------------------------------------------
  // Acciones de gestión de ruta
  // ------------------------------------------------------------------
  const handleCreateRoute = async (data) => {
    setCreatingRoute(true);
    try {
      const res = await delivery.createRoute(data);
      flash(res.data?.message || 'Ruta creada');
      await refreshRoutes();
      await Promise.all([
        ordersApi.list({ status: 'pending' }).then((r) => setPendingOrders(r.data.orders || [])).catch(() => {}),
        delivery.getOrders().then((r) => setCobroOrders(r.data.orders || [])).catch(() => {}),
      ]);
    } finally {
      setCreatingRoute(false);
    }
  };

  const handleIncidentReport = async (data) => {
    const res = await delivery.createIncident(data);
    flash(res.data?.message || 'Novedad reportada');
    await refreshIncidents();
    await refreshRoutes();
  };

  const handleIncidentUpdate = async (id, data) => {
    try {
      const res = await delivery.updateIncident(id, data);
      flash(res.data?.message || 'Novedad actualizada');
      await refreshIncidents();
      await refreshRoutes();
      if (isManager) {
        delivery.getDrivers().then((r) => setDrivers(r.data.drivers || [])).catch(() => {});
      }
    } catch (e) {
      flash(e?.response?.data?.message || 'No se pudo actualizar la novedad');
    }
  };

  // ------------------------------------------------------------------
  // Cobro OTP
  // ------------------------------------------------------------------
  const handleVerifyOtp = async () => {
    try {
      const res = await delivery.verifyOtp(otpCode);
      setOtpResult(res.data);
    } catch (e) {
      setOtpResult({ valid: false });
    }
  };

  const handleCompletePayment = async () => {
    if (!otpResult?.valid) return;
    try {
      await delivery.completePayment({ order_id: otpResult.order.id, otp_code: otpCode });
      setShowOtpModal(false);
      setOtpCode('');
      setOtpResult(null);
      delivery.getOrders().then((res) => setCobroOrders(res.data.orders || [])).catch(() => {});
    } catch (e) {
      setOtpResult({ valid: false });
    }
  };

  const handleUpdatePayment = async (method) => {
    if (!selectedOrder) return;
    try {
      await delivery.updatePayment({
        order_id: selectedOrder.id,
        payment_method: method || paymentMethod,
        received_amount: parseFloat(paymentAmount) || selectedOrder.amount,
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      delivery.getOrders().then((res) => setCobroOrders(res.data.orders || [])).catch(() => {});
    } catch (e) {
      /* noop */
    }
  };

  const incidentOrderIds = useMemo(() => {
    const ids = [];
    incidents.filter((i) => i.status === 'OPEN').forEach((i) => i.order_id && ids.push(i.order_id));
    return ids;
  }, [incidents]);

  const reportableOrders = useMemo(() => {
    const seen = new Map();
    routes.forEach((r) => (r.stops || []).forEach((s) => seen.set(s.order_id, {
      id: s.order_id,
      client_name: s.client_name,
      destination: s.destination,
    })));
    return [...seen.values()];
  }, [routes]);

  const onlineDrivers = drivers.filter((d) => d.tracking?.online).length;

  // Separación estricta de vistas: mapa GPS vs cobros & OTP
  const location = useLocation();
  const activeTab = location.hash === '#cobro' ? 'payments' : 'map';

  // Resumen de caja para la vista de cobros
  const cajaSummary = useMemo(() => {
    const collected = cobroOrders
      .filter((o) => o.payment_status === 'completed')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    const pending = cobroOrders
      .filter((o) => o.payment_status === 'pending')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    const confirmed = cobroOrders
      .filter((o) => o.payment_status === 'confirmed')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    return { collected, pending, confirmed, total: cobroOrders.length };
  }, [cobroOrders]);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Logística</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  if (activeTab === 'payments') {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cobros, Caja & OTP</h1>
            <p className="text-sm text-slate-500">Verificación de cobros, registro de pagos y arqueo diario</p>
          </div>
          <TechBadge label="COBRO OTP · CAJA" color="lime" />
        </div>

        {toast && (
          <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FreshCard title="Cobrado Hoy" value={`$${cajaSummary.collected.toLocaleString()}`} subtitle="Completados" icon="💰" color="lime" />
          <FreshCard title="Pendiente" value={`$${cajaSummary.pending.toLocaleString()}`} subtitle="Sin cobrar" icon="⏳" color="terracotta" />
          <FreshCard title="Confirmado" value={`$${cajaSummary.confirmed.toLocaleString()}`} subtitle="Por completar" icon="✅" color="cream" />
          <FreshCard title="Total Pedidos" value={cajaSummary.total} subtitle="En caja" icon="📦" color="lime" />
        </div>

        <div id="cobro" className="bg-slate-900 rounded-3xl overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-white/10">
            <span className="text-sm uppercase tracking-[0.2em] text-lime-400 font-semibold">
              📱 Cobro OTP y registro de pagos
            </span>
          </div>

          <div className="px-4 md:px-6 py-4 md:py-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-white/70 mb-3">Verificación de Código OTP</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.toUpperCase()); setOtpResult(null); }}
                    placeholder="Ingrese código OTP"
                    maxLength={4}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center text-lg font-mono focus:ring-2 focus:ring-lime-400 outline-none"
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={!canCreate}
                    className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                  >
                    Verificar
                  </button>
                </div>
                {otpResult && (
                  <div className={`mt-3 p-4 rounded-xl ${otpResult.valid ? 'bg-lime-400/20 border border-lime-400/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                    <p className={`font-bold ${otpResult.valid ? 'text-lime-400' : 'text-red-400'}`}>
                      {otpResult.valid ? `✅ Pedido #${otpResult.order?.id} — $${otpResult.order?.amount}` : '❌ Código OTP no válido'}
                    </p>
                    {otpResult.valid && <p className="text-xs text-white/70 mt-1">Destino: {otpResult.order?.destination}</p>}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-white/70 mb-3">Registro de Cobro</h3>
                {selectedOrder ? (
                  <div className="space-y-3">
                    <div className="bg-white/10 rounded-xl p-3">
                      <p className="text-xs text-white/70">Pedido #{selectedOrder.id}</p>
                      <p className="text-lg font-bold">${selectedOrder.amount}</p>
                      <p className="text-xs text-white/70">{selectedOrder.destination}</p>
                    </div>
                    <div className="flex gap-2">
                      {canUpdate && (
                        <button onClick={() => handleUpdatePayment('cash')} className="flex-1 bg-lime-400 hover:bg-lime-500 text-slate-900 py-2 rounded-xl text-xs font-bold transition-all">
                          💵 Efectivo
                        </button>
                      )}
                      {canUpdate && (
                        <button onClick={() => handleUpdatePayment('qr')} className="flex-1 bg-terracotta-400 hover:bg-terracotta-500 text-white py-2 rounded-xl text-xs font-bold transition-all">
                          📱 QR
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/50">Selecciona un pedido pendiente de cobro.</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cobroOrders.map((order) => (
                <div key={order.id} className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] text-white/50">#{order.id}</span>
                    <StatusBadge status={order.payment_status} />
                  </div>
                  <p className="text-xs font-medium text-white truncate">{order.destination}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-white/50">
                      {order.payment_method === 'cash' ? 'Efectivo' : 'QR'}
                    </span>
                    <span className="text-sm font-bold text-lime-400">${order.amount}</span>
                  </div>
                  {order.payment_status === 'pending' && canUpdate && (
                    <button
                      onClick={() => { setSelectedOrder(order); setPaymentAmount(order.amount.toString()); setShowPaymentModal(true); }}
                      className="mt-2 w-full bg-lime-400 hover:bg-lime-500 text-slate-900 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                    >
                      Registrar Pago
                    </button>
                  )}
                  {order.payment_status === 'confirmed' && canCreate && (
                    <button
                      onClick={() => { setSelectedOrder(order); setShowOtpModal(true); }}
                      className="mt-2 w-full bg-terracotta-400 hover:bg-terracotta-500 text-white py-1.5 rounded-xl text-[11px] font-bold transition-all"
                    >
                      Verificar OTP y Completar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <RouteFormModal
          isOpen={showRouteForm}
          onClose={() => setShowRouteForm(false)}
          orders={pendingOrders}
          drivers={drivers}
          onSubmit={handleCreateRoute}
          creating={creatingRoute}
        />

        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Registrar Pago"
          footer={
            <>
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => handleUpdatePayment()} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Confirmar Pago</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Método de Pago</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
                <option value="cash">Efectivo</option>
                <option value="qr">QR</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Monto Recibido</label>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            {selectedOrder && (
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-slate-500">Cambio:</p>
                <p className="text-lg font-bold text-[#4F6B00]">${((parseFloat(paymentAmount) || 0) - selectedOrder?.amount).toFixed(2)}</p>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={showOtpModal}
          onClose={() => { setShowOtpModal(false); setOtpCode(''); setOtpResult(null); }}
          title="🔐 Verificación OTP"
          footer={
            <>
              <button onClick={() => { setShowOtpModal(false); setOtpCode(''); setOtpResult(null); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
              {otpResult?.valid ? (
                <button onClick={handleCompletePayment} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Completar Pago</button>
              ) : (
                <button onClick={handleVerifyOtp} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Verificar</button>
              )}
            </>
          }
        >
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-500">Ingrese el código OTP del pedido para verificar el cobro</p>
            <input type="text" value={otpCode} onChange={(e) => { setOtpCode(e.target.value.toUpperCase()); setOtpResult(null); }} maxLength={4} placeholder="----" className="w-32 mx-auto px-4 py-4 text-2xl font-mono text-center rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none tracking-[0.5em]" />
            {otpResult && (
              <div className={`p-4 rounded-xl text-left ${otpResult.valid ? 'bg-lime-400/20 border border-lime-400/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <p className={`font-bold text-sm ${otpResult.valid ? 'text-[#3F5600]' : 'text-red-600'}`}>
                  {otpResult.valid ? `✅ Pedido #${otpResult.order?.id} — $${otpResult.order?.amount}` : '❌ Código OTP no válido'}
                </p>
                {otpResult.valid && <p className="text-xs text-slate-500 mt-1">Destino: {otpResult.order?.destination}</p>}
              </div>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos & Entregas</h1>
          <p className="text-sm text-slate-500">Rutas, conductores, mapa en vivo y novedades de campo</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <ModuleTabs tabs={[{ path: '/orders', label: 'Pedidos' }, { path: '/delivery', label: 'Logística' }]} />
          <TechBadge label="GOOGLE MAPS · LOGÍSTICA" color="terracotta" />
        </div>
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* ---------------- KPI ---------------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Rutas activas" value={routeSummary?.active ?? 0} subtitle="En curso" icon="🛣️" color="lime" />
        <FreshCard title="Novedades abiertas" value={incSummary?.open ?? 0} subtitle="Requieren gestión" icon="🚨" color="terracotta" />
        <FreshCard title="Conductores en línea" value={isManager ? `${onlineDrivers}/${drivers.length}` : '—'} subtitle="GPS real o en ruta" icon="🚚" color="lime" />
        <FreshCard title="Entregadas" value={routeSummary?.completed ?? 0} subtitle="Rutas cerradas" icon="📦" color="cream" />
      </div>

      {/* ---------------- 3 PANELES ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* PANEL SUPERIOR: rutas y conductores */}
        <div className="lg:col-span-4 bg-white/80 rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 id="rutas" className="text-sm uppercase tracking-[0.2em] text-slate-500">Rutas y conductores</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{routes.length} rutas · {routes.filter((r) => (r.open_incidents || 0) > 0).length} con incidencia</p>
            </div>
            {isManager && (
              <button
                onClick={() => setShowRouteForm(true)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900 text-lime-400 hover:bg-slate-800 transition-all"
              >
                + Nueva ruta
              </button>
            )}
          </div>

          {isManager && drivers.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 mb-3 border-b border-slate-100">
              {drivers.map((d) => (
                <div key={d.id} className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-xl bg-cream border border-slate-200">
                  <DriverAvatar driver={d} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 whitespace-nowrap">{d.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-slate-400 whitespace-nowrap">{d.active_routes} ruta(s)</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {loading && routes.length === 0 && (
              <p className="text-xs text-slate-400 p-4 text-center">Cargando rutas…</p>
            )}
            {!loading && routes.length === 0 && (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-600">Sin rutas asignadas</p>
              </div>
            )}

            {routes.map((route) => {
              const selected = route.id === selectedRouteId;
              const gps = route.driver_gps;
              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(selected ? null : route.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                      : 'bg-white/70 border-slate-200 hover:border-lime-400/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-mono text-xs ${selected ? 'text-lime-400' : 'text-slate-500'}`}>{route.route_code}</span>
                    <StatusBadge status={route.status} />
                  </div>

                  <p className={`font-medium text-sm ${selected ? 'text-white' : 'text-slate-900'}`}>{route.destination}</p>

                  <div className="flex items-center gap-2 mt-2">
                    <DriverAvatar driver={route.driver} size="sm" signal={gps?.signal} />
                    <div className="min-w-0">
                      <p className={`text-[11px] font-semibold truncate ${selected ? 'text-white/90' : 'text-slate-700'}`}>
                        {route.driver?.name || 'Sin conductor'}
                      </p>
                      <p className={`text-[10px] truncate ${selected ? 'text-white/50' : 'text-slate-400'}`}>
                        {route.driver?.vehicle}
                      </p>
                    </div>
                  </div>

                  <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${selected ? 'bg-white/20' : 'bg-slate-100'}`}>
                    <div
                      className="h-full rounded-full bg-lime-400 transition-all"
                      style={{ width: `${route.progress || 0}%` }}
                    />
                  </div>

                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] ${selected ? 'text-white/60' : 'text-slate-400'}`}>
                    <span>{route.delivered_count}/{route.stops_count} entregas</span>
                    <span>{route.distance_km != null ? `${Math.round(route.distance_km)} km` : '—'}</span>
                    <span>{formatDuration(route.duration_min)}</span>
                    <span>{route.scheduled_date}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      gps?.source === 'real' ? 'bg-lime-400/30 text-[#3F5600]' : 'bg-slate-900/10 text-slate-500'
                    }`}>
                      {gps?.source === 'real' ? '📡 GPS real' : '🕹️ GPS simulado'}
                    </span>
                    {route.open_incidents > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600">
                        🔴 {route.open_incidents} incidencia(s)
                      </span>
                    )}
                  </div>

                  {selected && route.stops.length > 0 && (
                    <ol className={`mt-3 pt-3 border-t space-y-1.5 ${selected ? 'border-white/15' : 'border-slate-100'}`}>
                      {route.stops.map((s, i) => (
                        <li key={s.order_id} className="flex items-center gap-2 text-[11px]">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                            s.status === 'delivered' ? 'bg-green-500 text-white'
                              : incidentOrderIds.includes(s.order_id) ? 'bg-red-500 text-white'
                                : 'bg-amber-400 text-slate-900'
                          }`}>{i + 1}</span>
                          <span className={`flex-1 truncate ${selected ? 'text-white/80' : 'text-slate-600'}`}>{s.client_name}</span>
                          <span className={`text-[10px] ${selected ? 'text-white/40' : 'text-slate-400'}`}>${s.amount}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL CENTRAL: mapa Google Maps */}
        <div className="lg:col-span-5 bg-white/80 rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 id="mapa" className="text-sm uppercase tracking-[0.2em] text-slate-500">Mapa de operación</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedRouteId ? 'Ruta seleccionada resaltada' : 'Todas las rutas activas'}
              </p>
            </div>
            {canCreate && (
              <button
                onClick={() => setGpsLive((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  gpsLive
                    ? 'bg-lime-400 text-slate-900 shadow'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
                title="Transmite una coordenada real a POST /api/delivery/location"
              >
                {gpsLive ? '📡 GPS en vivo · ON' : '📡 Simular transmisión GPS'}
              </button>
            )}
          </div>

          <LogisticsMap
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            incidentOrderIds={incidentOrderIds}
          />

          <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-slate-400">
            <span>Refresco automático cada {POLL_MS / 1000}s</span>
            <span>·</span>
            <span>{gpsLive ? `Transmisión GPS cada ${GPS_PING_MS / 1000}s` : 'Posición simulada sobre la ruta'}</span>
          </div>
        </div>

        {/* PANEL LATERAL: novedades de campo */}
        <div id="incidencias" className="lg:col-span-3">
          <IncidentsPanel
            incidents={incidents}
            summary={incSummary}
            canManage={isManager}
            drivers={drivers}
            routes={routes}
            reportableOrders={reportableOrders}
            onReport={handleIncidentReport}
            onUpdate={handleIncidentUpdate}
          />
        </div>
      </div>

      {/* ---------------- MODALES ---------------- */}
      <RouteFormModal
        isOpen={showRouteForm}
        onClose={() => setShowRouteForm(false)}
        orders={pendingOrders}
        drivers={drivers}
        onSubmit={handleCreateRoute}
        creating={creatingRoute}
      />

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Pago"
        footer={
          <>
            <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button onClick={() => handleUpdatePayment()} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Confirmar Pago</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Método de Pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
              <option value="cash">Efectivo</option>
              <option value="qr">QR</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Monto Recibido</label>
            <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          {selectedOrder && (
            <div className="bg-cream rounded-xl p-3">
              <p className="text-xs text-slate-500">Cambio:</p>
              <p className="text-lg font-bold text-[#4F6B00]">${((parseFloat(paymentAmount) || 0) - selectedOrder?.amount).toFixed(2)}</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showOtpModal}
        onClose={() => { setShowOtpModal(false); setOtpCode(''); setOtpResult(null); }}
        title="🔐 Verificación OTP"
        footer={
          <>
            <button onClick={() => { setShowOtpModal(false); setOtpCode(''); setOtpResult(null); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            {otpResult?.valid ? (
              <button onClick={handleCompletePayment} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Completar Pago</button>
            ) : (
              <button onClick={handleVerifyOtp} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Verificar</button>
            )}
          </>
        }
      >
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-500">Ingrese el código OTP del pedido para verificar el cobro</p>
          <input type="text" value={otpCode} onChange={(e) => { setOtpCode(e.target.value.toUpperCase()); setOtpResult(null); }} maxLength={4} placeholder="----" className="w-32 mx-auto px-4 py-4 text-2xl font-mono text-center rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none tracking-[0.5em]" />
          {otpResult && (
            <div className={`p-4 rounded-xl text-left ${otpResult.valid ? 'bg-lime-400/20 border border-lime-400/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <p className={`font-bold text-sm ${otpResult.valid ? 'text-[#3F5600]' : 'text-red-600'}`}>
                {otpResult.valid ? `✅ Pedido #${otpResult.order?.id} — $${otpResult.order?.amount}` : '❌ Código OTP no válido'}
              </p>
              {otpResult.valid && <p className="text-xs text-slate-500 mt-1">Destino: {otpResult.order?.destination}</p>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
