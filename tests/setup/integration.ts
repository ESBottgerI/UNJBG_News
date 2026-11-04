// Guard de seguridad de la suite de integracion.
//
// Los tests hacen TRUNCATE de tablas. Si por error se apunta a la base de
// desarrollo (unjbg_news) se perderian datos reales. Este guard aborta antes
// de tocar nada salvo que DATABASE_URL apunte a *_test o *_e2e.

const SAFE_DATABASE = /(_test|_e2e)(\?|$)/i;

export function assertSafeTestDatabase(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error(
      "DATABASE_URL no esta definida: la suite de integracion necesita una base de tests."
    );
  }
  if (!SAFE_DATABASE.test(url)) {
    throw new Error(
      `DATABASE_URL no parece una base de tests (se espera *_test o *_e2e): ${url}`
    );
  }
  return url;
}

// Se ejecuta antes de importar los tests: si la URL no es segura, vitest
// detiene la corrida con este mensaje.
assertSafeTestDatabase();
