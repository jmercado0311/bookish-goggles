/** Bloque de firmas al pie de los estados financieros (art. 37 Ley 222 de 1995). */
export function Signatures({
  representanteLegal,
  contadorNombre,
  contadorTp,
  revisorNombre,
  revisorTp,
}: {
  representanteLegal: string | null;
  contadorNombre: string | null;
  contadorTp: string | null;
  revisorNombre: string | null;
  revisorTp: string | null;
}) {
  const blocks = [
    { name: representanteLegal, role: "Representante legal", tp: null },
    { name: contadorNombre, role: "Contador público", tp: contadorTp },
    ...(revisorNombre ? [{ name: revisorNombre, role: "Revisor fiscal", tp: revisorTp }] : []),
  ];

  return (
    <div className="mt-12 grid grid-cols-1 gap-8 text-center text-xs text-slate-700 sm:grid-cols-3 print:grid-cols-3">
      {blocks.map((b) => (
        <div key={b.role}>
          <div className="mx-auto mb-1 w-48 border-t border-slate-400" />
          <p className="font-semibold">{b.name || "____________________"}</p>
          <p>{b.role}</p>
          {b.tp !== null && <p>T.P. {b.tp || "________"}</p>}
          {b.role === "Revisor fiscal" && <p>(Ver dictamen adjunto)</p>}
        </div>
      ))}
    </div>
  );
}
