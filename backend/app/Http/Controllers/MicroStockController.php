<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Ingredient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MicroStockController extends Controller
{
    /**
     * LISTADO DE LOTES (FEFO) con trazabilidad completa.
     * Acceso: ADMINISTRADOR y OPERARIO_LOGISTICO (escritura+lectura),
     *         SUPERVISOR_PRODUCCION (solo lectura vía read_modules).
     */
    public function index(Request $request)
    {
        if (! $this->hasStockReadAccess() && ! $this->hasReportsAccess()) {
            return $this->forbidden();
        }

        $query = Batch::with('ingredient')
            ->orderBy('expiration_date', 'asc');

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('ingredient_id') && $request->ingredient_id) {
            $query->where('ingredient_id', $request->ingredient_id);
        }

        if ($request->filled('supplier_name')) {
            $query->where('supplier_name', 'like', '%' . $request->supplier_name . '%');
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($qq) => $qq
                ->where('batch_code', 'like', "%{$s}%")
                ->orWhere('qr_code_hash', 'like', "%{$s}%")
                ->orWhere('supplier_name', 'like', "%{$s}%"));
        }

        $batches = $query->paginate(20);

        $batches->getCollection()->transform(function ($batch) {
            $batch->status = Batch::fefoStatusFor($batch->expiration_date);
            return $batch;
        });

        return response()->json([
            'batches' => $batches->items(),
            'meta' => [
                'total' => $batches->total(),
                'current_page' => $batches->currentPage(),
                'pages' => $batches->lastPage(),
            ],
            'summary' => $this->stockSummary(),
        ]);
    }

    /**
     * POST /api/stock/qr-scan
     * Sincroniza el escaneo QR de la app móvil con la base de datos web.
     * Acceso: OPERARIO_LOGISTICO y ADMINISTRADOR.
     */
    public function qrScan(Request $request)
    {
        if (! $this->hasStockWriteAccess()) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'qr_code_hash' => 'required|string|max:255',
            'batch_code' => 'required|string|max:255',
            'ingredient_id' => 'required|integer|exists:ingredients,id',
            'supplier_name' => 'required|string|max:255',
            'quantity' => 'required|numeric|min:0.0001',
            'expiration_date' => 'required|date',
        ]);

        // Anti-duplicación: un mismo QR no puede registrarse dos veces
        $duplicated = Batch::where('qr_code_hash', $data['qr_code_hash'])->first();

        if ($duplicated) {
            return response()->json([
                'error' => 'QR_DUPLICADO',
                'message' => "El código QR ya está registrado en el lote {$duplicated->batch_code}.",
                'batch' => $duplicated->load('ingredient'),
            ], 409);
        }

        $batch = DB::transaction(function () use ($data) {
            return Batch::create([
                'ingredient_id' => $data['ingredient_id'],
                'batch_code' => $data['batch_code'],
                'supplier_name' => $data['supplier_name'],
                'qr_code_hash' => $data['qr_code_hash'],
                'quantity' => $data['quantity'],
                'initial_quantity' => $data['quantity'],
                'expiration_date' => $data['expiration_date'],
                'status' => Batch::fefoStatusFor($data['expiration_date']),
                'received_at' => now(),
            ]);
        });

        $batch->load('ingredient');

        return response()->json([
            'message' => 'Lote registrado exitosamente desde QR',
            'batch' => $batch,
            // Resumen para refrescar la vista web de inventario y alertas en el mismo 201
            'summary' => $this->stockSummary(),
            'alerts' => $this->alertsPayload(),
        ], 201);
    }

    public function store(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'batch_code' => 'required|string|max:255',
            'supplier_name' => 'nullable|string|max:255',
            'quantity' => 'required|numeric|min:0.0001',
            'expiration_date' => 'required|date',
            'received_at' => 'nullable|date',
        ]);

        if (Batch::where('batch_code', $request->batch_code)->exists()) {
            return response()->json(['message' => 'El código de lote ya existe'], 422);
        }

        $batch = Batch::create([
            'ingredient_id' => $request->ingredient_id,
            'batch_code' => $request->batch_code,
            'supplier_name' => $request->supplier_name,
            'quantity' => $request->quantity,
            'initial_quantity' => $request->quantity,
            'expiration_date' => $request->expiration_date,
            'status' => Batch::fefoStatusFor($request->expiration_date),
            'received_at' => $request->received_at ?: now(),
        ]);

        $batch->load('ingredient');

        return response()->json(['batch' => $batch, 'summary' => $this->stockSummary()], 201);
    }

    public function alerts()
    {
        if (! $this->hasStockReadAccess() && ! $this->hasReportsAccess()) {
            return $this->forbidden();
        }

        return response()->json($this->alertsPayload());
    }

    public function ingredientStock()
    {
        if (! $this->hasStockReadAccess()) {
            return $this->forbidden();
        }

        $ingredients = Ingredient::with(['batches' => function ($query) {
            $query->orderBy('expiration_date', 'asc');
        }])->get();

        return response()->json(['ingredients' => $ingredients]);
    }

    /**
     * Entrada de stock manual (recepción de compra de proveedor).
     */
    public function entry(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'batch_code' => 'required|string|max:255',
            'supplier_name' => 'nullable|string|max:255',
            'quantity' => 'required|numeric|min:0.0001',
            'expiration_date' => 'required|date',
        ]);

        $batch = Batch::create([
            'ingredient_id' => $request->ingredient_id,
            'batch_code' => $request->batch_code,
            'supplier_name' => $request->supplier_name,
            'quantity' => $request->quantity,
            'initial_quantity' => $request->quantity,
            'expiration_date' => $request->expiration_date,
            'status' => Batch::fefoStatusFor($request->expiration_date),
            'received_at' => now(),
        ]);

        return response()->json([
            'batch' => $batch,
            'message' => 'Stock entry recorded',
            'summary' => $this->stockSummary(),
        ], 201);
    }

    /**
     * Salida de stock: descuenta del lote conservando initial_quantity.
     */
    public function exit(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'batch_id' => 'required|exists:batches,id',
            'quantity' => 'required|numeric|min:0.0001',
        ]);

        $batch = Batch::findOrFail($request->batch_id);

        if ($batch->quantity < $request->quantity) {
            return response()->json(['error' => 'Insufficient quantity'], 400);
        }

        $batch->quantity = round((float) $batch->quantity - (float) $request->quantity, 4);
        if ($batch->quantity <= 0) {
            $batch->status = 'critical';
        }
        $batch->save();

        return response()->json([
            'batch' => $batch,
            'message' => 'Stock exit recorded',
            'summary' => $this->stockSummary(),
        ]);
    }

    // ------------------------------------------------------------------
    //  Control de acceso
    // ------------------------------------------------------------------

    protected function hasStockReadAccess(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasReadModuleAccess('inventory_stock');
    }

    protected function hasStockWriteAccess(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasModuleAccess('inventory_stock');
    }

    /**
     * El CONTADOR consulta inventario a través de Reportes & Simulaciones.
     */
    protected function hasReportsAccess(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasModuleAccess('reports_simulations');
    }

    protected function canCreate(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && in_array('create', $user->role_permissions['can'] ?? []);
    }

    // ------------------------------------------------------------------
    //  Utilidades de respuesta
    // ------------------------------------------------------------------

    protected function stockSummary(): array
    {
        $now = now();

        return [
            'total' => Batch::count(),
            'optimal' => Batch::where('expiration_date', '>', $now->copy()->addDays(7))->count(),
            'warning' => Batch::where('expiration_date', '>=', $now)
                ->where('expiration_date', '<=', $now->copy()->addDays(7))->count(),
            'critical' => Batch::where('expiration_date', '<', $now)->count(),
            'total_quantity' => round((float) Batch::sum('quantity'), 2),
            'suppliers' => Batch::whereNotNull('supplier_name')->distinct()->count('supplier_name'),
        ];
    }

    protected function alertsPayload(): array
    {
        $now = now();

        $critical = Batch::with('ingredient')->where('expiration_date', '<', $now)
            ->orderBy('expiration_date', 'asc')->get();

        $warning = Batch::with('ingredient')->where('expiration_date', '>=', $now)
            ->where('expiration_date', '<=', $now->copy()->addDays(7))
            ->orderBy('expiration_date', 'asc')->get();

        return [
            'critical_count' => $critical->count(),
            'warning_count' => $warning->count(),
            'critical_batches' => $critical,
            'warning_batches' => $warning,
        ];
    }
}
