// drizzle.config.ts
// Utilisation :
//   npx drizzle-kit generate   → génère le SQL de migration à partir de src/db/schema.ts
//   npx drizzle-kit push       → applique directement le schéma à la base (pratique en dev)
//   npx drizzle-kit studio     → interface web pour explorer les données

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
