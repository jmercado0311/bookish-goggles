import { requireAdmin } from "@/lib/auth";
import { CompanyForm } from "../company-form";

export default async function NuevaEmpresaPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Nueva empresa</h1>
      <p className="mb-6 text-sm text-slate-500">
        Carga los datos base del RUT. Las responsabilidades específicas se agregan después
        de guardar.
      </p>
      <CompanyForm />
    </div>
  );
}
