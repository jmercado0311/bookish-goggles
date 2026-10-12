import type { FrameworkSpec } from "./frameworks";
import type { BalanceSheet, CashFlow, IncomeStatement, TBLine } from "./statements";

/**
 * Lista de verificación de cumplimiento del marco técnico antes de emitir
 * los estados financieros. "error" impide considerarlos conformes; "alerta"
 * requiere revisión del contador.
 */

export type CheckStatus = "ok" | "alerta" | "error";

export interface ComplianceCheck {
  status: CheckStatus;
  text: string;
  ref: string;
}

export function complianceChecks(input: {
  spec: FrameworkSpec;
  lines: TBLine[];
  balance: BalanceSheet;
  income: IncomeStatement;
  cash: CashFlow;
  hasComparativeIncome: boolean;
  representanteLegal: string | null;
  contador: string | null;
}): ComplianceCheck[] {
  const { spec, lines, balance, income, cash } = input;
  const checks: ComplianceCheck[] = [];
  const s = spec.statements;
  const nonZero = (pred: (l: TBLine) => boolean) => lines.some((l) => pred(l) && Math.round(Number(l.saldo_final)) !== 0);

  checks.push({
    status: "ok",
    text: `Juego completo para ${spec.short}: ${[s.situacion, s.resultados, s.patrimonio, s.flujos].filter(Boolean).join(", ")} y notas.`,
    ref: spec.juegoCompletoRef,
  });

  checks.push(
    balance.descuadre === 0
      ? { status: "ok", text: "El estado de situación financiera cuadra: activo = pasivo + patrimonio.", ref: "Ecuación contable" }
      : { status: "error", text: `El estado de situación financiera no cuadra (diferencia ${balance.descuadre.toLocaleString("es-CO")}).`, ref: "Ecuación contable" }
  );

  const unclassified = lines.filter((l) => l.rubro === "sin_clasificar" && Math.round(Number(l.saldo_final)) !== 0).length;
  if (unclassified > 0) {
    checks.push({ status: "error", text: `${unclassified} cuenta(s) con saldo sin clasificar en un rubro.`, ref: "Pestaña Clasificación de cuentas" });
  }

  checks.push({
    status: "ok",
    text: "Activos y pasivos clasificados en corrientes y no corrientes. Verifique que las obligaciones con vencimiento superior a 12 meses estén como no corrientes.",
    ref: spec.key === "grupo1" ? "NIC 1, párrafos 60 a 76" : spec.key === "grupo2" ? "NIIF para las PYMES, párrafos 4.4 a 4.8" : "Anexo 3 del Decreto 2420 de 2015",
  });

  const hasOpening = lines.some((l) => Math.round(Number(l.saldo_anterior)) !== 0);
  if (spec.comparativo.exigido) {
    checks.push(
      hasOpening
        ? { status: "ok", text: "Estado de situación financiera comparativo con el cierre del periodo anterior.", ref: spec.comparativo.ref }
        : { status: "error", text: "No hay saldos del periodo anterior: el estado de situación financiera no es comparativo.", ref: spec.comparativo.ref }
    );
    checks.push(
      input.hasComparativeIncome
        ? { status: "ok", text: "Estado de resultados comparativo con el periodo anterior.", ref: spec.comparativo.ref }
        : {
            status: "alerta",
            text: "Falta el comparativo del estado de resultados: suba el balance de prueba del periodo anterior de esta empresa (salvo que sea el primer periodo de la entidad).",
            ref: spec.comparativo.ref,
          }
    );
  }

  if (income.cerrado) {
    checks.push({
      status: "alerta",
      text: "Las cuentas de resultados ya están cerradas: el estado de resultados solo muestra el resultado neto. Suba el balance antes del cierre.",
      ref: "Presentación del resultado",
    });
  }

  if (nonZero((l) => l.account_code.startsWith("19") || l.account_code.startsWith("38"))) {
    checks.push({
      status: "alerta",
      text: "Hay saldos en valorizaciones (cuentas 19 y 38 del Decreto 2649). No son un modelo de medición NIIF: elimínelos o conviértalos en un modelo de revaluación permitido.",
      ref: spec.key === "grupo1" ? "NIC 16, párrafo 31" : spec.key === "grupo2" ? "NIIF para las PYMES, párrafo 17.15" : "Anexo 3 (costo histórico)",
    });
  }

  if (!spec.impuestoDiferido && nonZero((l) => l.rubro === "impuesto_diferido_activo" || l.rubro === "impuesto_diferido_pasivo")) {
    checks.push({
      status: "error",
      text: "Hay saldos de impuesto diferido, que el marco de microempresas no contempla. Revise y reverse esos saldos.",
      ref: "Anexo 3 del Decreto 2420 de 2015",
    });
  }

  if (!spec.ori && nonZero((l) => l.rubro === "ori")) {
    checks.push({
      status: "alerta",
      text: "Hay saldos de otro resultado integral, concepto que no existe en el marco de microempresas.",
      ref: "Anexo 3 del Decreto 2420 de 2015",
    });
  }

  if (spec.statements.flujos) {
    checks.push(
      cash.diferencia === 0
        ? { status: "ok", text: "El estado de flujos de efectivo concilia con la variación del efectivo.", ref: spec.key === "grupo1" ? "NIC 7" : "NIIF para las PYMES, Sección 7" }
        : { status: "alerta", text: `El flujo de efectivo no concilia por ${cash.diferencia.toLocaleString("es-CO")}.`, ref: spec.key === "grupo1" ? "NIC 7" : "NIIF para las PYMES, Sección 7" }
    );
  }

  if (balance.current.patrimonio <= 0) {
    checks.push({
      status: "alerta",
      text: "El patrimonio es negativo o nulo: evalúe la hipótesis de negocio en marcha y revele las incertidumbres materiales.",
      ref: spec.key === "grupo1" ? "NIC 1, párrafos 25 y 26" : spec.key === "grupo2" ? "NIIF para las PYMES, párrafos 3.8 y 3.9" : "Anexo 3 (negocio en marcha)",
    });
  }

  checks.push(
    input.representanteLegal && input.contador
      ? { status: "ok", text: "Firmas del representante legal y del contador público registradas para la certificación.", ref: "Ley 222 de 1995, art. 37" }
      : { status: "alerta", text: "Registre en Firmas el representante legal y el contador público que certifican los estados financieros.", ref: "Ley 222 de 1995, art. 37" }
  );

  return checks;
}
