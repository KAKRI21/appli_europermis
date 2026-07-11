import { createFileRoute, redirect } from "@tanstack/react-router";
import { getActiveSession } from "@/lib/local-auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Users,
  Upload,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileUp,
  CalendarClock,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronRight as ChevRight,
  KeyRound,
  X,
  Search,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { BottomNav, type TabItem } from "@/components/BottomNav";
import { INSTRUCTORS, PLANNING } from "@/lib/mock-data";
import {
  clearActiveStudentSession,
  getStoredStudents,
  saveStoredStudents,
  STUDENTS_STORAGE_KEY,
  syncStudentAuthUsers,
  type StoredStudentProfile,
} from "@/lib/local-auth";
import { provisionAccounts, resetStudentAccounts, type ProvisionInput } from "@/lib/provision.functions";

type SortKey = "recent" | "nameAsc" | "nameDesc" | "city";
type StatusFilter = "all" | "active" | "inactive";

function isActiveStudent(s: StoredStudentProfile) {
  const m = (s.hours ?? "").match(/^(\d+)\//);
  if (!m) return false;
  return Number(m[1]) > 0;
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Espace Admin — Euro-Permis Sarcelles" }] }),
  beforeLoad: () => {
    // SECURITY FIX: Do NOT skip the guard on the server (SSR).
    // Returning early when `window === undefined` allows the server to render
    // and send the full protected HTML to unauthenticated HTTP requests.
    // Instead, we check the session on both client and server.
    // On the server the session will always be null (no localStorage),
    // so SSR of protected routes is intentionally disabled — the redirect
    // fires immediately and the client handles the authenticated render.
    const session = getActiveSession();
    if (!session || session.role !== "admin") throw redirect({ to: "/" });
  },
  component: AdminApp,
});

type Tab = "planning" | "students" | "import";

const TABS: TabItem<Tab>[] = [
  { id: "planning", label: "Planning", icon: CalendarDays },
  { id: "students", label: "Élèves", icon: Users },
  { id: "import", label: "Import", icon: Upload },
];

// ---- Types & seed ----------------------------------------------------------

export type ManagedStudent = StoredStudentProfile;

const SEED_STUDENTS: ManagedStudent[] = [
  { civilite: "M.", nom: "Dupont", prenom: "Jean", dateNaissance: "12/03/2004", lieuNaissance: "Sarcelles", neph: "0123456789", pkg: "Permis B 20h", hours: "14/20" },
  { civilite: "Mme", nom: "Traoré", prenom: "Aïcha", dateNaissance: "07/11/2003", lieuNaissance: "Paris", neph: "0223456712", pkg: "Permis B 30h", hours: "22/30" },
  { civilite: "M.", nom: "Lefèvre", prenom: "Marc", dateNaissance: "23/05/2002", lieuNaissance: "Garges-lès-Gonesse", neph: "0392345621", pkg: "Automatique 13h", hours: "11/13" },
  { civilite: "Mme", nom: "Martin", prenom: "Léa", dateNaissance: "01/09/2005", lieuNaissance: "Sarcelles", neph: "0411223344", pkg: "Code illimité", hours: "—" },
  { civilite: "M.", nom: "Kessab", prenom: "Yanis", dateNaissance: "30/06/2006", lieuNaissance: "Villiers-le-Bel", neph: "0556677889", pkg: "Permis B 20h", hours: "06/20" },
].map((s) => ({
  ...s,
  id: s.neph,
  username: makeUsername(s.prenom, s.nom),
  password: s.neph,
  source: "seed" as const,
}));

