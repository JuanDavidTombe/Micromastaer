import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboard } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import { hasModuleAccess } from '../constants/roles';

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const role = user?.role || 'ADMINISTRADOR';

  const canViewDashboard = true;

  useEffect(() => {
    dashboard.getKpis().then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-3 border-lime-400/30 border-t-lime-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const fefoMatrix = data?.fefo_matrix || [];
  const alerts = data?.alerts || {};

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div id="resumen" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inicio · Torre de Control</h1>
          <p className="text-sm text-slate-500">Bienvenido, {user?.name}</p>
        </div>
        <TechBadge label="SISTEMA OPERATIVO" color="lime" />
      </div>

      {hasModuleAccess(role, 'inventory_stock') && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FreshCard title="Inventario Total" value={`${kpis.total_inventory_kg || 0} kg`} subtitle={`Valor: $${(kpis.total_inventory_value || 0).toLocaleString()}`} icon="📦" color="lime" />
            <FreshCard title="Lotes Óptimos" value={kpis.optimal_batches || 0} subtitle="Disponibles" icon="✅" color="lime" />
            <FreshCard title="Alertas Críticas" value={kpis.critical_batches || 0} subtitle="Requieren atención" icon="⚠️" color="terracotta" />
            <FreshCard title="Órdenes Completadas" value={kpis.completed_orders || 0} subtitle={`Pendientes: ${kpis.pending_orders || 0}`} icon="🚚" color="lime" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white/80 rounded-3xl border border-slate-200 p-6">
              <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Matriz FEFO - Estado de Lotes</h2>
              <div className="space-y-3">
                {fefoMatrix.map((item) => (
                  <div key={item.type} className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${item.color}`}></span>
                      <span className="text-sm font-medium text-slate-900">{item.type}</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
              <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">KPIs Financieros</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Ingresos Totales</span>
                  <span className="text-lg font-bold text-slate-900">${(kpis.total_revenue || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Cobrado</span>
                  <span className="text-lg font-bold text-[#4F6B00]">${(kpis.total_collected || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Mermas</span>
                  <span className="text-lg font-bold text-[#C4622F]">{kpis.total_waste_kg || 0} kg</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {hasModuleAccess(role, 'orders_delivery') && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Resumen de Entregas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Entregas en Proceso</span>
              <p className="text-2xl font-bold text-[#C4622F]">{kpis.completed_orders || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Pendientes de Pago</span>
              <p className="text-2xl font-bold text-slate-900">{kpis.pending_orders || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Rutas Activas</span>
              <p className="text-2xl font-bold text-[#4F6B00]">3</p>
            </div>
          </div>
        </div>
      )}

      {hasModuleAccess(role, 'reports_simulations') && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">🔴 Lotes con Alerta de Expiración</h2>
          </div>
          {alerts.expiring_this_week && alerts.expiring_this_week.length > 0 ? (
            <div className="space-y-2">
              {alerts.expiring_this_week.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${batch.status === 'critical' ? 'bg-red-500' : 'bg-terracotta-400'}`}></span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{batch.batch_code}</p>
                      <p className="text-[11px] text-slate-500">{batch.ingredient?.name || 'Insumo'} - Expira: {batch.expiration_date}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 ${batch.status === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-terracotta-400/20 text-[#C4622F]'} px-2.5 py-1 rounded-full text-xs font-semibold`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${batch.status === 'critical' ? 'bg-red-500' : 'bg-terracotta-400'}`}></span>
                    {batch.status === 'critical' ? 'Crítico' : 'Próximo a vencer'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No hay alertas de expiración</p>
          )}
        </div>
      )}
    </div>
  );
}
