import React, { useState, useEffect } from 'react';
import { cost } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import Modal from '../components/Modal';
import { hasModuleAccess, can } from '../constants/roles';

export default function MicroCost({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', waste_percentage: 0 });
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [simQuantity, setSimQuantity] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [formError, setFormError] = useState('');

  const canAccess = hasModuleAccess(role, 'recipes_production');
  const canCreate = can(role, 'create');

  useEffect(() => {
    if (!canAccess) return;
    cost.getRecipes().then((res) => setRecipes(res.data.recipes)).catch(() => {});
    cost.getIngredients().then((res) => setIngredients(res.data.ingredients)).catch(() => {});
  }, [canAccess]);

  const handleCreateRecipe = async () => {
    if (!canCreate) return;
    setFormError('');
    if (!formData.name.trim()) { setFormError('Ingresa el nombre de la receta'); return; }
    if (selectedIngredients.length === 0) { setFormError('Selecciona al menos un insumo'); return; }
    if (selectedIngredients.some((i) => !i.quantity || i.quantity <= 0)) { setFormError('Define la cantidad de cada insumo'); return; }
    try {
      const res = await cost.createRecipe({
        name: formData.name,
        waste_percentage: parseFloat(formData.waste_percentage) || 0,
        ingredients: selectedIngredients.map((ing) => ({
          ingredient_id: ing.id,
          quantity: ing.quantity,
          unit_cost: ing.cost_per_unit,
        })),
      });
      setRecipes([...recipes, res.data.recipe]);
      setShowModal(false);
      setFormData({ name: '', waste_percentage: 0 });
      setSelectedIngredients([]);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Error al crear la receta');
    }
  };

  const handleSimulate = async () => {
    if (!selectedRecipe || !simQuantity) return;
    try {
      const res = await cost.simulateScale({
        recipe_id: selectedRecipe.id,
        quantity_kg: parseFloat(simQuantity),
      });
      setSimulation(res.data);
    } catch (e) {}
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Producción</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recetas & Producción</h1>
          <p className="text-sm text-slate-500">Recetas, costos, simulación y verificación automática de insumos</p>
        </div>
        <div className="flex gap-3 items-center">
          <TechBadge label="CONTROL OPERATIVO ALIMENTARIO" color="lime" />
          {canCreate && (
            <button
              onClick={() => { setShowModal(true); setFormData({ name: '', waste_percentage: 0 }); setSelectedIngredients([]); setFormError(''); }}
              className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            >
              + Nueva Receta
            </button>
          )}
        </div>
      </div>

      <div id="insumos" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Recetas Activas" value={recipes.length} subtitle="Definidas" icon="📋" color="lime" />
        <FreshCard title="Insumos Disponibles" value={ingredients.length} subtitle="Catalogados" icon="📦" color="terracotta" />
        <FreshCard
          title="Insumos Insuficientes"
          value={recipes.filter((r) => r.stock_check && !r.stock_check.sufficient).length}
          subtitle={`de ${recipes.length} recetas`}
          icon="⛔"
          color="terracotta"
        />
        <FreshCard title="Última Simulación" value={simulation ? `$${simulation.cost_per_kg}` : '—'} subtitle="Costo/kg" icon="🧮" color="lime" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
          <h2 id="recetas" className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Gestión de Recetas</h2>
          <div className="space-y-3">
            {recipes.map((recipe) => {
              const check = recipe.stock_check;
              const enough = check?.sufficient;
              return (
              <div
                key={recipe.id}
                onClick={() => { setSelectedRecipe(recipe); setSimQuantity(''); setSimulation(null); }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedRecipe?.id === recipe.id
                    ? 'bg-lime-400/10 border-lime-400/30'
                    : 'bg-white/60 border-slate-200 hover:border-lime-400/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{recipe.name}</p>
                    <p className="text-xs text-slate-500">Merma: {recipe.waste_percentage}%</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border font-semibold bg-lime-400/30 text-[#3F5600] border-lime-400/30 text-xs px-3 py-1">Activa</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{recipe.ingredients?.length || 0} ingredientes</p>

                {/* CHECK DE INSUMOS AUTOMÁTICO */}
                {check && (
                  <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 border ${
                    enough ? 'bg-lime-50 border-lime-300' : 'bg-red-50 border-red-300'
                  }`}>
                    <span className="text-sm leading-none mt-0.5">{enough ? '✅' : '⛔'}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${enough ? 'text-[#3F5600]' : 'text-[#A44B1F]'}`}>
                        {check.label}
                      </p>
                      {!enough && check.missing?.length > 0 && (
                        <ul className="text-[11px] text-red-700 mt-1 space-y-0.5">
                          {check.missing.map((m) => (
                            <li key={m.ingredient_id}>
                              • {m.name}: falta <b>{m.missing_quantity} {m.unit}</b> (hay {m.available})
                            </li>
                          ))}
                        </ul>
                      )}
                      {enough && (
                        <p className="text-[11px] text-[#4F6B00] mt-0.5">
                          {check.items?.length} insumos con stock suficiente en bodega
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );})}
          </div>
        </div>

        <div className="bg-white/80 rounded-3xl border border-slate-200 p-6">
          <h2 id="simulador" className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Simulador de Escala</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Receta Base</label>
              <select
                value={selectedRecipe?.id || ''}
                onChange={(e) => {
                  const r = recipes.find((x) => x.id === parseInt(e.target.value));
                  setSelectedRecipe(r);
                  setSimulation(null);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-lime-400 focus:border-lime-400 outline-none"
              >
                <option value="">Seleccionar receta...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cantidad Objetivo (kg)</label>
              <input
                type="number"
                value={simQuantity}
                onChange={(e) => { setSimQuantity(e.target.value); setSimulation(null); }}
                placeholder="Ej: 500"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-lime-400 focus:border-lime-400 outline-none"
              />
            </div>
            <button
              onClick={handleSimulate}
              disabled={!selectedRecipe || !simQuantity}
              className="w-full bg-lime-400 hover:bg-lime-500 disabled:opacity-40 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all"
            >
              SIMULAR ESCALA →
            </button>

            {simulation && (
              <div className="bg-slate-900 rounded-2xl p-5 text-white animate-slide-up">
                <h3 className="text-xs uppercase tracking-wider text-lime-400 mb-3">Resultado de Simulación</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-white/70">Costo Total:</span><p className="font-bold text-lime-400">${simulation.total_cost?.toLocaleString()}</p></div>
                  <div><span className="text-white/70">Costo/kg:</span><p className="font-bold text-lime-400">${simulation.cost_per_kg?.toLocaleString()}</p></div>
                  <div><span className="text-white/70">Merma:</span><p className="font-bold text-terracotta-400">${simulation.total_waste_cost?.toLocaleString()}</p></div>
                  <div><span className="text-white/70">Precio Venta:</span><p className="font-bold text-green-400">${simulation.selling_price?.toLocaleString()}</p></div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">Margen Estimado (30%):</span>
                    <span className="font-bold text-lime-400">${simulation.margin?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Receta"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleCreateRecipe} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Crear Receta</button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>
          )}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Nombre de Receta</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Base Arroz con Fríjoles" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Porcentaje de Merma (%)</label>
            <input type="number" value={formData.waste_percentage} onChange={(e) => setFormData({ ...formData, waste_percentage: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Insumos Asociados</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ingredients.map((ing) => {
                const existing = selectedIngredients.find((x) => x.id === ing.id);
                return (
                  <div key={ing.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-slate-200">
                    <input type="checkbox" checked={!!existing} onChange={(e) => {
                      if (e.target.checked) setSelectedIngredients([...selectedIngredients, { ...ing, quantity: 0 }]);
                      else setSelectedIngredients(selectedIngredients.filter((x) => x.id !== ing.id));
                    }} className="rounded" />
                    <span className="text-sm flex-1 text-slate-900">{ing.name}</span>
                    <span className="text-xs text-slate-500">${ing.cost_per_unit}/{ing.unit}</span>
                    {existing && <input type="number" value={existing.quantity} onChange={(e) => {
                      const q = parseFloat(e.target.value);
                      setSelectedIngredients(selectedIngredients.map((x) => x.id === ing.id ? { ...x, quantity: isNaN(q) ? 0 : q } : x));
                    }} placeholder="Cant" className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
