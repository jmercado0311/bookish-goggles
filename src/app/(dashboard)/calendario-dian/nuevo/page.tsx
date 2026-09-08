import { requireAdmin } from "@/lib/auth";
import { UploadWizard } from "./upload-wizard";

export default async function NuevoCalendarioPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Cargar calendario DIAN</h1>
      <p className="mb-6 text-sm text-slate-500">
        Sube el PDF, revisa/corrige las fechas extraídas y confirma. Nada se guarda sin tu
        confirmación.
      </p>
      <UploadWizard />
    </div>
  );
}