function makeUsername(prenom: string, nom: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${norm(prenom)}.${norm(nom)}`;
}

// ---- Root ------------------------------------------------------------------

function AdminApp() {
  const [tab, setTab] = useState<Tab>("planning");
  const [students, setStudents] = useState<ManagedStudent[]>(SEED_STUDENTS);
  const [openStudent, setOpenStudent] = useState<ManagedStudent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydration depuis localStorage au montage
  useEffect(() => {
    try {
      const parsed = getStoredStudents();
      if (parsed.length > 0) setStudents(parsed);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persistance à chaque changement (après hydratation)
  useEffect(() => {
    if (!hydrated) return;
    try {
      saveStoredStudents(students);
      syncStudentAuthUsers(students);
    } catch {
      /* ignore */
    }
  }, [students, hydrated]);

  const titles: Record<Tab, string> = {
    planning: "Planning général",
    students: "Gestion élèves",
    import: "Synchronisation",
  };

  const addImported = (rows: Omit<ManagedStudent, "id" | "username" | "password" | "pkg" | "hours" | "source">[]) => {
    // Build a full ManagedStudent for every imported row (whether or not it's
    // already known locally). Local dedup only affects the in-memory list —
    // Cloud provisioning always runs for the whole batch, and the server
    // handler is idempotent (skips existing accounts, never resets them).
    const allBuilt: ManagedStudent[] = rows.map((r, i) => ({
      ...r,
      id: r.neph || crypto.randomUUID(),
      username: makeUsername(r.prenom, r.nom),
      password: r.neph && r.neph.length >= 6 ? r.neph : `${r.neph || "tmp"}Demo!`,
      pkg: "À définir",
      hours: "0/20",
      source: "import",
      createdAt: Date.now() + i,
    }));

    let added = 0;
    setStudents((prev) => {
      const byNeph = new Map(prev.map((s) => [s.neph, s]));
      for (const created of allBuilt) {
        if (created.neph && byNeph.has(created.neph)) continue;
        byNeph.set(created.neph, created);
        added++;
      }
      return Array.from(byNeph.values());
    });

    toast.success(
      added === 0
        ? `${allBuilt.length} ligne(s) déjà connues localement — synchronisation Cloud lancée.`
        : `${added} nouvel(s) élève(s) ajouté(s) localement.`,
    );
    setTab("students");

    if (allBuilt.length === 0) return;

    const users: ProvisionInput[] = allBuilt.map((s) => ({
      role: "student",
      email: (s.email && s.email.includes("@") ? s.email : `${s.username}@eleves.europermis.fr`).toLowerCase(),
      password: (s.password && s.password.length >= 6) ? s.password : `${s.password}Demo!`,
      firstName: s.prenom,
      lastName: s.nom,
      displayName: `${s.prenom} ${s.nom}`.trim(),
      student: {
        civilite: s.civilite,
        dateNaissance: s.dateNaissance,
        lieuNaissance: s.lieuNaissance,
        departementNaissance: s.departementNaissance,
        paysNaissance: s.paysNaissance,
        neph: s.neph,
        pkg: s.pkg,
        hours: s.hours,
        adresse: s.adresse,
        codePostal: s.codePostal,
        ville: s.ville,
        pays: s.pays,
        telephone: s.telephone,
        username: s.username,
        datePremierPermis: s.datePremierPermis,
        source: "import",
      },
    }));

    toast.info(`Création des comptes Cloud (${users.length}) en cours…`);
    provisionAccounts({ data: { users, resetPassword: true } })
      .then((res) => {
        const c = res.created.length;
        const sk = res.skipped.length;
        const er = res.errors.length;
        console.log("[provisionAccounts] result", res);
        if (er > 0) {
          toast.error(`Comptes Cloud : ${c} créés, ${sk} déjà existants, ${er} en erreur. Voir console.`);
          console.error("Provision errors:", res.errors);
        } else {
          toast.success(`Comptes Cloud : ${c} créés${sk > 0 ? `, ${sk} déjà existants` : ""}.`);
        }
      })
      .catch((err) => {
        console.error("[provisionAccounts] failed", err);
        toast.error(`Échec Cloud : ${err instanceof Error ? err.message : "droits admin requis"}.`);
      });
  };


  const deleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    clearActiveStudentSession(id);
    setOpenStudent(null);
    toast.success("Élève supprimé.");
  };

  const resetAll = () => {
    if (!window.confirm(
      "Réinitialisation TOTALE des élèves : les comptes Cloud (auth + rôles + fiches) seront supprimés. Continuer ?",
    )) return;
    setStudents([]);
    try {
      localStorage.removeItem(STUDENTS_STORAGE_KEY);
      syncStudentAuthUsers([]);
      clearActiveStudentSession();
    } catch {
      /* ignore */
    }
    toast.info("Suppression des comptes élèves côté Cloud…");
    resetStudentAccounts()
      .then((res) => {
        console.log("[resetStudentAccounts]", res);
        if (res.errors.length > 0) {
          toast.error(
            `Réinit. partielle : ${res.deletedAuth} comptes supprimés, ${res.errors.length} en erreur.`,
          );
        } else {
          toast.success(
            `Réinit. Cloud : ${res.deletedAuth} comptes supprimés, ${res.deletedStudents} fiches purgées.`,
          );
        }
      })
      .catch((err) => {
        console.error("[resetStudentAccounts] failed", err);
        toast.error(`Échec Cloud : ${err instanceof Error ? err.message : "droits admin requis"}.`);
      });
  };

  return (
    <>
      <AppShell title={titles[tab]} subtitle="Secrétariat · Admin">
        {tab === "planning" && <AdminPlanning />}
        {tab === "students" && (
          <AdminStudents
            students={students}
            onOpen={setOpenStudent}
            onDelete={deleteStudent}
            onResetAll={resetAll}
          />
        )}
        {tab === "import" && <AdminImport onValidate={addImported} />}
      </AppShell>
      <BottomNav items={TABS} active={tab} onChange={setTab} />
      <StudentDetailDialog
        student={openStudent}
        onClose={() => setOpenStudent(null)}
        onDelete={deleteStudent}
      />
    </>
  );
}

// ---- Planning --------------------------------------------------------------

const WEEKDAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const MONTH_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function formatFR(d: Date) {
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Sélectionne les cours d'un moniteur selon le jour de la semaine.
// Dimanche = fermé. Samedi = matinée allégée. Autres jours = planning par défaut.
function lessonsForInstructorOnDate(name: string, date: Date) {
  const dow = date.getDay();
  const base = PLANNING[name] ?? [];
  if (dow === 0) return [];
  if (dow === 6) return base.slice(0, 2);
  // Pour varier visuellement les jours, on décale en fonction du jour.
  const offset = (dow - 1) % Math.max(1, base.length);
  return [...base.slice(offset), ...base.slice(0, offset)];
}

function AdminPlanning() {
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [instructorIdx, setInstructorIdx] = useState(0);
  const currentInstructor = INSTRUCTORS[instructorIdx];

  const today = startOfDay(new Date());
  const isToday = date.getTime() === today.getTime();

  const shift = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(startOfDay(next));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground"
          aria-label="Jour précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Jour affiché {isToday && "· Aujourd'hui"}
          </p>
          <p className="text-sm font-semibold capitalize">{formatFR(date)}</p>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground"
          aria-label="Jour suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDate(today)}
        disabled={isToday}
        className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        Aujourd'hui
      </button>

      {/* Mobile : sélecteur moniteur */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-2 md:hidden">
        <button
          type="button"
          onClick={() =>
            setInstructorIdx((i) => (i - 1 + INSTRUCTORS.length) % INSTRUCTORS.length)
          }
          className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground"
          aria-label="Moniteur précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {currentInstructor.charAt(0)}
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Moniteur</p>
            <p className="text-sm font-semibold">{currentInstructor}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setInstructorIdx((i) => (i + 1) % INSTRUCTORS.length)}
          className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground"
          aria-label="Moniteur suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="md:hidden">
        <InstructorColumn name={currentInstructor} date={date} />
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
        {INSTRUCTORS.map((name) => (
          <InstructorColumn key={name} name={name} date={date} />
        ))}
      </div>
    </div>
  );
}

function InstructorColumn({ name, date }: { name: string; date: Date }) {
  const lessons = lessonsForInstructorOnDate(name, date);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {name.charAt(0)}
        </div>
        <p className="text-sm font-semibold">{name}</p>
      </div>
      {lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Aucun cours prévu ce jour</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lessons.map((l, i) => (
            <li key={i} className="rounded-xl bg-secondary p-2.5">
              <p className="text-[11px] font-semibold text-primary">{l.time}</p>
              <p className="mt-0.5 text-sm font-medium leading-tight">{l.student}</p>
              <p className="text-[11px] text-muted-foreground">{l.type}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Students --------------------------------------------------------------

function AdminStudents({
  students,
  onOpen,
  onDelete,
  onResetAll,
}: {
  students: ManagedStudent[];
  onOpen: (s: ManagedStudent) => void;
  onDelete: (id: string) => void;
  onResetAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const counts = useMemo(() => {
    let active = 0;
    for (const s of students) if (isActiveStudent(s)) active++;
    return { all: students.length, active, inactive: students.length - active };
  }, [students]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    let list = students;
    if (statusFilter !== "all") {
      list = list.filter((s) =>
        statusFilter === "active" ? isActiveStudent(s) : !isActiveStudent(s),
      );
    }
    if (q) {
      list = list.filter((s) =>
        [s.nom, s.prenom, s.neph, s.ville ?? "", s.email ?? ""].some((f) =>
          normalize(f).includes(q),
        ),
      );
    }
    const sorted = [...list];
    const fullName = (s: ManagedStudent) =>
      `${s.prenom ?? ""} ${s.nom ?? ""}`.trim().toLowerCase();
    const opts = { sensitivity: "base", numeric: true } as const;
    if (sortKey === "nameAsc") {
      sorted.sort((a, b) => fullName(a).localeCompare(fullName(b), "fr", opts));
    } else if (sortKey === "nameDesc") {
      sorted.sort((a, b) => fullName(b).localeCompare(fullName(a), "fr", opts));
    } else if (sortKey === "city") {
      sorted.sort((a, b) => {
        const ka = `${a.codePostal ?? ""} ${a.ville ?? a.lieuNaissance ?? ""}`.trim().toLowerCase();
        const kb = `${b.codePostal ?? ""} ${b.ville ?? b.lieuNaissance ?? ""}`.trim().toLowerCase();
        return ka.localeCompare(kb, "fr", opts);
      });
    } else {
      // Récents : les plus récemment ajoutés en haut (createdAt desc), seeds en dernier
      sorted.sort((a, b) => {
        const ta = a.createdAt ?? 0;
        const tb = b.createdAt ?? 0;
        if (ta !== tb) return tb - ta;
        if (a.source !== b.source) return a.source === "import" ? -1 : 1;
        return 0;
      });
    }
    return sorted;
  }, [students, query, sortKey, statusFilter]);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
        sortKey === key
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );

  const statusBtn = (key: StatusFilter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setStatusFilter(key)}
      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
        statusFilter === key
          ? "bg-accent text-accent-foreground"
          : "border border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {filtered.length} / {students.length} élève{students.length > 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={onResetAll}
          disabled={students.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Vider la liste des élèves"
          title="Vider la liste des élèves"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher : nom, prénom, NEPH, ville…"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="self-center text-[10px] uppercase tracking-wider text-muted-foreground">
          Tri :
        </span>
        {sortBtn("recent", "Récents")}
        {sortBtn("nameAsc", "Nom A–Z")}
        {sortBtn("nameDesc", "Nom Z–A")}
        {sortBtn("city", "Ville / CP")}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="self-center text-[10px] uppercase tracking-wider text-muted-foreground">
          État :
        </span>
        {statusBtn("all", "Tous", counts.all)}
        {statusBtn("active", "Actifs", counts.active)}
        {statusBtn("inactive", "Inactifs", counts.inactive)}
      </div>



      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {students.length === 0
            ? "Aucun élève. Importez un fichier .txt pour démarrer."
            : "Aucun élève ne correspond à la recherche."}
        </div>
      )}

      {filtered.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/60 hover:bg-secondary/50"
        >
          <button
            type="button"
            onClick={() => onOpen(s)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {(s.prenom[0] ?? "") + (s.nom[0] ?? "")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">
                  {s.prenom} {s.nom}
                </p>
                {s.source === "import" && (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                    Nouveau
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                NEPH · {s.neph || "—"}
                {s.ville ? ` · ${s.codePostal ?? ""} ${s.ville}`.trim() : ` · ${s.pkg}`}
              </p>
            </div>
            <span className="hidden rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-primary sm:inline">
              {s.hours}
            </span>
            <ChevRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Supprimer ${s.prenom} ${s.nom} ?`)) onDelete(s.id);
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive/20"
            aria-label={`Supprimer ${s.prenom} ${s.nom}`}
            title="Supprimer cet élève"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function StudentDetailDialog({
  student,
  onClose,
  onDelete,
}: {
  student: ManagedStudent | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {student && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {(student.prenom[0] ?? "") + (student.nom[0] ?? "")}
                </div>
                <span>
                  {student.civilite} {student.prenom} {student.nom}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              <InfoRow label="Civilité" value={student.civilite} />
              <InfoRow label="Nom" value={student.nom} />
              <InfoRow label="Prénom" value={student.prenom} />
              <InfoRow label="Date de naissance" value={student.dateNaissance} />
              <InfoRow label="Lieu de naissance" value={student.lieuNaissance} />
              {student.departementNaissance && (
                <InfoRow label="Dépt. naissance" value={student.departementNaissance} />
              )}
              {student.paysNaissance && (
                <InfoRow label="Pays de naissance" value={student.paysNaissance} />
              )}
              <InfoRow label="NEPH" value={student.neph} mono />
              {student.datePremierPermis && (
                <InfoRow label="1er permis" value={student.datePremierPermis} />
              )}
              <InfoRow label="Forfait" value={student.pkg} />
              <InfoRow label="Heures" value={student.hours} />

              {(student.adresse || student.ville || student.codePostal || student.pays) && (
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Adresse
                  </p>
                  {student.adresse && <InfoRow label="Rue" value={student.adresse} />}
                  {student.codePostal && (
                    <InfoRow label="Code postal" value={student.codePostal} />
                  )}
                  {student.ville && <InfoRow label="Ville" value={student.ville} />}
                  {student.pays && <InfoRow label="Pays" value={student.pays} />}
                </div>
              )}

              {(student.telephone || student.email) && (
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact
                  </p>
                  {student.telephone && (
                    <InfoRow label="Téléphone" value={student.telephone} mono />
                  )}
                  {student.email && <InfoRow label="Email" value={student.email} />}
                </div>
              )}

              <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <KeyRound className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Compte utilisateur généré
                  </p>
                </div>
                <InfoRow label="Identifiant" value={student.username} mono />
                <InfoRow label="Mot de passe" value={student.password} mono />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Supprimer ${student.prenom} ${student.nom} ?`,
                      )
                    )
                      onDelete(student.id);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" /> Supprimer
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold"
                >
                  <X className="h-4 w-4" /> Fermer
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ---- Import ----------------------------------------------------------------

type ImportedStudent = {
  civilite: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  neph: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  departementNaissance: string;
  paysNaissance: string;
  datePremierPermis: string;
};

function parseDateFR(d: string): number {
  const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return Number.POSITIVE_INFINITY;
  const [, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}`).getTime();
}

// Extrait NOM + PRENOM depuis un bloc unique (Index 1 d'EXPORT.TXT).
// Convention : les mots écrits ENTIÈREMENT en majuscules constituent le NOM
// de famille ; les autres mots (capitalisés ou minuscules) deviennent le
// PRENOM. Fallback : premier mot = NOM, reste = PRENOM.
function splitNomPrenom(bloc: string): { nom: string; prenom: string } {
  const cleaned = bloc.replace(/\s+/g, " ").trim();
  if (!cleaned) return { nom: "", prenom: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { nom: parts[0], prenom: "" };

  const nomParts: string[] = [];
  const prenomParts: string[] = [];
  for (const w of parts) {
    const letters = w.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'-]/g, "");
    if (letters.length >= 2 && letters === letters.toUpperCase()) {
      nomParts.push(w);
    } else {
      prenomParts.push(w);
    }
  }
  if (nomParts.length === 0 || prenomParts.length === 0) {
    return { nom: parts[0], prenom: parts.slice(1).join(" ") };
  }
  return { nom: nomParts.join(" "), prenom: prenomParts.join(" ") };
}

// Parse EXPORT.TXT (séparateur tabulation strict, encodage UTF-8/Latin-1).
// Indexation des colonnes :
//  0 CIVILITE | 1 NOM_PRENOM_BLOC | 2 NOM DE NAISSANCE | 3 ADRESSE
//  4 CODE POSTAL | 5 VILLE | 6 PAYS | 7-10 TELEPHONES | 11 EMAIL
//  12 DATE NAISSANCE | 13 VILLE NAISSANCE | 14 DEPT NAISSANCE
//  15 PAYS NAISSANCE | 16 NEPH | 17 DATE PREMIER PERMIS
function parseTxtTSV(text: string): ImportedStudent[] {
  // Nettoyage strict des retours chariot Windows puis découpage par \n.
  const cleaned = text.replace(/\r/g, "");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error("Fichier vide");

  // Détection d'un éventuel en-tête
  const first = lines[0].toLowerCase();
  const hasHeader =
    first.includes("civilit") ||
    first.includes("nom") ||
    first.includes("neph") ||
    first.includes("email");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) throw new Error("Aucune donnée exploitable");

  const at = (cols: string[], i: number) => (cols[i] ?? "").trim();

  const out: ImportedStudent[] = [];
  for (const line of dataLines) {
    const cols = line.split("\t");
    if (cols.length < 2) continue;

    const civilite = at(cols, 0) || "—";
    const bloc = at(cols, 1);
    if (!bloc) continue;
    const { nom, prenom } = splitNomPrenom(bloc);
    if (!nom && !prenom) continue;

    out.push({
      civilite,
      nom,
      prenom,
      adresse: at(cols, 3),
      codePostal: at(cols, 4),
      ville: at(cols, 5),
      pays: at(cols, 6),
      telephone: at(cols, 7),
      email: at(cols, 11),
      dateNaissance: at(cols, 12),
      lieuNaissance: at(cols, 13),
      departementNaissance: at(cols, 14),
      paysNaissance: at(cols, 15),
      neph: at(cols, 16),
      datePremierPermis: at(cols, 17),
    });
  }
  if (out.length === 0) throw new Error("Aucune ligne exploitable");
  return out;
}

// Parse JSON : tableau d'objets aux clés standardisées.
function parseJsonStudents(text: string): ImportedStudent[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.students) ? data.students : null;
  if (!arr) throw new Error("JSON invalide : tableau d'élèves attendu.");
  const out: ImportedStudent[] = [];
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const nom = String(r.nom ?? r.lastname ?? "").trim();
    const prenom = String(r.prenom ?? r.firstname ?? "").trim();
    if (!nom && !prenom) continue;
    out.push({
      civilite: String(r.civilite ?? "—").trim() || "—",
      nom, prenom,
      dateNaissance: String(r.dateNaissance ?? r.birthdate ?? "").trim(),
      lieuNaissance: String(r.lieuNaissance ?? "").trim(),
      neph: String(r.neph ?? "").trim(),
      adresse: String(r.adresse ?? "").trim(),
      codePostal: String(r.codePostal ?? r.cp ?? "").trim(),
      ville: String(r.ville ?? "").trim(),
      pays: String(r.pays ?? "France").trim(),
      telephone: String(r.telephone ?? r.tel ?? "").trim(),
      email: String(r.email ?? "").trim(),
      departementNaissance: String(r.departementNaissance ?? "").trim(),
      paysNaissance: String(r.paysNaissance ?? "France").trim(),
      datePremierPermis: String(r.datePremierPermis ?? "").trim(),
    });
  }
  if (out.length === 0) throw new Error("Aucun élève exploitable dans le JSON.");
  return out;
}

