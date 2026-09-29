<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * GUARDA GLOBAL DE ESCRITURA
 *
 * Se aplica a TODO el grupo autenticado. Bloquea con 403 Forbidden
 * cualquier intento de escritura (POST / PUT / PATCH / DELETE) realizado
 * por un rol cuya matriz no incluya la acción respectiva en 'can'.
 *
 * Caso crítico resuelto: el CONTADOR solo tiene ['read', 'download'],
 * por lo que TODA llamada de escritura desde su sesión responde 403,
 * independientemente de la ruta que intente usar.
 *
 * Excepción: POST /auth/logout siempre está permitido (no es escritura
 * de negocio, es cierre de sesión).
 */
class WriteGuardMiddleware
{
    protected const WRITE_ACTIONS = [
        'POST' => 'create',
        'PUT' => 'update',
        'PATCH' => 'update',
        'DELETE' => 'delete',
    ];

    public function handle(Request $request, Closure $next)
    {
        $user = Auth::guard('sanctum')->user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $action = self::WRITE_ACTIONS[strtoupper($request->method())] ?? null;

        // El cierre de sesión no requiere permisos de negocio
        if ($action === null || str_contains($request->path(), 'auth/logout')) {
            return $next($request);
        }

        if (! in_array($action, $user->role_permissions['can'] ?? [], true)) {
            return response()->json([
                'error' => '403 Forbidden',
                'message' => "El rol {$user->role} no tiene permiso '{$action}' para esta operación.",
                'role' => $user->role,
                'required_permission' => $action,
            ], 403);
        }

        return $next($request);
    }
}
