<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    const ROLE_ADMINISTRADOR = 'ADMINISTRADOR';
    const ROLE_OPERARIO_LOGISTICO = 'OPERARIO_LOGISTICO';
    const ROLE_SUPERVISOR_PRODUCCION = 'SUPERVISOR_PRODUCCION';
    const ROLE_CONTADOR = 'CONTADOR';
    const ROLE_TRANSPORTISTA = 'TRANSPORTISTA';

    /**
     * MATRIZ RBAC OFICIAL MICROMASTER
     *
     *  Rol                 | Inventario & Stock | Recetas & Producción | Pedidos & Entregas | Reportes & Sim | Administración
     *  --------------------|--------------------|----------------------|--------------------|----------------|---------------
     *  ADMINISTRADOR       | Completo           | Completo             | Completo           | Completo       | Completo
     *  OPERARIO_LOGISTICO  | Completo           | Sin acceso           | Completo           | Sin acceso     | Sin acceso
     *  SUPERVISOR_PRODUCC. | Solo consulta      | Completo             | Sin acceso         | Sin acceso     | Sin acceso
     *  CONTADOR            | Sin acceso         | Sin acceso           | Sin acceso         | Solo lectura   | Sin acceso
     *  TRANSPORTISTA       | Sin acceso         | Sin acceso           | Lectura + cobro    | Sin acceso     | Sin acceso
     *
     *  - 'modules'     => módulos con acceso COMPLETO (son los visibles en el Sidebar).
     *  - 'read_modules'=> módulos con acceso de SOLO LECTURA a la API (no se muestran en el Sidebar).
     *  - 'can'         => acciones globales permitidas. El CONTADOR solo tiene 'read' y 'download',
     *                     por lo que cualquier POST/PUT/DELETE responde 403 (ver WriteGuardMiddleware).
     *
     *  TRANSPORTISTA (conductor): usa la app móvil para enviar GPS y reportar incidencias,
     *  por eso tiene 'create' y 'update' pero NO 'delete' ni 'download'. No puede crear
     *  rutas ni resolver incidencias: esos endpoints están detrás de
     *  RoleMiddleware(ADMINISTRADOR,OPERARIO_LOGISTICO).
     */
    public const ROLE_PERMISSIONS = [
        self::ROLE_ADMINISTRADOR => [
            'modules' => [
                'dashboard',
                'inventory_stock',
                'recipes_production',
                'orders_delivery',
                'reports_simulations',
                'administration',
            ],
            'read_modules' => [],
            'can' => ['create', 'read', 'update', 'delete', 'download'],
        ],
        self::ROLE_OPERARIO_LOGISTICO => [
            'modules' => ['inventory_stock', 'orders_delivery'],
            'read_modules' => [],
            'can' => ['create', 'read', 'update', 'delete'],
        ],
        self::ROLE_SUPERVISOR_PRODUCCION => [
            'modules' => ['recipes_production'],
            'read_modules' => ['inventory_stock'],
            'can' => ['create', 'read', 'update', 'delete'],
        ],
        self::ROLE_CONTADOR => [
            'modules' => ['reports_simulations'],
            'read_modules' => [],
            'can' => ['read', 'download'],
        ],
        self::ROLE_TRANSPORTISTA => [
            'modules' => ['orders_delivery'],
            'read_modules' => [],
            'can' => ['create', 'read', 'update'],
        ],
    ];

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'vehicle',
        'photo_url',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    protected $appends = ['role_label', 'role_permissions'];

    public function getRoleLabelAttribute(): string
    {
        return match ($this->role) {
            self::ROLE_ADMINISTRADOR => 'Administrador',
            self::ROLE_OPERARIO_LOGISTICO => 'Operario Logístico',
            self::ROLE_SUPERVISOR_PRODUCCION => 'Supervisor de Producción',
            self::ROLE_CONTADOR => 'Contador',
            self::ROLE_TRANSPORTISTA => 'Transportista',
            default => ucfirst($this->role),
        };
    }

    public function getRolePermissionsAttribute(): array
    {
        return self::ROLE_PERMISSIONS[$this->role] ?? ['modules' => [], 'can' => []];
    }

    public function hasModuleAccess(string $module): bool
    {
        return in_array($module, $this->role_permissions['modules'] ?? []);
    }

    /**
     * Acceso de SOLO LECTURA: true si el rol tiene el módulo completo o sólo de consulta.
     * Usado por los endpoints GET de Inventario para que SUPERVISOR_PRODUCCION
     * pueda verificar disponibilidad sin tener el módulo completo.
     */
    public function hasReadModuleAccess(string $module): bool
    {
        $perms = $this->role_permissions;

        return in_array($module, $perms['modules'] ?? [])
            || in_array($module, $perms['read_modules'] ?? []);
    }

    /**
     * Acceso de ESCRITURA: requiere el módulo COMPLETO más la acción respectiva.
     */
    public function canWriteOn(string $module, string $action): bool
    {
        return $this->hasModuleAccess($module) && $this->hasPermission($action);
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->role_permissions['can'] ?? []);
    }

    public function canCreate(): bool { return $this->hasPermission('create'); }
    public function canRead(): bool { return $this->hasPermission('read'); }
    public function canUpdate(): bool { return $this->hasPermission('update'); }
    public function canDelete(): bool { return $this->hasPermission('delete'); }
    public function canDownload(): bool { return $this->hasPermission('download'); }

    public function isAdmin(): bool { return $this->role === self::ROLE_ADMINISTRADOR; }
    public function isLogisticOperator(): bool { return $this->role === self::ROLE_OPERARIO_LOGISTICO; }
    public function isProductionSupervisor(): bool { return $this->role === self::ROLE_SUPERVISOR_PRODUCCION; }
    public function isAccountant(): bool { return $this->role === self::ROLE_CONTADOR; }
    public function isTransportista(): bool { return $this->role === self::ROLE_TRANSPORTISTA; }

    /**
     * Ficha ligera para el panel de Logística:
     * foto, nombre, teléfono, vehículo y última posición GPS conocida.
     */
    public function toDriverArray(): array
    {
        $location = $this->driverLocation;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'phone' => $this->phone,
            'vehicle' => $this->vehicle,
            'photo_url' => $this->photo_url,
            'last_location' => $location ? [
                'latitude' => (float) $location->latitude,
                'longitude' => (float) $location->longitude,
                'recorded_at' => $location->recorded_at->toIso8601String(),
                'age_seconds' => $location->recorded_at->diffInSeconds(now()),
            ] : null,
            'tracking' => $this->trackingArray(),
        ];
    }

    /**
     * Estado del seguimiento del conductor para el panel de Logística.
     *
     *  - GPS real transmitido por la app (<= 120 s) -> online / real
     *  - sin GPS fresco pero con ruta activa       -> online / simulado
     *  - sin ruta activa                           -> offline
     */
    public function trackingArray(): array
    {
        $location = $this->driverLocation;
        $age = $location ? $location->ageSeconds() : null;

        if ($location && $age <= 120) {
            return [
                'online' => true,
                'source' => 'real',
                'signal' => $location->signal(),
                'age_seconds' => $age,
            ];
        }

        $activeStatuses = $this->routes()
            ->where('status', '!=', Route::STATUS_COMPLETED)
            ->pluck('status');

        if ($activeStatuses->isEmpty()) {
            return ['online' => false, 'source' => null, 'signal' => 'stale', 'age_seconds' => $age];
        }

        return [
            'online' => true,
            'source' => 'simulated',
            'signal' => $activeStatuses->contains(Route::STATUS_IN_PROGRESS) ? 'live' : 'weak',
            'age_seconds' => $age,
        ];
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'driver_id');
    }

    public function routes()
    {
        return $this->hasMany(Route::class, 'driver_id');
    }

    public function driverLocation()
    {
        return $this->hasOne(DriverLocation::class, 'driver_id');
    }

    public function incidents()
    {
        return $this->hasMany(DeliveryIncident::class, 'driver_id');
    }
}
