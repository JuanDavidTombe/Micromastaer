<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('micromaster-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'role_permissions' => $user->role_permissions,
                'default_module' => $this->getDefaultModule($user->role),
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'role_permissions' => $user->role_permissions,
                'modules' => $user->role_permissions['modules'] ?? [],
            ],
        ]);
    }

    private function getDefaultModule(string $role): string
    {
        return match ($role) {
            User::ROLE_OPERARIO_LOGISTICO => 'stock',
            User::ROLE_SUPERVISOR_PRODUCCION => 'recipes_production',
            User::ROLE_CONTADOR => 'reports_simulations',
            default => 'dashboard',
        };
    }
}
