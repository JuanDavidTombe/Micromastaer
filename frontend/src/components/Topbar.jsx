import React from 'react';

export default function Topbar({ user, onMenuToggle }) {
  const roleLabel = user?.role_label || 'Usuario';

  return (
    <header className="bg-slate-900 text-white px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Menú"
        >
          <span className="text-lg">☰</span>
        </button>
        <div className="h-4 w-px bg-white/20 hidden md:block"></div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-white/50">MICROMASTER B2B</span>
          <span className="text-xs bg-lime-400 text-slate-900 px-2 py-0.5 rounded font-bold">LIVE</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5">
          <span className="text-xs text-white/50">🔍</span>
          <input type="text" placeholder="Buscar..." className="bg-transparent text-xs outline-none w-40 text-white placeholder:text-white/30" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-lime-400/20 text-lime-400 px-2 py-1 rounded-lg font-mono">
            {roleLabel}
          </span>
          <div className="w-8 h-8 bg-lime-400/30 rounded-full flex items-center justify-center text-xs font-bold">
            {user?.name?.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
