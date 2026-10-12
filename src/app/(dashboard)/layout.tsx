import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { Organization, OrganizationSubscription } from "@/lib/types";
import { daysUntilDate, isActiveUntil } from "@/lib/billing/modules";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";
  const isOwner = profile.is_platform_owner;

  const [{ data: org }, { data: subs }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.organization_id ?? "").maybeSingle<Organization>(),
    supabase
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", profile.organization_id ?? ""),
  ]);

  const revisoriaActiva =
    isOwner || ((subs ?? []) as OrganizationSubscription[]).some((s) => s.module_code === "revisoria" && isActiveUntil(s.active_until));

  const links = [
    { href: "/vencimientos", label: "Vencimientos" },
    { href: "/empresas", label: "Empresas" },
    { href: "/financieros", label: "Estados financieros" },
    { href: "/conciliaciones", label: "Conciliaciones" },
    // La revisoría fiscal solo aparece a quien tiene el módulo (no todo despacho la ejerce)
    ...(revisoriaActiva ? [{ href: "/revisoria", label: "Revisoría fiscal" }] : []),
    ...(isAdmin
      ? [
          { href: "/calendario-ica", label: "Calendario ICA" },
          { href: "/usuarios", label: "Usuarios" },
          { href: "/facturacion", label: "Plan y pagos" },
        ]
      : []),
    ...(isOwner
      ? [
          { href: "/calendario-dian", label: "Calendario DIAN" },
          { href: "/plataforma", label: "Plataforma" },
        ]
      : []),
  ];

  // Aviso cuando el módulo base vence pronto (o ya venció)
  const base = ((subs ?? []) as OrganizationSubscription[]).find((s) => s.module_code === "vencimientos");
  const daysLeft = base ? daysUntilDate(base.active_until) : null;
  const showBanner = !isOwner && isAdmin && (daysLeft === null || daysLeft <= 7);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Contaryx{org ? ` · ${org.name}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              {profile.full_name} · {isAdmin ? "Administrador" : "Colaborador"}
            </p>
          </div>
          <SignOutButton />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {showBanner && (
        <div className="border-b border-amber-200 bg-amber-50 print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-amber-800">
            <span>
              {daysLeft === null || daysLeft <= 0
                ? "Tu suscripción de Vencimientos no está activa."
                : `Tu suscripción de Vencimientos vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}.`}
            </span>
            <Link href="/facturacion" className="font-semibold underline">
              Renovar ahora
            </Link>
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {!profile.organization_id && !isOwner ? (
          <p className="text-sm text-slate-600">
            Tu usuario todavía no está asociado a ningún despacho. Pide a tu administrador que te
            invite de nuevo.
          </p>
        ) : (
          children
        )}
      </main>
      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-700">Johan Mercado Frías</p>
          <p>Contador público</p>
          <p>Especialista en Sistemas de Calidad y Auditoría en Servicios de Salud</p>
          <p>Especialista en Revisoría Fiscal y Auditoría Forense</p>
        </div>
      </footer>
    </div>
  );
}
