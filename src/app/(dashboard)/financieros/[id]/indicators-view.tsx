import { formatIndicator, type Indicator, type Tone } from "@/lib/financial/indicators";
import { ReportHeader, fechaLarga, type ReportInfo } from "./report-header";
import { PrintButton } from "./report-toolbar";

const TONE_STYLE: Record<Tone, string> = {
  bueno: "bg-green-100 text-green-700",
  alerta: "bg-amber-100 text-amber-700",
  riesgo: "bg-red-100 text-red-700",
  neutro: "bg-slate-100 text-slate-600",
};

const TONE_LABEL: Record<Tone, string> = {
  bueno: "Favorable",
  alerta: "Atención",
  riesgo: "Riesgo",
  neutro: "Informativo",
};

export function IndicatorsView({
  info,
  indicators,
  hasPreviousIncome,
}: {
  info: ReportInfo;
  indicators: Indicator[];
  hasPreviousIncome: boolean;
}) {
  const groups = [...new Set(indicators.map((i) => i.group))];
  const counts = { bueno: 0, alerta: 0, riesgo: 0 };
  for (const i of indicators) if (i.tone in counts) counts[i.tone as keyof typeof counts]++;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <ReportHeader info={info} title="Análisis de indicadores financieros" subtitle={`Con corte al ${fechaLarga(info.periodEnd)}`} />

        <div className="mb-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-2xl font-semibold text-green-700">{counts.bueno}</p>
            <p className="text-xs text-green-700">Favorables</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-2xl font-semibold text-amber-700">{counts.alerta}</p>
            <p className="text-xs text-amber-700">Requieren atención</p>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-2xl font-semibold text-red-700">{counts.riesgo}</p>
            <p className="text-xs text-red-700">En riesgo</p>
          </div>
        </div>

        {!hasPreviousIncome && (
          <p className="mb-4 text-xs text-slate-500">
            Los indicadores de balance comparan contra el saldo inicial del periodo. Para comparar
            también los de resultados, sube el balance de prueba del periodo anterior de esta empresa.
          </p>
        )}

        {groups.map((group) => (
          <div key={group} className="mb-6 break-inside-avoid">
            <h3 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-900">{group}</h3>
            <div className="space-y-3">
              {indicators
                .filter((i) => i.group === group)
                .map((i) => (
                  <div key={i.key} className="break-inside-avoid rounded-xl border border-slate-100 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{i.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold tabular-nums text-slate-900">
                          {formatIndicator(i.current, i.unit)}
                        </span>
                        {i.previous !== null && (
                          <span className="text-xs text-slate-500">
                            anterior: {formatIndicator(i.previous, i.unit)}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_STYLE[i.tone]}`}>
                          {TONE_LABEL[i.tone]}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{i.formula}</p>
                    <p className="mt-1 text-sm text-slate-700">{i.interpretation}</p>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <p className="text-xs text-slate-500">
          Las interpretaciones son automáticas y usan rangos de referencia generales. Ajuste el análisis
          al sector económico y a la situación particular de la entidad.
        </p>
      </section>
    </div>
  );
}
