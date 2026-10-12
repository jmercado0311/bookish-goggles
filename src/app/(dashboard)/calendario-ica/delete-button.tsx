"use client";

import { useRouter } from "next/navigation";

export function DeleteIcaCalendarButton(props: { municipio: string; year: number; periodicidad: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`¿Eliminar el calendario ICA ${props.periodicidad} ${props.year} de ${props.municipio}?`)) return;
    await fetch("/api/ica-calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(props),
    });
    router.refresh();
  }

  return (
    <button onClick={handleDelete} className="text-xs font-medium text-red-600 hover:underline">
      Eliminar
    </button>
  );
}
