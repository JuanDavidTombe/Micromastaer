// ------------------------------------------------------------------
// MENÚ LATERAL POR ROL — MICROMASTER
// Espejo de navegación de la matriz RBAC (backend/app/Models/User.php).
//
//  - `modules` del rol determinan qué secciones aparecen.
//  - Cada ítem apunta a una ruta existente y, si la vista tiene
//    subsecciones, a un anclaje interno (#hash) de esa misma vista.
//  - Ninguna lógica de componentes: sólo datos de navegación.
// ------------------------------------------------------------------

export const SIDEBAR_MENU = {
  OPERARIO_LOGISTICO: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: '📊', label: 'Inicio · Resumen Bodega', desc: 'Alertas de stock y entregas del día', to: { pathname: '/stock' } },
      ],
    },
    {
      id: 'operacion',
      num: '02',
      label: 'OPERACIÓN & LOGÍSTICA',
      items: [
        { icon: '📦', label: 'Lotes FEFO', desc: 'Vencimiento, proveedor y cantidad', to: { pathname: '/stock', hash: '#lotes' } },
        { icon: '📥', label: 'Entradas de Proveedores', desc: 'Recepción de mercancía', to: { pathname: '/stock', hash: '#entradas' } },
        { icon: '⛶', label: 'Escáner QR', desc: 'Sincroniza el lote desde la app', to: { pathname: '/stock', hash: '#qr' } },
        { icon: '🚚', label: 'Gestión de Pedidos', desc: 'Órdenes B2B y estados', to: { pathname: '/orders' } },
        { icon: '🗺️', label: 'Rutas & Mapa GPS', desc: 'Trazado en vivo de conductores', to: { pathname: '/delivery' } },
        { icon: '💰', label: 'Cobros, Caja & OTP', desc: 'Verificación y registro de pago', to: { pathname: '/delivery', hash: '#cobro' } },
      ],
    },
    {
      id: 'campo',
      num: '03',
      label: 'CONTROL DE CAMPO',
      items: [
        { icon: '🛑', label: 'Novedades e Incidencias', desc: 'Alertas de conductores en ruta', to: { pathname: '/delivery', hash: '#incidencias' } },
        { icon: '📄', label: 'Reportes de Bodega', desc: 'Exportación de inventarios', to: { pathname: '/stock', hash: '#alertas' } },
      ],
    },
  ],

  SUPERVISOR_PRODUCCION: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: '📊', label: 'Inicio · Tablero de Cocina', desc: 'Tandas programadas para hoy', to: { pathname: '/cost' } },
      ],
    },
    {
      id: 'produccion',
      num: '02',
      label: 'PRODUCCIÓN & RECETAS',
      items: [
        { icon: '🍳', label: 'Catálogo de Recetas', desc: 'Fórmulas y mermas', to: { pathname: '/cost', hash: '#recetas' } },
        { icon: '🧮', label: 'Simulador de Escala', desc: 'Kg para producción masiva', to: { pathname: '/cost', hash: '#simulador' } },
        { icon: '🟢', label: 'Disponibilidad de Insumos', desc: 'Check automático de stock', to: { pathname: '/cost', hash: '#insumos' } },
      ],
    },
    {
      id: 'calidad',
      num: '03',
      label: 'CONTROL DE CALIDAD',
      items: [
        { icon: '🗑️', label: 'Registro de Mermas', desc: 'Mermas e imprevistos de cocina', to: { pathname: '/cost', hash: '#recetas' } },
      ],
    },
  ],

  CONTADOR: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: '📊', label: 'Inicio · Resumen Financiero', desc: 'Ingresos, costos y margen', to: { pathname: '/reports' } },
      ],
    },
    {
      id: 'auditoria',
      num: '02',
      label: 'AUDITORÍA & CONCILIACIÓN',
      items: [
        { icon: '📈', label: 'Reportes de Ventas B2B', desc: 'Ingresos y cobros confirmados', to: { pathname: '/reports', hash: '#ventas' } },
        { icon: '💵', label: 'Conciliación de Caja & OTP', desc: 'Verificación de dinero recaudado', to: { pathname: '/reports', hash: '#pedidos' } },
        { icon: '📦', label: 'Valoración de Inventario', desc: 'Costo total del stock en bodega', to: { pathname: '/reports', hash: '#inventario' } },
      ],
    },
    {
      id: 'exportacion',
      num: '03',
      label: 'EXPORTACIÓN',
      items: [
        { icon: '📥', label: 'Descarga de Informes', desc: 'Exportador masivo en CSV', to: { pathname: '/reports', hash: '#exportar' } },
      ],
    },
  ],

  ADMINISTRADOR: [
    {
      id: 'principal',
      num: '01',
      label: 'PRINCIPAL',
      items: [
        { icon: '📊', label: 'Inicio · Torre de Control', desc: 'KPIs y estado general', to: { pathname: '/' } },
      ],
    },
    {
      id: 'operacion',
      num: '02',
      label: 'OPERACIÓN',
      items: [
        { icon: '📦', label: 'Inventario & Stock', desc: 'Lotes FEFO, proveedor y QR', to: { pathname: '/stock' } },
        { icon: '⚙️', label: 'Recetas & Producción', desc: 'Fórmulas, costos y simulación', to: { pathname: '/cost' } },
        { icon: '☰', label: 'Pedidos & Entregas', desc: 'Órdenes B2B', to: { pathname: '/orders' } },
        { icon: '🗺️', label: 'Logística & Mapa GPS', desc: 'Rutas y novedades de campo', to: { pathname: '/delivery' } },
      ],
    },
    {
      id: 'analisis',
      num: '03',
      label: 'ANÁLISIS & SISTEMA',
      items: [
        { icon: '≫', label: 'Reportes & Simulaciones', desc: 'Exportación y conciliación', to: { pathname: '/reports' } },
      ],
    },
    {
      id: 'administracion',
      num: '05',
      label: 'ADMINISTRACIÓN',
      items: [
        { icon: '👥', label: 'Gestión de Usuarios & Roles', desc: 'Equipo y matriz de permisos', to: { pathname: '/settings', hash: '#usuarios' } },
        { icon: '⚙️', label: 'Configuración del Sistema', desc: 'Parámetros generales', to: { pathname: '/settings', hash: '#config' } },
      ],
    },
  ],

  TRANSPORTISTA: [
    {
      id: 'operacion',
      num: '01',
      label: 'MI OPERACIÓN',
      items: [
        { icon: '🚚', label: 'Mis Pedidos', desc: 'Órdenes asignadas a mi ruta', to: { pathname: '/orders' } },
        { icon: '🗺️', label: 'Mi Ruta & Mapa GPS', desc: 'Trazado y posición en vivo', to: { pathname: '/delivery' } },
        { icon: '🛑', label: 'Reportar Novedad', desc: 'Incidencias de campo', to: { pathname: '/delivery', hash: '#incidencias' } },
        { icon: '💰', label: 'Cobro OTP', desc: 'Verificación de pago en ruta', to: { pathname: '/delivery', hash: '#cobro' } },
      ],
    },
  ],
};
