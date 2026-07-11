// src/lib/auth/types.ts
// Types partagés (safe pour import côté client — pas de logique serveur ici).

export type AppRole = "admin" | "instructor" | "student";

export type CurrentUser = {
  userId: string;
  username: string;
  role: AppRole;
  displayName: string;
};