// Parse CSV simple (séparateur , ou ;), première ligne = en-tête.
function parseCsvStudents(text: string): ImportedStudent[] {
  const cleaned = text.replace(/\r/g, "");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV vide ou sans données.");
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const get = (cols: string[], name: string) => {
    const i = idx(name);
    return i >= 0 ? (cols[i] ?? "").trim() : "";
  };
  const out: ImportedStudent[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(sep);
    const nom = get(cols, "nom");
    const prenom = get(cols, "prenom") || get(cols, "prénom");
    if (!nom && !prenom) continue;
    out.push({
      civilite: get(cols, "civilite") || "—",
      nom, prenom,
      dateNaissance: get(cols, "datenaissance") || get(cols, "naissance"),
      lieuNaissance: get(cols, "lieunaissance"),
      neph: get(cols, "neph"),
      adresse: get(cols, "adresse"),
      codePostal: get(cols, "codepostal") || get(cols, "cp"),
      ville: get(cols, "ville"),
      pays: get(cols, "pays") || "France",
      telephone: get(cols, "telephone") || get(cols, "téléphone") || get(cols, "tel"),
      email: get(cols, "email"),
      departementNaissance: get(cols, "departementnaissance"),
      paysNaissance: get(cols, "paysnaissance") || "France",
      datePremierPermis: get(cols, "datepremierpermis"),
    });
  }
  if (out.length === 0) throw new Error("Aucune ligne exploitable dans le CSV.");
  return out;
}

