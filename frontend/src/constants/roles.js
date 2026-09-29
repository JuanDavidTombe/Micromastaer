const ROLE_PERMISSIONS = {
  ADMINISTRADOR: {
    modules: ['dashboard', 'inventory_stock', 'recipes_production', 'orders_delivery', 'reports_simulations', 'administration'],
    read_modules: [],
    can: ['create', 'read', 'update', 'delete', 'download'],
  },
  OPERARIO_LOGISTICO: {
    modules: ['inventory_stock', 'orders_delivery'],
    read_modules: [],
    can: ['create', 'read', 'update', 'delete'],
  },
  SUPERVISOR_PRODUCCION: {
    modules: ['recipes_production'],
    read_modules: ['inventory_stock'],
    can: ['create', 'read', 'update', 'delete'],
  },
  CONTADOR: {
    modules: ['reports_simulations'],
    read_modules: [],
    can: ['read', 'download'],
  },
  TRANSPORTISTA: {
    modules: ['orders_delivery'],
    read_modules: [],
    can: ['create', 'read', 'update'],
  },
};

const ROLE_LABELS = {
  ADMINISTRADOR: 'Administrador',
  OPERARIO_LOGISTICO: 'Operario Logístico',
  SUPERVISOR_PRODUCCION: 'Supervisor Producción',
  CONTADOR: 'Contador',
  TRANSPORTISTA: 'Transportista',
};

// Módulos que tienen entrada visible en el sidebar.
// INICIO sólo se muestra al ADMINISTRADOR.
export const NAV_ITEMS = [
  { id: '01', label: 'INICIO', icon: '⊙', path: '/', module: 'dashboard', section: 'principal', description: 'KPIs y estado general' },
  { id: '02', label: 'INVENTARIO & STOCK', icon: '▤', path: '/stock', module: 'inventory_stock', section: 'operacion', description: 'Lotes FEFO, proveedor y QR' },
  { id: '03', label: 'RECETAS & PRODUCCIÓN', icon: '⚙', path: '/cost', module: 'recipes_production', section: 'operacion', description: 'Recetas, costos y simulación' },
  { id: '04', label: 'PEDIDOS & ENTREGAS', icon: '☰', path: '/orders', altPaths: ['/delivery'], module: 'orders_delivery', section: 'operacion', description: 'Órdenes, rutas y cobro OTP' },
  { id: '05', label: 'REPORTES & SIMULACIONES', icon: '≫', path: '/reports', module: 'reports_simulations', section: 'analisis', description: 'Exportación y conciliación' },
  { id: '06', label: 'ADMINISTRACIÓN', icon: '◉', path: '/settings', module: 'administration', section: 'analisis', description: 'Sistema y equipo' },
];

function permsFor(role) {
  return ROLE_PERMISSIONS[role] || { modules: [], read_modules: [], can: [] };
}

/** Módulos con acceso COMPLETO (lectura + escritura) para el rol. */
export function getModules(role) {
  return permsFor(role).modules;
}

/** Módulos de SOLO LECTURA (p.ej. supervisor mirando bodega). */
export function getReadModules(role) {
  return permsFor(role).read_modules;
}

/**
 * Entradas visibles en el sidebar.
 * Sólo se listan los módulos del rol: 2 para operario, 1 para
 * supervisor, 1 para contador, todos para administrador.
 */
export function getVisibleNavItems(role) {
  const allowed = permsFor(role).modules;
  return NAV_ITEMS.filter(item => allowed.includes(item.module));
}

/**
 * Ruta por defecto tras iniciar sesión.
 * INICIO es exclusivo del administrador; el resto cae en su módulo.
 */
export function getDefaultRoute(role) {
  const moduleMap = {
    OPERARIO_LOGISTICO: '/orders',
    SUPERVISOR_PRODUCCION: '/cost',
    CONTADOR: '/reports',
    ADMINISTRADOR: '/',
    TRANSPORTISTA: '/delivery',
  };
  return moduleMap[role] || '/orders';
}

/** Acceso completo a un módulo (para mostrar acciones de escritura). */
export function hasModuleAccess(role, module) {
  return permsFor(role).modules.includes(module);
}

/** Acceso de solo lectura: completo O de consulta (read_modules). */
export function hasReadAccess(role, module) {
  const p = permsFor(role);
  return p.modules.includes(module) || p.read_modules.includes(module);
}

/**
 * Acción global sobre un módulo (create/read/update/delete/download).
 * El CONTADOR sólo tiene read + download: toda escritura queda fuera.
 */
export function can(role, action) {
  return permsFor(role).can.includes(action);
}

export function hasPermission(role, permission) {
  return can(role, permission);
}

export { ROLE_PERMISSIONS, ROLE_LABELS };
