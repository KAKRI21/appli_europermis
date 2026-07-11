// src/db/client.server.ts
//
// Client DB serveur (Neon serverless driver + Drizzle).
// Remplace src/integrations/supabase/client.server.ts
//
// SÉCURITÉ : ce fichier ne doit jamais être importé depuis du code client
// (composants React). Le suffixe .server.ts fait que Vite ne le bundle pas
// pour le navigateur — mêmes conventions que l'ancien config.server.ts.
//
// Variable d'env requise : DATABASE_URL (chaîne de connexion Neon,
// format: postgresql://user:password@host/dbname?sslmode=require)

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Set it to your Neon connection string " +
        "(Neon dashboard → Connection Details → Pooled connection).",
    );
  }

  const sql = neon(DATABASE_URL);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | undefined;

// Import comme ceci : import { db } from "@/db/client.server";
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop, receiver) {
    if (!_db) _db = createDb();
    return Reflect.get(_db, prop, receiver);
  },
});