type ImportMode = "txt" | "json" | "rapido";

function AdminImport({
  onValidate,
}: {
  onValidate: (rows: ImportedStudent[]) => void;
}) {
  const [mode, setMode] = useState<ImportMode>("txt");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [students, setStudents] = useState<ImportedStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Rapido state
  const [rapidoKey, setRapidoKey] = useState("");
  const [rapidoEtab, setRapidoEtab] = useState("");
  const [rapidoEnabled, setRapidoEnabled] = useState(false);
  const [rapidoLoading, setRapidoLoading] = useState(false);

  const sortedPreview = useMemo(() => students, [students]);

  const reset = () => {
    setStudents([]);
    setFileName(null);
    setError(null);
  };

  const handleFile = (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    const isTxt = name.endsWith(".txt");
    const isJson = name.endsWith(".json");
    const isCsv = name.endsWith(".csv");
    if (mode === "txt" && !isTxt) {
      setError("Format invalide : fichier .txt requis.");
      setFileName(file.name); setStudents([]); return;
    }
    if (mode === "json" && !isJson && !isCsv) {
      setError("Format invalide : fichier .json ou .csv requis.");
      setFileName(file.name); setStudents([]); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");
        const parsed = isJson
          ? parseJsonStudents(text)
          : isCsv
            ? parseCsvStudents(text)
            : parseTxtTSV(text);
        setStudents(parsed);
        setFileName(file.name);
      } catch (err) {
        setStudents([]);
        setFileName(file.name);
        setError(err instanceof Error ? err.message : "Erreur de lecture");
      }
    };
    reader.onerror = () => setError("Impossible de lire le fichier.");
    reader.readAsText(file, "utf-8");
  };

  const launchImport = () => {
    if (students.length === 0) return;
    onValidate(students);
    reset();
  };

  const sortByDate = () => {
    if (students.length === 0) {
      toast.error("Sélectionnez d'abord un fichier.");
      return;
    }
    const dir = sortAsc ? 1 : -1;
    setStudents((prev) =>
      [...prev].sort(
        (a, b) => (parseDateFR(a.dateNaissance) - parseDateFR(b.dateNaissance)) * dir,
      ),
    );
    setSortAsc(!sortAsc);
    toast(`Tri par date de naissance (${sortAsc ? "croissant" : "décroissant"}).`);
  };

  const syncRapido = async () => {
    if (!rapidoEnabled) {
      toast.error("Activez d'abord la connexion API Rapido.");
      return;
    }
    setRapidoLoading(true);
    try {
      const { fetchRapidoStudents } = await import("@/lib/rapido");
      const list = await fetchRapidoStudents({ apiKey: rapidoKey, etablissementId: rapidoEtab });
      onValidate(list);
      toast.success(`${list.length} élève${list.length > 1 ? "s" : ""} synchronisé${list.length > 1 ? "s" : ""} avec succès depuis Rapido`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la synchronisation Rapido.");
    } finally {
      setRapidoLoading(false);
    }
  };

  const status = error
    ? { icon: <XCircle className="h-4 w-4" />, text: error, cls: "border-destructive/40 bg-destructive/10 text-destructive" }
    : students.length > 0
      ? { icon: <CheckCircle2 className="h-4 w-4" />, text: `Fichier chargé : ${students.length} élève${students.length > 1 ? "s" : ""} prêt${students.length > 1 ? "s" : ""} à importer`, cls: "border-primary/40 bg-primary/10 text-primary" }
      : { icon: <FileText className="h-4 w-4" />, text: fileName ?? "Aucun fichier chargé", cls: "border-border bg-secondary text-muted-foreground" };

  const acceptAttr = mode === "txt" ? ".txt,text/plain" : ".json,.csv,application/json,text/csv";

  const tabs: { id: ImportMode; label: string; icon: typeof FileText }[] = [
    { id: "txt", label: "EXPORT.TXT", icon: FileText },
    { id: "json", label: "JSON / CSV", icon: FileSpreadsheet },
    { id: "rapido", label: "API Rapido", icon: Database },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/15 to-card p-4">
        <p className="text-xs uppercase tracking-wider text-accent">Sources d'importation</p>
        <p className="mt-1 text-sm">
          Trois méthodes alimentent la même base élèves (persistée localement).
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setMode(t.id); reset(); }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {mode !== "rapido" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <FileUp className="h-4 w-4" />
              {mode === "txt" ? "📁 Sélectionner un fichier .txt" : "📁 Sélectionner un fichier .json / .csv"}
            </button>
            <button
              type="button"
              onClick={launchImport}
              disabled={students.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              Lancer l'import
            </button>
            <button
              type="button"
              onClick={sortByDate}
              disabled={students.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CalendarClock className="h-4 w-4" />
              Date
            </button>
          </div>

          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${status.cls}`}>
            {status.icon}
            <span className="truncate">{status.text}</span>
          </div>

          {mode === "json" && students.length === 0 && !error && (
            <p className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Clés JSON attendues : <code>nom</code>, <code>prenom</code>, <code>neph</code>, <code>telephone</code>, <code>email</code>, <code>adresse</code>, <code>ville</code>, <code>codePostal</code>, <code>dateNaissance</code>…
            </p>
          )}

          {sortedPreview.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Aperçu avant import ({sortedPreview.length})
                </p>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Civ.</th>
                      <th className="px-3 py-2 font-medium">Nom</th>
                      <th className="px-3 py-2 font-medium">Prénom</th>
                      <th className="px-3 py-2 font-medium">Naissance</th>
                      <th className="px-3 py-2 font-medium">NEPH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPreview.map((s, i) => (
                      <tr key={`${s.neph}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2">{s.civilite}</td>
                        <td className="px-3 py-2 font-semibold">{s.nom}</td>
                        <td className="px-3 py-2">{s.prenom}</td>
                        <td className="px-3 py-2">{s.dateNaissance}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{s.neph}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {mode === "rapido" && (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Connexion Synchronisée API Rapido</p>
              <p className="text-xs text-muted-foreground">Codes Rousseau · synchronisation des comptes élèves</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <span className="text-xs text-muted-foreground">{rapidoEnabled ? "Activé" : "Inactif"}</span>
              <input
                type="checkbox"
                checked={rapidoEnabled}
                onChange={(e) => setRapidoEnabled(e.target.checked)}
                className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-secondary transition checked:bg-primary"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Clé API Rapido</span>
              <input
                type="text"
                value={rapidoKey}
                onChange={(e) => setRapidoKey(e.target.value)}
                disabled={!rapidoEnabled}
                placeholder="rk_xxx..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Identifiant Établissement</span>
              <input
                type="text"
                value={rapidoEtab}
                onChange={(e) => setRapidoEtab(e.target.value)}
                disabled={!rapidoEnabled}
                placeholder="EP-SARCELLES-001"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={syncRapido}
            disabled={!rapidoEnabled || rapidoLoading || !rapidoKey.trim() || !rapidoEtab.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className={`h-4 w-4 ${rapidoLoading ? "animate-spin" : ""}`} />
            {rapidoLoading ? "Synchronisation…" : "🔄 Synchroniser via l'API Rapido"}
          </button>

          <p className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            Les élèves récupérés sont créés avec un profil vierge, un identifiant <code>prenom.nom</code> et un mot de passe temporaire basé sur le NEPH. Ils apparaissent immédiatement dans <strong>Gestion élèves</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
