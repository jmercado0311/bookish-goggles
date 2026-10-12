"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegistroPage() {
  const [form, setForm] = useState({ full_name: "", email: "", organization_name: "", nit: "" });
  const [acepta, setAcepta] = useState(false);
  const [revisoria, setRevisoria] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, acepta_terminos: acepta, ejerce_revisoria: revisoria === true }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la cuenta.");
      return;
    }
    setDone(true);
  }

  const input =
    "mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Crea tu cuenta</h1>
        {done ? (
          <>
            <p className="mb-4 text-sm text-slate-600">
              ¡Listo! Te enviamos un correo a <strong>{form.email}</strong> para activar la cuenta y crear
              tu contraseña. Revisa también la carpeta de spam.
            </p>
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
              Ir a iniciar sesión
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-6 text-sm text-slate-500">
              Prueba gratis todos los módulos. Sin tarjeta de crédito.
            </p>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tu nombre</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
            <label className="mb-1 block text-sm font-medium text-slate-700">Correo</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            <label className="mb-1 block text-sm font-medium text-slate-700">Nombre del despacho o firma contable</label>
            <input
              required
              value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
              className={input}
              placeholder="Ej. Contadores Asociados SAS"
            />
            <label className="mb-1 block text-sm font-medium text-slate-700">NIT o cédula (opcional)</label>
            <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} className={input} />

            <fieldset className="mb-4">
              <legend className="mb-1 block text-sm font-medium text-slate-700">¿Ejerces revisoría fiscal?</legend>
              <div className="flex gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-1">
                  <input type="radio" name="revisoria" required checked={revisoria === true} onChange={() => setRevisoria(true)} /> Sí
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="revisoria" checked={revisoria === false} onChange={() => setRevisoria(false)} /> No
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-500">Si la ejerces, incluimos en tu prueba el módulo de revisoría fiscal.</p>
            </fieldset>

            <label className="mb-4 flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" required />
              <span>
                Acepto los{" "}
                <Link href="/terminos" target="_blank" className="underline">
                  términos de uso y la política de tratamiento de datos personales
                </Link>{" "}
                (Ley 1581 de 2012).
              </span>
            </label>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
            </button>
            <p className="mt-4 text-center text-xs text-slate-500">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">
                Inicia sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
