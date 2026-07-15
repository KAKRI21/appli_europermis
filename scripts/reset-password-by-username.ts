// scripts/reset-password-by-username.ts
//
// Usage :
//   npx tsx --env-file=.env scripts/reset-password-by-username.ts secrtariat.europermis
//   npx tsx --env-file=.env scripts/reset-password-by-username.ts karim.benali
//
// Affiche un nouveau mot de passe temporaire pour le compte demandé.
// Usage ponctuel (comptes créés avant qu'un mot de passe leur soit
// correctement assigné lors de la migration).

import { eq } from "drizzle-orm";
import { db } from "../src/db/client.server";
import { profiles, credentials } from "../src/db/schema";
import { hashPassword, generateTemporaryPassword } from "../src/lib/auth/password.server";

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: npx tsx --env-file=.env scripts/reset-password-by-username.ts <username>");
    process.exit(1);
  }

  const rows = await db
    .select({ id: profiles.id, username: profiles.username, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  const profile = rows[0];
  if (!profile) {
    console.error(`Aucun profil trouvé avec le username "${username}".`);
    process.exit(1);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  // Certains comptes n'ont peut-être pas de ligne credentials du tout —
  // on gère les deux cas (update si elle existe, insert sinon).
  const existing = await db
    .select({ userId: credentials.userId })
    .from(credentials)
    .where(eq(credentials.userId, profile.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(credentials)
      .set({ passwordHash, mustResetPassword: true, updatedAt: new Date() })
      .where(eq(credentials.userId, profile.id));
  } else {
    await db.insert(credentials).values({ userId: profile.id, passwordHash, mustResetPassword: true });
  }

  console.log("\n=== Nouveau mot de passe généré ===");
  console.log(`Username : ${profile.username}`);
  console.log(`Email    : ${profile.email}`);
  console.log(`Mot de passe temporaire : ${temporaryPassword}`);
  console.log("\nUtilise ces identifiants pour te connecter.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });