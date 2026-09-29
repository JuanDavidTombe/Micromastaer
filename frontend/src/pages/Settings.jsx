import React from 'react';
import { hasModuleAccess } from '../constants/roles';

export default function Settings({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const canAccess = hasModuleAccess(role, 'administration');

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Configuración</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const developers = [
    { name: 'Juan David Tombe', role: 'Lead Architect & Backend Developer', email: 'juan.tombe@micromaster.com', initials: 'JT', color: 'lime', description: 'Arquitectura del sistema y lógica de negocio' },
    { name: 'Maria Camila Palehor', role: 'Full-Stack Developer', email: 'camila.palehor@micromaster.com', initials: 'MP', color: 'terracotta', description: 'APIs RESTful y conectividad frontend' },
    { name: 'Kevin Jesus Millan', role: 'Frontend Developer', email: 'kevin.millen@micromaster.com', initials: 'KM', color: 'lime', description: 'Interfaz de usuario y experiencia' },
    { name: 'Deiby Anderson Vitonco', role: 'DevOps & QA Engineer', email: 'deiby.vitonco@micromaster.com', initials: 'DV', color: 'terracotta', description: 'Despliegue, testing y monitoreo' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración & Equipo</h1>
          <p className="text-sm text-slate-500">Configuración del sistema y equipo fundador</p>
        </div>
        <span className="bg-lime-400/30 text-[#3F5600] px-3 py-1 rounded-full text-xs font-bold border border-lime-400/30">ADMINISTRADOR</span>
      </div>

      <div id="usuarios" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {developers.map((dev) => (
          <div key={dev.name} className="bg-white/80 rounded-3xl border border-slate-200 p-6 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold" style={{ backgroundColor: dev.color === 'lime' ? 'rgba(204,255,0,0.12)' : 'rgba(240,145,99,0.12)', color: dev.color === 'lime' ? '#5a7d00' : '#c4622f' }}>
                {dev.initials}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{dev.name}</h3>
                <p className="text-xs text-slate-500">{dev.role}</p>
                <p className="text-xs text-slate-400">{dev.description}</p>
              </div>
              <span className="bg-lime-400/30 text-[#3F5600] px-2 py-1 rounded-full text-[10px] font-bold border border-lime-400/30">ACTIVO</span>
            </div>
          </div>
        ))}
      </div>

      <div id="config" className="bg-white/80 rounded-3xl border border-slate-200 p-6">
        <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Configuración del Sistema</h2>
        <div className="space-y-4">
          {[
            { label: 'Nombre de la Empresa', value: 'MICROMASTER B2B' },
            { label: 'Versión del Sistema', value: '2.4.1' },
            { label: 'Ambiente', value: 'Producción' },
            { label: 'Base de Datos', value: 'PostgreSQL 15' },
            { label: 'Backend Framework', value: 'Laravel 10' },
            { label: 'Frontend Framework', value: 'React + Vite + Tailwind CSS' },
            { label: 'Autenticación', value: 'Laravel Sanctum' },
          ].map((config) => (
            <div key={config.label} className="flex items-center justify-between p-4 rounded-xl bg-cream">
              <span className="text-xs uppercase tracking-wider text-slate-500">{config.label}</span>
              <span className="text-sm font-bold text-slate-900">{config.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
