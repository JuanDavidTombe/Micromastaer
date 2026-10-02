import React, { useState, useEffect } from 'react';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import DynamicTable from '../components/DynamicTable';
import { hasModuleAccess, can } from '../constants/roles';
import { reports, orders as ordersApi } from '../services/api';

const DOWNLOAD_TYPES = [
  { type: 'stock', label: 'Inventario' },
  { type: 'costs', label: 'Costos' },
  { type: 'orders', label: 'Pedidos' },
];

export default function Reports({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const canAccess = hasModuleAccess(role, 'reports_simulations');
  const canDownload = can(role, 'download');
  const canCreate = can(role, 'create');
  const canUpdate = can(role, 'update');
  const canDelete = can(role, 'delete');

  const [costs, setCosts] = useState([]);
  const [stock, setStock] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    if (!canAccess) return;
    reports.costs().then((res) => setCosts(res.data.costs)).catch((e) => setError(e.response?.data?.message || ''));
    reports.stock().then((res) => setStock(res.data.stock)).catch(() => {});
    reports.orders().then((res) => setOrders(res.data.orders)).catch(() => {});
  }, [canAccess]);

  const handleDownload = async (type) => {
    if (!canDownload) return;
    setDownloading(type);
    setError('');
    try {
      const res = await reports.download(type);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `micromaster_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('No se pudo generar la descarga');
    } finally {
      setDownloading('');
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Reportes & Simulaciones</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const totalCost = costs.reduce((s, c) => s + Number(c.total_cost || 0), 0);
  const insufficient = costs.filter((c) => c.stock_status === 'insufficient').length;
  const totalStock = stock.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const pending = orders.filter((o) => o.payment_status === 'pending');
  const completed = orders.filter((o) => o.payment_status === 'completed');
  const revenue = completed.reduce((s, o) => s + Number(o.amount || 0), 0);

  const costColumns = [
    { key: 'name', label: 'Receta' },
    { key: 'waste_percentage', label: '% Merma' },
    { key: 'total_cost', label: 'Costo Total' },
    { key: 'ingredients_count', label: 'Insumos' },
    { key: 'stock_status', label: 'Estado Insumos' },
  ];

  const stockColumns = [
    { key: 'batch_code', label: 'Lote' },
    { key: 'ingredient', label: 'Insumo' },
    { key: 'supplier_name', label: 'Proveedor' },
    { key: 'quantity', label: 'Actual' },
    { key: 'initial_quantity', label: 'Inicial' },
    { key: 'expiration_date', label: 'Vencimiento' },
    { key: 'status', label: 'Estado' },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes & Simulaciones</h1>
          <p className="text-sm text-slate-500">Lectura y descarga de inventario, costos y pedidos</p>
        </div>
        <div className="flex gap-3 items-center">
          <TechBadge label={canCreate ? 'INFORMES FINANCIEROS' : 'SOLO LECTURA & DESCARGA'} color={canCreate ? 'lime' : 'slate'} />
          {canDownload && (
            <button onClick={() => handleDownload('stock')} className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all">
              {downloading ? 'Generando…' : '📥 Descargar CSV'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

      <div id="ventas" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Recetas" value={costs.length} subtitle={`${insufficient} con insumos insuficientes`} icon="📋" color="lime" />
        <FreshCard title="Costo Total Recetas" value={`$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} subtitle="Catálogo" icon="💵" color="lime" />
        <FreshCard title="Stock Total" value={`${totalStock.toLocaleString()}`} subtitle={`${stock.length} lotes`} icon="📦" color="terracotta" />
        <FreshCard title="Ventas" value={`$${revenue.toLocaleString()}`} subtitle={`${pending.length} pendientes`} icon="📊" color="lime" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div id="exportar" className="bg-white/80 rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Costos por Receta</h2>
            {canDownload && (
              <button onClick={() => handleDownload('costs')} className="text-xs font-bold text-[#4F6B00] hover:underline">
                {downloading === 'costs' ? '…' : 'CSV'}
              </button>
            )}
          </div>
          <DynamicTable columns={costColumns} data={costs} renderRow={(row) => (
            <>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.name}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.waste_percentage}%</td>
              <td className="px-4 py-3 text-sm text-slate-900">${Number(row.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.ingredients_count}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  row.stock_status === 'sufficient'
                    ? 'bg-lime-50 border-lime-300 text-[#3F5600]'
                    : 'bg-red-50 border-red-300 text-[#A44B1F]'
                }`}>
                  {row.stock_status === 'sufficient' ? 'Suficientes' : 'Insuficientes'}
                </span>
              </td>
            </>
          )} />
        </div>

        <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="inventario" className="text-sm uppercase tracking-[0.2em] text-slate-500">Inventario (Trazabilidad)</h2>
            {canDownload && (
              <button onClick={() => handleDownload('stock')} className="text-xs font-bold text-[#4F6B00] hover:underline">
                {downloading === 'stock' ? '…' : 'CSV'}
              </button>
            )}
          </div>
          <DynamicTable columns={stockColumns} data={stock} renderRow={(row) => (
            <>
              <td className="px-4 py-3 text-sm font-mono text-slate-900">{row.batch_code}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.ingredient}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.supplier_name || '—'}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-900">{Number(row.quantity).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{Number(row.initial_quantity).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.expiration_date}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  row.status === 'optimal' ? 'bg-lime-50 border-lime-300 text-[#3F5600]'
                    : row.status === 'warning' ? 'bg-orange-50 border-orange-300 text-[#A44B1F]'
                    : 'bg-red-50 border-red-300 text-[#A44B1F]'
                }`}>{row.status}</span>
              </td>
            </>
          )} />
        </div>
      </div>

      <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="pedidos" className="text-sm uppercase tracking-[0.2em] text-slate-500">Pedidos</h2>
          {canDownload && (
            <button onClick={() => handleDownload('orders')} className="text-xs font-bold text-[#4F6B00] hover:underline">
              {downloading === 'orders' ? '…' : 'CSV'}
            </button>
          )}
        </div>
        <DynamicTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'client_name', label: 'Cliente' },
            { key: 'amount', label: 'Monto' },
            { key: 'payment_status', label: 'Pago' },
            { key: 'status', label: 'Estado' },
            { key: 'created_at', label: 'Creado' },
          ]}
          data={orders}
          renderRow={(row) => (
            <>
              <td className="px-4 py-3 text-sm font-mono text-slate-500">{row.id}</td>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.client_name}</td>
              <td className="px-4 py-3 text-sm text-slate-900">${Number(row.amount).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.payment_status}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.status}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{String(row.created_at).slice(0, 10)}</td>
            </>
          )}
        />
      </div>

      {/* Permisos del rol: el CONTADOR ve ❌ en toda escritura */}
      <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
        <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Permisos del Rol Actual</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { perm: 'Crear', allowed: canCreate },
            { perm: 'Leer', allowed: can(role, 'read') },
            { perm: 'Actualizar', allowed: canUpdate },
            { perm: 'Eliminar', allowed: canDelete },
            { perm: 'Descargar', allowed: canDownload },
          ].map((item) => (
            <div key={item.perm} className={`p-3 rounded-xl text-center border ${item.allowed ? 'bg-lime-400/10 border-lime-400/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <span className={`text-lg ${item.allowed ? 'text-[#4F6B00]' : 'text-red-500'}`}>{item.allowed ? '✅' : '❌'}</span>
              <p className={`text-xs mt-1 ${item.allowed ? 'text-[#4F6B00]' : 'text-red-500'}`}>{item.perm}</p>
            </div>
          ))}
        </div>
        {!canCreate && (
          <p className="text-xs text-center text-slate-500 mt-4">
            Tu rol tiene acceso de <b>solo lectura y descarga</b>. Cualquier intento de escritura (POST/PUT/DELETE) responde 403 Forbidden.
          </p>
        )}
      </div>
    </div>
  );
}
