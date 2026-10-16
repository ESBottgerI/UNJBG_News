import { existsSync } from "fs";

// Carga .env en process.env para los scripts de linea de comandos.
//
// Next.js carga .env por su cuenta, pero los scripts que corren con tsx no.
// Prisma lo carga de paso al importarse (por eso DATABASE_URL "aparece solo"),
// pero no hay que depender de eso: el worker de WhatsApp necesita las WA_* y el
// script de emparejamiento ni siquiera importa Prisma.
//
// No sobreescribe variables ya definidas en el entorno, asi que en Docker o en
// produccion las del contenedor tienen prioridad. Este modulo solo lo importan
// los scripts; la app web no lo toca.
//
// Se ejecuta al importarse (efecto de lado) para que quede cargado antes que
// cualquier otro import que lea variables de entorno.

if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env ilegible o con formato raro: se sigue con lo que ya haya.
  }
}

export {};
