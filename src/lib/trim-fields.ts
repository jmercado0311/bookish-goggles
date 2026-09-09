/**
 * Recorta espacios en blanco al inicio/fin de los campos de texto de un
 * objeto. Evita que un espacio de más (típico al copiar/pegar o al editar)
 * dañe silenciosamente cosas como el orden alfabético de las empresas.
 */
export function trimStringFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = value.trim();
    }
  }
  return result;
}
