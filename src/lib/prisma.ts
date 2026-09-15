import { PrismaClient } from "@prisma/client";

// Singleton de Prisma para evitar multiples conexiones en desarrollo (HMR).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}