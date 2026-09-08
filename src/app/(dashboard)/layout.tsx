import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();
  const isAdmin = profile.role === "admin";

  const links = [
    { href: "/vencimientos", label: "Vencimientos" },
    { href: "/empresas", label: "Empresas" },
    ...(isAdmin
      ? [
          { href: "/calendario-dian", label: "Calendario DIAN" },
          { href: "/usuarios", label: "Usuarios" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Vencimientos Tributarios</p>
            <p className="text-xs text-slate-500">
              {profile.full_name} · {isAdmin ? "Administrador" : "Colaborador"}
            </p>
          </div>
          <SignOutButton />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
