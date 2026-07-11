// src/lib/auth/middleware.server.ts
// Remplace src/integrations/supabase/auth-middleware.ts
//
// Usage identique à l'ancien requireSupabaseAuth :
//   export const myServerFn = createServerFn({ method: "POST" })
//     .middleware([requireAuth])
//     .handler(async ({ context }) => {
//       context.userId, context.role, context.username
//     });
//
// Pour restreindre à un rôle précis, composer avec requireRole :
//   .middleware([requireAuth, requireRole("admin")])

import { createMiddleware } from "@tanstack/react-start";
import { getSession } from "./session.server";
import type { AppRole } from "./types";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: no active session");
  }
  return next({
    context: {
      userId: session.userId,
      role: session.role,
      username: session.username,
    },
  });
});

/**
 * À chaîner APRÈS requireAuth : `.middleware([requireAuth, requireRole("admin")])`
 */
export function requireRole(...allowed: AppRole[]) {
  return createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const role = (context as { role?: AppRole }).role;
    if (!role || !allowed.includes(role)) {
      throw new Error(`Forbidden: requires role ${allowed.join(" or ")}`);
    }
    return next();
  });
}
