import Link from "next/link";

/** Se muestra en lugar del contenido cuando el despacho no tiene el módulo vigente. */
export function Paywall({ moduleName, isAdmin }: { moduleName: string; isAdmin: boolean }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <p className="mb-2 text-sm font-semibold text-slate-900">{moduleName}</p>
      <p className="mb-6 text-sm text-slate-500">
        Este módulo no está activo en tu plan o su vigencia terminó.
        {isAdmin ? " Actívalo para seguir usándolo." : " Pide al administrador del despacho que lo active."}
      </p>
      {isAdmin && (
        <Link
          href="/facturacion"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ver planes y activar
        </Link>
      )}
    </div>
  );
}
