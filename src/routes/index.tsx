import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, UserCog, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo-blanc.webp.asset.json";
import { type MockRole } from "@/lib/local-auth";
import { signInWithCredentials } from "@/lib/supabase-auth";
import { seedDemoAccounts, DEMO_ACCOUNTS } from "@/lib/auth.functions";

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

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const goToRole = (role: MockRole) => {
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "instructor") navigate({ to: "/instructor" });
    else navigate({ to: "/student" });
  };

  const handleSignIn = async (u: string, p: string) => {
    setLoading(true);
    setError(null);
    const res = await signInWithCredentials(u, p);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    goToRole(res.role);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoAccounts();
      toast.success("Comptes démo initialisés. Vous pouvez maintenant vous connecter.");
    } catch (e) {
      toast.error("Échec : serveur non configuré (SEED_SECRET manquant).");
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };


  const demoLogin = (email: string) => {
    const acc = DEMO_ACCOUNTS.find((a) => a.email === email);
    if (!acc) return;
    handleSignIn(acc.email, acc.password);
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

        <form
          className="mt-8 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSignIn(username, password);
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Email ou identifiant
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. eleve@europermis.fr"
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

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Accès démo
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <DemoButton
            label="Tester l'Espace Élève"
            sub="eleve@europermis.fr"
            icon={GraduationCap}
            onClick={() => demoLogin("eleve@europermis.fr")}
          />
          <DemoButton
            label="Tester l'Espace Moniteur"
            sub="moniteur@europermis.fr"
            icon={UserCog}
            onClick={() => demoLogin("moniteur@europermis.fr")}
          />
          <DemoButton
            label="Tester l'Espace Secrétaire (Admin)"
            sub="admin@europermis.fr"
            icon={ShieldCheck}
            onClick={() => demoLogin("admin@europermis.fr")}
          />
        </div>

        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {seeding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Initialiser / réinitialiser les comptes démo
        </button>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          56-58 Avenue Paul Valéry, 95200 Sarcelles · 01 34 29 01 54
        </p>
      </div>
    </div>
  );
}

function DemoButton({
  label,
  sub,
  icon: Icon,
  onClick,
}: {
  label: string;
  sub: string;
  icon: typeof GraduationCap;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-left transition-colors hover:bg-primary/20"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">🟢 {label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <span className="text-primary">→</span>
    </button>
  );
}
