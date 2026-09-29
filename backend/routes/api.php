<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LogisticsController;
use App\Http\Controllers\MicroCostController;
use App\Http\Controllers\MicroStockController;
use App\Http\Controllers\MicroDeliveryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ReportController;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\ModulePermissionMiddleware;

/*
|--------------------------------------------------------------------------
| API Routes — MATRIZ RBAC MICROMASTER  (5 roles)
|--------------------------------------------------------------------------
|
|  ADMINISTRADOR          : los 5 módulos (create/read/update/delete/download)
|  OPERARIO_LOGISTICO     : inventory_stock + orders_delivery (sin delete)
|  SUPERVISOR_PRODUCCION  : recipes_production (lectura de inventory_stock)
|  CONTADOR               : reports_simulations (solo lectura/descarga)
|  TRANSPORTISTA          : orders_delivery — rutas y pedidos PROPIOS
|
|  write.guard (Kernel, grupo 'api') bloquea POST/PUT/PATCH/DELETE a los
|  roles sin la acción correspondiente => el CONTADOR recibe 403 global.
|
|  RoleMiddleware acepta varios roles; ModulePermissionMiddleware acepta
|  el sufijo ':read' para módulos de sólo lectura.
|
*/

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'write.guard'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    /*
    |------------------------------------------------------------------
    | INVENTARIO & STOCK  (inventory_stock)
    |------------------------------------------------------------------
    | Acceso COMPLETO  : ADMINISTRADOR, OPERARIO_LOGISTICO
    | Solo LECTURA     : SUPERVISOR_PRODUCCION  (read_modules)
    | Sin acceso       : CONTADOR, TRANSPORTISTA
    */
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO,SUPERVISOR_PRODUCCION')->group(function () {
        Route::get('/stock/batches', [MicroStockController::class, 'index']);
        Route::get('/stock/alerts', [MicroStockController::class, 'alerts']);
        Route::get('/stock/ingredients', [MicroStockController::class, 'ingredientStock']);
    });

    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO')->group(function () {
        Route::post('/stock/batches', [MicroStockController::class, 'store']);
        Route::post('/stock/entry', [MicroStockController::class, 'entry']);
        Route::post('/stock/exit', [MicroStockController::class, 'exit']);

        // *** Sincronización QR (app móvil -> API web) ***
        Route::post('/stock/qr-scan', [MicroStockController::class, 'qrScan']);
    });

    /*
    |------------------------------------------------------------------
    | RECETAS & PRODUCCIÓN  (recipes_production)
    |------------------------------------------------------------------
    | Acceso COMPLETO : ADMINISTRADOR, SUPERVISOR_PRODUCCION
    | Sin acceso      : OPERARIO_LOGISTICO, CONTADOR, TRANSPORTISTA
    */
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,SUPERVISOR_PRODUCCION')->group(function () {
        Route::get('/cost/recipes', [MicroCostController::class, 'recipes']);
        Route::get('/cost/recipes/{id}/stock-check', [MicroCostController::class, 'stockCheck']);
        Route::post('/cost/recipes', [MicroCostController::class, 'storeRecipe']);
        Route::patch('/cost/recipes/{id}', [MicroCostController::class, 'updateRecipe']);
        Route::delete('/cost/recipes/{id}', [MicroCostController::class, 'destroyRecipe']);
        Route::post('/cost/simulate-scale', [MicroCostController::class, 'simulateScale']);
        Route::get('/cost/ingredients', [MicroCostController::class, 'ingredients']);
    });

    /*
    |------------------------------------------------------------------
    | PEDIDOS & ENTREGAS  (orders_delivery)
    |------------------------------------------------------------------
    | GESTIÓN   : ADMINISTRADOR, OPERARIO_LOGISTICO
    | OPERACIÓN : ADMINISTRADOR, OPERARIO_LOGISTICO, TRANSPORTISTA
    | Sin acceso: SUPERVISOR_PRODUCCION, CONTADOR
    */

    // --- 1. GESTIÓN de la ruta: crear, editar, drivers, resolver novedades
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO')->group(function () {
        Route::post('/delivery/routes', [LogisticsController::class, 'storeRoute']);
        Route::patch('/delivery/routes/{id}', [LogisticsController::class, 'updateRoute']);
        Route::get('/delivery/drivers', [LogisticsController::class, 'drivers']);
        Route::patch('/delivery/incidents/{id}', [LogisticsController::class, 'updateIncident']);

        // Gestión de pedidos
        Route::post('/orders', [OrderController::class, 'store']);
        Route::patch('/orders/{id}', [OrderController::class, 'update']);
        Route::delete('/orders/{id}', [OrderController::class, 'destroy']);
    });

    // --- 2. OPERACIÓN en campo: rutas asignadas, GPS y novedades
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO,TRANSPORTISTA')->group(function () {
        Route::get('/delivery/routes', [LogisticsController::class, 'routes']);
        Route::get('/delivery/routes/{id}', [LogisticsController::class, 'routeDetail']);
        Route::get('/delivery/orders', [MicroDeliveryController::class, 'orders']);
        Route::get('/delivery/incidents', [LogisticsController::class, 'incidents']);
        Route::post('/delivery/incidents', [LogisticsController::class, 'storeIncident']);

        // La app móvil del conductor transmite su coordenada
        Route::post('/delivery/location', [LogisticsController::class, 'sendLocation']);

        // Cobro con OTP en destino
        Route::post('/delivery/verify-otp', [MicroDeliveryController::class, 'verifyOtp']);
        Route::patch('/delivery/update-payment', [MicroDeliveryController::class, 'updatePayment']);
        Route::post('/delivery/complete-payment', [MicroDeliveryController::class, 'completePayment']);

        // Pedidos (el TRANSPORTISTA sólo ve los suyos — filtrado en controlador)
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{id}', [OrderController::class, 'show']);
    });

    /*
    |------------------------------------------------------------------
    | REPORTES & SIMULACIONES  (reports_simulations)
    |------------------------------------------------------------------
    | Acceso COMPLETO  : ADMINISTRADOR  (create/download)
    | Solo LECTURA     : CONTADOR       (read/download, sin escritura)
    | Sin acceso       : OPERARIO_LOGISTICO, SUPERVISOR_PRODUCCION, TRANSPORTISTA
    |
    | Nota: todos los endpoints son GET; el CONTADOR no tiene rutas de
    | escritura en este módulo y write.guard bloquea cualquier POST/PUT/
    | DELETE que intente con su token => 403 Forbidden.
    */
    Route::middleware(ModulePermissionMiddleware::class.':reports_simulations')->group(function () {
        Route::get('/reports', [ReportController::class, 'index']);
        Route::get('/reports/costs', [ReportController::class, 'costs']);
        Route::get('/reports/stock', [ReportController::class, 'stock']);
        Route::get('/reports/orders', [ReportController::class, 'orders']);
        Route::get('/reports/download', [ReportController::class, 'download']);
    });

    /*
    |------------------------------------------------------------------
    | ADMINISTRACIÓN  (administration) — solo ADMINISTRADOR
    |------------------------------------------------------------------
    */
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR')->group(function () {
        Route::get('/settings/users', [AuthController::class, 'me']);
    });
});
