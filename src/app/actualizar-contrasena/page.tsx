"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // El enlace de invitación/recuperación trae el token en la URL. El
    // cliente de Supabase lo detecta y crea la sesión automáticamente al
    // inicializarse; solo hay que esperar a que termine.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        setLinkInvalido(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setLinkInvalido(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("No se pudo guardar la contraseña. Intenta de nuevo.");
      return;
    }

    router.replace("/vencimientos");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Vencimientos Tributarios
        </h1>

        {linkInvalido ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Este enlace ya venció o no es válido. Pídele a tu administrador que te envíe
              una invitación nueva.
            </p>
            <a
              href="/login"
              className="block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir a iniciar sesión
            </a>
          </>
        ) : !ready ? (
          <p className="text-sm text-slate-500">Verificando tu enlace...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-6 text-sm text-slate-500">
              Crea la contraseña con la que vas a entrar a la aplicación.
            </p>

            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Mínimo 8 caracteres"
            />

            <label className="mb-1 block text-sm font-medium text-slate-700">
              Confirmar contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Repite la contraseña"
            />

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar contraseña y entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
