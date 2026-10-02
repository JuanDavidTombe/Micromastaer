import React, { useState, useEffect } from 'react';
import { stock } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DynamicTable from '../components/DynamicTable';
import { hasModuleAccess, hasReadAccess, can } from '../constants/roles';

const EMPTY_FORM = {
  ingredient_id: '', batch_code: '', supplier_name: '', quantity: '',
  expiration_date: '', received_at: '',
};

const EMPTY_QR = {
  qr_code_hash: '', batch_code: '', ingredient_id: '', supplier_name: '',
  quantity: '', expiration_date: '',
};

export default function MicroStock({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [qrData, setQrData] = useState(EMPTY_QR);
  const [qrResult, setQrResult] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const canView = hasReadAccess(role, 'inventory_stock');
  const canWrite = hasModuleAccess(role, 'inventory_stock') && can(role, 'create');

  useEffect(() => {
    if (!canView) return;
    fetchBatches();
    stock.getIngredientStock().then((res) => setIngredients(res.data.ingredients)).catch(() => {});
    stock.getAlerts().then((res) => setAlerts(res.data)).catch(() => {});
  }, [filterStatus, search, canView]);

  const fetchBatches = () => {
    stock.getBatches({
      status: filterStatus === 'all' ? undefined : filterStatus,
      search: search || undefined,
    })
      .then((res) => {
        setBatches(res.data.batches);
        setSummary(res.data.summary);
      })
      .catch(() => {});
  };

  const handleCreateBatch = async () => {
    if (!canWrite) return;
    try {
      await stock.createBatch(formData);
      setShowModal(false);
      setFormData(EMPTY_FORM);
      fetchBatches();
    } catch (e) {}
  };

  // Escaneo QR: registra lote + refresca inventario y alertas con la respuesta 201
  const handleQrScan = async () => {
    if (!canWrite) return;
    setQrResult(null);
    try {
      const res = await stock.qrScan(qrData);
      setQrResult({ ok: true, data: res.data });
      setQrData(EMPTY_QR);
      fetchBatches();
      stock.getAlerts().then((r) => setAlerts(r.data)).catch(() => {});
    } catch (e) {
      setQrResult({
        ok: false,
        status: e.response?.status,
        message: e.response?.data?.message || 'No se pudo sincronizar el QR',
        batch: e.response?.data?.batch,
      });
    }
  };

  const columns = [
    { key: 'batch_code', label: 'Código Lote' },
    { key: 'ingredient_name', label: 'Insumo' },
    { key: 'supplier_name', label: 'Proveedor / Origen' },
    { key: 'qr_code_hash', label: 'QR' },
    { key: 'quantity', label: 'Actual' },
    { key: 'initial_quantity', label: 'Inicial' },
    { key: 'received_at', label: 'Entrada' },
    { key: 'expiration_date', label: 'Vencimiento' },
    { key: 'status', label: 'Estado' },
  ];

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Inventario & Stock</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const readOnly = !canWrite;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventario & Stock</h1>
          <p className="text-sm text-slate-500">Trazabilidad de lotes FEFO: proveedor, QR, cantidad inicial y vencimiento</p>
        </div>
        <div className="flex gap-3 items-center">
          <TechBadge label={readOnly ? 'SOLO LECTURA' : 'CONTROL DE STOCK BODEGA'} color={readOnly ? 'slate' : 'lime'} />
          {canWrite && (
            <>
              <button id="qr" onClick={() => setShowQrModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                ⛶ Escanear QR
              </button>
              <button id="entradas" onClick={() => setShowModal(true)} className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                + Nuevo Lote
              </button>
            </>
          )}
        </div>
      </div>

      <div id="alertas" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Lotes Óptimos" value={summary?.optimal ?? alerts?.optimal_count ?? 0} subtitle="Disponibles" icon="✅" color="lime" />
        <FreshCard title="Próximos a Vencer" value={summary?.warning ?? alerts?.warning_count ?? 0} subtitle="≤ 7 días" icon="⚠️" color="terracotta" />
        <FreshCard title="Críticos" value={summary?.critical ?? alerts?.critical_count ?? 0} subtitle="Expirados" icon="🔴" color="slate" />
        <FreshCard title="Proveedores" value={summary?.suppliers ?? 0} subtitle={`${summary?.total ?? batches.length} lotes`} icon="🏭" color="lime" />
      </div>

      <div id="lotes" className="flex flex-wrap gap-3 items-center">
        {['all', 'optimal', 'warning', 'critical'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            filterStatus === s ? 'bg-lime-400 text-slate-900' : 'bg-white/60 text-slate-600 hover:bg-white/80'
          }`}>
            {s === 'all' ? 'Todos' : s === 'optimal' ? 'Óptimo' : s === 'warning' ? 'Advertencia' : 'Crítico'}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar lote, QR o proveedor..."
          className="ml-auto px-4 py-2 rounded-xl text-sm border border-slate-200 bg-white w-64 focus:ring-2 focus:ring-lime-400 outline-none"
        />
      </div>

      <DynamicTable columns={columns} data={batches} renderRow={(batch) => (
        <>
          <td className="px-4 py-3 text-sm font-mono text-slate-900">{batch.batch_code}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{batch.ingredient?.name}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{batch.supplier_name || <span className="text-slate-400">—</span>}</td>
          <td className="px-4 py-3 text-xs font-mono text-slate-500">{batch.qr_code_hash || <span className="text-slate-400">—</span>}</td>
          <td className="px-4 py-3 text-sm font-semibold text-slate-900">{Number(batch.quantity).toLocaleString()}</td>
          <td className="px-4 py-3 text-sm text-slate-500">{Number(batch.initial_quantity ?? batch.quantity).toLocaleString()}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{batch.received_at ? String(batch.received_at).slice(0, 10) : '—'}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{String(batch.expiration_date).slice(0, 10)}</td>
          <td className="px-4 py-3"><StatusBadge status={batch.status} /></td>
        </>
      )} />

      {/* ---------- Modal: recepción manual ---------- */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Registrar Nuevo Lote"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleCreateBatch} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Registrar Lote</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Insumo</label>
            <select value={formData.ingredient_id} onChange={(e) => setFormData({ ...formData, ingredient_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
              <option value="">Seleccionar...</option>
              {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Código de Lote</label>
              <input type="text" value={formData.batch_code} onChange={(e) => setFormData({ ...formData, batch_code: e.target.value })} placeholder="Ej: BCH-ARR-20250101" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Proveedor / Origen</label>
              <input type="text" value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} placeholder="Ej: Arroz del Valle S.A." className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cantidad Inicial</label>
              <input type="number" step="0.0001" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Fecha Recepción</label>
              <input type="date" value={formData.received_at} onChange={(e) => setFormData({ ...formData, received_at: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Fecha Expiración</label>
            <input type="date" value={formData.expiration_date} onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
        </div>
      </Modal>

      {/* ---------- Modal: escaneo QR ---------- */}
      <Modal isOpen={showQrModal} onClose={() => { setShowQrModal(false); setQrResult(null); }} title="Sincronizar Escaneo QR"
        footer={
          <>
            <button onClick={() => { setShowQrModal(false); setQrResult(null); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cerrar</button>
            <button onClick={handleQrScan} className="px-4 py-2 rounded-xl text-sm bg-slate-900 text-white font-bold hover:bg-slate-800">Sincronizar</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Simula el envío del código escaneado por la app móvil a <code className="font-mono bg-slate-100 px-1 rounded">POST /api/stock/qr-scan</code>.</p>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Hash del QR</label>
            <input type="text" value={qrData.qr_code_hash} onChange={(e) => setQrData({ ...qrData, qr_code_hash: e.target.value })} placeholder="Ej: QR-ARR-NEW-7788" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Insumo</label>
              <select value={qrData.ingredient_id} onChange={(e) => setQrData({ ...qrData, ingredient_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
                <option value="">Seleccionar...</option>
                {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Código Lote</label>
              <input type="text" value={qrData.batch_code} onChange={(e) => setQrData({ ...qrData, batch_code: e.target.value })} placeholder="BCH-..." className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Proveedor / Origen</label>
            <input type="text" value={qrData.supplier_name} onChange={(e) => setQrData({ ...qrData, supplier_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cantidad</label>
              <input type="number" step="0.0001" value={qrData.quantity} onChange={(e) => setQrData({ ...qrData, quantity: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Vencimiento</label>
              <input type="date" value={qrData.expiration_date} onChange={(e) => setQrData({ ...qrData, expiration_date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
          </div>

          {qrResult && (
            <div className={`rounded-xl px-4 py-3 text-sm ${qrResult.ok ? 'bg-lime-50 border border-lime-300 text-lime-900' : 'bg-red-50 border border-red-300 text-red-700'}`}>
              <p className="font-bold">
                {qrResult.ok ? `201 · Lote ${qrResult.data.batch.batch_code} registrado` : `${qrResult.status} · ${qrResult.message}`}
              </p>
              {qrResult.ok && (
                <p className="text-xs mt-1">Inventario y alertas actualizados: {qrResult.data.summary.total} lotes, {qrResult.data.summary.suppliers} proveedores.</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
