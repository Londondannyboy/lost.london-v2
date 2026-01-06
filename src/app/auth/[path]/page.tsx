import { AuthView } from '@neondatabase/auth/react';

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800">Lost London</h1>
          <p className="text-stone-600 mt-2">
            {path === 'sign-in'
              ? 'Sign in to continue exploring hidden history with VIC'
              : path === 'sign-up'
              ? 'Create an account to explore hidden history with VIC'
              : 'Authentication'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <AuthView path={path} />
        </div>
      </div>
    </main>
  );
}
