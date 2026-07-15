import { createStart, createMiddleware } from "@tanstack/react-start";

// Charge .env explicitement : le preset Vite utilisé par ce projet n'injecte
// automatiquement que les variables préfixées VITE_* côté client — pas les
// variables serveur (DATABASE_URL, SESSION_SECRET...). On les charge donc ici,
// au tout début, avant que tout autre module serveur (auth, db) ne s'exécute.
// `process.loadEnvFile` est une API native Node (20.6+), aucune dépendance requise.
try {
  process.loadEnvFile();
} catch {
  // Fichier .env absent (ex: variables déjà injectées par la plateforme
  // d'hébergement en production) — pas bloquant, on continue.
}

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));