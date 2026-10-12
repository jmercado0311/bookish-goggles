"use client";

import { useRouter } from "next/navigation";

export function DeleteButton({ url, confirmText, redirectTo }: { url: string; confirmText: string; redirectTo?: string }) {
  const router = useRouter();
  async function handleDelete() {
    if (!confirm(confirmText)) return;
    await fetch(url, { method: "DELETE" });
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }
  return (
    <button onClick={handleDelete} className="text-xs font-medium text-red-600 hover:underline">
      Eliminar
    </button>
  );
}
