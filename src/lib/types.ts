export type UserRole = "admin" | "colaborador";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  is_platform_owner: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  nit: string | null;
  contact_email: string | null;
  created_at: string;
}

export type ModuleCode = "vencimientos" | "estados_financieros" | "notas" | "indicadores";

export interface ServiceModule {
  code: ModuleCode;
  name: string;
  description: string;
  price_cop: number;
  sort_order: number;
  active: boolean;
}

export interface OrganizationSubscription {
  organization_id: string;
  module_code: ModuleCode;
  active_until: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  organization_id: string;
  module_code: ModuleCode;
  months: number;
  reference: string;
  amount_in_cents: number;
  status: string;
  provider: "wompi" | "manual";
  provider_transaction_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export type IvaPeriodicidad = "bimestral" | "cuatrimestral";

export interface Company {
  id: string;
  organization_id: string;
  nit: string;
  dv: string | null;
  razon_social: string;
  nombre_comercial: string | null;
  tipo_contribuyente: string;
  regimen: string | null;
  municipio: string | null;
  departamento: string | null;
  iva_periodicidad: IvaPeriodicidad;
  /** Grupo NIIF (Decreto 2420 de 2015); null si aún no se ha indicado. */
  niif_grupo: "grupo1" | "grupo2" | "grupo3" | null;
  created_by: string | null;
  created_at: string;
}

export interface CompanyResponsibility {
  id: string;
  company_id: string;
  code: string;
  name: string;
}

export interface CompanyIca {
  id: string;
  company_id: string;
  municipio: string;
  periodicidad: string;
  regla_dia_mes: number | null;
  fecha_puntual: string | null;
}

export type NitMatchMode = "last_digit" | "last_two_digits";

export interface TaxCalendarEntry {
  id: string;
  year: number;
  responsibility_code: string;
  last_nit_digit: number;
  match_mode: NitMatchMode;
  /** Solo para responsabilidades 48 (IVA) y 33 (INC); null en el resto. */
  periodicidad: IvaPeriodicidad | null;
  period_label: string;
  due_date: string;
}

export type CustomObligationType = "nomina_electronica" | "parafiscales_pila" | "otro";

export interface CustomObligation {
  id: string;
  company_id: string;
  tipo: CustomObligationType;
  nombre: string;
  regla_dia_mes: number | null;
  fecha_puntual: string | null;
}

export interface UserCompanyAccess {
  user_id: string;
  company_id: string;
  granted_by: string | null;
  granted_at: string;
}

export type CalendarUploadStatus = "pendiente_revision" | "confirmado";

export interface CalendarUpload {
  id: string;
  year: number;
  file_path: string;
  status: CalendarUploadStatus;
  uploaded_by: string | null;
  uploaded_at: string;
  confirmed_at: string | null;
}

export interface SubmittedDeclaration {
  id: string;
  company_id: string;
  responsibility_code: string;
  period_label: string;
  due_date: string;
  submitted_at: string;
  submitted_by: string | null;
}

/** Un vencimiento ya resuelto para una empresa concreta (vista principal). */
export interface CompanyDeadline {
  company: Company;
  responsibility_code: string;
  responsibility_name: string;
  period_label: string;
  due_date: string;
  source: "dian" | "ica" | "custom";
  /** true si alguien ya marcó esta declaración puntual como presentada. */
  presentado: boolean;
  presentado_en: string | null;
}

/** Clave única de un vencimiento puntual, usada para cruzar contra submitted_declarations. */
export function deadlineKey(d: {
  company: { id: string };
  responsibility_code: string;
  period_label: string;
  due_date: string;
}): string {
  return `${d.company.id}|${d.responsibility_code}|${d.period_label}|${d.due_date}`;
}
