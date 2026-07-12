import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import logoAsset from "@/assets/logo-blanc.webp.asset.json";
import { login } from "@/lib/auth/auth.functions";
import type { AppRole } from "@/lib/auth/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Euro-Permis Sarcelles — Connexion" },
      {
        name: "description",
        content:
          "Espace en ligne de l'auto-école Euro-Permis Sarcelles : élèves, moniteurs et secrétariat.",
      },
    ],
  }),
  component: LoginPage,
});

function goToRole(navigate: ReturnType<typeof useNavigate>, role: AppRole) {
  if (role === "admin") navigate({ to: "/admin" });
  else if (role === "instructor") navigate({ to: "/instructor" });
  else navigate({ to: "/student" });
}

function LoginPage() {
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login({ data: { usernameOrEmail, password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      goToRole(navigate, res.user.role);
    } catch (err) {
      setError("Une erreur est survenue. Réessayez.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pb-10 pt-12">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-24 w-24 place-items-center rounded-2xl bg-primary/15 p-3">
            <img src={logoAsset.url} alt="Logo Euro-Permis Sarcelles" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Euro-Permis Sarcelles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre auto-école, dans votre poche.
          </p>
        </div>

        <form className="mt-8 space-y-3" onSubmit={handleSignIn}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Identifiant ou email
            </label>
            <input
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="ex. prenom.nom ou email"
              autoComplete="username"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Se connecter
          </button>
          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          56-58 Avenue Paul Valéry, 95200 Sarcelles · 01 34 29 01 54
        </p>
      </div>
    </div>
  );
}
