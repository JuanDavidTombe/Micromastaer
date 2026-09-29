import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ModuleTabs({ tabs }) {
  const navigate = useNavigate();
  const currentPath = useLocation().pathname;

  return (
    <div className="inline-flex p-1 rounded-xl bg-white/70 border border-slate-200">
      {tabs.map((tab) => {
        const active = currentPath === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              active
                ? 'bg-slate-900 text-white shadow'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
