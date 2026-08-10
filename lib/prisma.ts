declare const require: any;
declare const process: { env: Record<string, string | undefined> };

let PrismaClientClass: any;
try {
  PrismaClientClass = typeof require !== "undefined" ? require("@prisma/client").PrismaClient : undefined;
} catch {
  PrismaClientClass = class DummyPrismaClient {
    constructor() {
      console.warn("PrismaClient not initialized: @prisma/client package is not installed yet. Run 'npm install' on target server.");
    }
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClientClass({
    log: typeof process !== "undefined" && process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

