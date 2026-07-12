import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth/auth.functions";
import { useEffect, useMemo, useState } from "react";
import {
  Home,
  ClipboardCheck,
  User,
  X,
  Check,
  MessageSquare,
  ChevronsUpDown,
  Search,
  Clock,
  Calendar,
  Car,
  TrendingUp,
  Award,
  Phone,
  Mail,
  MapPin,
  Users,
  Star,
  Sparkles,
  CheckCircle2,
  CircleDashed,
  PlayCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BottomNav, type TabItem } from "@/components/BottomNav";
import { INSTRUCTOR } from "@/lib/mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listStudents } from "@/lib/students/queries";
import {
  addAppreciation,
  formatShortDate,
  getAppreciations,
  type Appreciation,
} from "@/lib/appreciations";

export const Route = createFileRoute("/instructor")({
  head: () => ({ meta: [{ title: "Espace Moniteur — Euro-Permis Sarcelles" }] }),
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "instructor") throw redirect({ to: "/" });
  },
  component: InstructorApp,
});

type Tab = "home" | "validate" | "profile";

const TABS: TabItem<Tab>[] = [
  { id: "home", label: "Journée", icon: Home },
  { id: "validate", label: "Appréciations", icon: ClipboardCheck },
  { id: "profile", label: "Profil", icon: User },
];

function InstructorApp() {
  const [tab, setTab] = useState<Tab>("home");
  const titles: Record<Tab, string> = {
    home: "Ma journée",
    validate: "Appréciations élèves",
    profile: "Mon profil",
  };
  return (
    <>
      <AppShell title={titles[tab]} subtitle={`Moniteur · ${INSTRUCTOR.fullName}`}>
        {tab === "home" && <InstructorHome />}
        {tab === "validate" && <InstructorAppreciations />}
        {tab === "profile" && <InstructorProfile />}
      </AppShell>
      <BottomNav items={TABS} active={tab} onChange={setTab} />
    </>
  );
}

function statusBadge(s: string) {
  if (s === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
        <CheckCircle2 className="h-3 w-3" /> Terminé
      </span>
    );
  if (s === "current")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
        <PlayCircle className="h-3 w-3" /> En cours
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <CircleDashed className="h-3 w-3" /> À venir
    </span>
  );
}

type LessonItem = (typeof INSTRUCTOR.today)[number];

function InstructorHome() {
  const [openLesson, setOpenLesson] = useState<LessonItem | null>(null);

  const stats = useMemo(() => {
    const done = INSTRUCTOR.today.filter((l) => l.status === "done").length;
    const current = INSTRUCTOR.today.filter((l) => l.status === "current").length;
    const upcoming = INSTRUCTOR.today.filter((l) => l.status === "upcoming").length;
    const hours = INSTRUCTOR.today.reduce((acc, l) => {
      const m = l.time.match(/(\d{2}):\d{2}\s*[–-]\s*(\d{2}):\d{2}/);
      return acc + (m ? Number(m[2]) - Number(m[1]) : 0);
    }, 0);
    return { done, current, upcoming, hours, total: INSTRUCTOR.today.length };
  }, []);

  const nextLesson =
    INSTRUCTOR.today.find((l) => l.status === "current") ??
    INSTRUCTOR.today.find((l) => l.status === "upcoming");

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Hero du jour */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/25 via-card to-card p-5 shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" /> Aujourd'hui
              </p>
              <p className="mt-1 text-lg font-bold capitalize">{today}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/20 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
          </div>

          {/* Progression de la journée */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Progression journée</span>
              <span className="font-semibold text-foreground">{progress}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <StatPill icon={<Car className="h-3.5 w-3.5" />} label="Cours" value={stats.total} />
            <StatPill icon={<Clock className="h-3.5 w-3.5" />} label="Heures" value={`${stats.hours}h`} />
            <StatPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Faits" value={stats.done} tone="success" />
            <StatPill icon={<CircleDashed className="h-3.5 w-3.5" />} label="Restant" value={stats.current + stats.upcoming} tone="accent" />
          </div>
        </div>
      </div>

      {/* Prochain cours */}
      {nextLesson && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                {nextLesson.status === "current" ? "En cours" : "Prochain cours"}
              </p>
              <p className="text-sm font-semibold">{nextLesson.student}</p>
              <p className="text-xs text-muted-foreground">{nextLesson.time} · {nextLesson.type}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpenLesson(nextLesson)}
              className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
            >
              Ouvrir
            </button>
          </div>
        </div>
      )}

      {/* Planning timeline */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Planning du jour
          </h2>
          <span className="text-[11px] text-muted-foreground">{stats.total} cours</span>
        </div>
        <ol className="relative space-y-2 pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {INSTRUCTOR.today.map((l) => {
            const dotTone =
              l.status === "done"
                ? "bg-success border-success"
                : l.status === "current"
                  ? "bg-accent border-accent ring-4 ring-accent/20"
                  : "bg-card border-border";
            return (
              <li key={l.id} className="relative">
                <span
                  className={`absolute -left-[14px] top-5 h-3 w-3 rounded-full border-2 ${dotTone}`}
                />
                <button
                  type="button"
                  onClick={() => setOpenLesson(l)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
                >
                  <div className="grid w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-secondary to-secondary/40 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">heure</p>
                    <p className="text-sm font-bold text-primary">{l.time.split(" ")[0]}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{l.student}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Car className="h-3 w-3" />
                      <span className="truncate">{l.type}</span>
                      <span className="mx-1 opacity-50">·</span>
                      <Clock className="h-3 w-3" />
                      <span>{l.time}</span>
                    </p>
                  </div>
                  {statusBadge(l.status)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {openLesson && (
        <LessonValidationModal lesson={openLesson} onClose={() => setOpenLesson(null)} />
      )}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "primary" | "success" | "accent";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "accent"
        ? "text-accent"
        : "text-primary";
  return (
    <div className="rounded-xl bg-background/40 px-2 py-2 backdrop-blur">
      <div className={`flex items-center gap-1 ${toneClass}`}>{icon}</div>
      <p className="mt-1 text-base font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function LessonValidationModal({
  lesson,
  onClose,
}: {
  lesson: LessonItem;
  onClose: () => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [signed, setSigned] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl">
        {confirmed ? (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
              <Check className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Cours validé !</p>
            <p className="text-sm text-muted-foreground">Le livret de l'élève a été mis à jour.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary">Élève</p>
                <p className="mt-1 text-base font-semibold">{lesson.student}</p>
                <p className="text-xs text-muted-foreground">{lesson.time} · {lesson.type}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold">Compétences travaillées</h2>
              <ul className="space-y-2">
                {INSTRUCTOR.skills.map((s) => {
                  const on = !!checks[s];
                  return (
                    <li key={s}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setChecks((c) => ({ ...c, [s]: e.target.checked }))}
                          className="peer sr-only"
                        />
                        <span className={`grid h-5 w-5 place-items-center rounded-md border ${on ? "border-primary bg-primary" : "border-border bg-background"}`}>
                          {on && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                        </span>
                        <span className="text-sm">{s}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <h2 className="mb-2 text-sm font-semibold">Signature de l'élève</h2>
              <button
                type="button"
                onClick={() => setSigned((s) => !s)}
                className={`grid h-28 w-full place-items-center rounded-xl border-2 border-dashed text-sm font-medium transition-colors ${
                  signed
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {signed ? "✍ Signature capturée — appuyer pour effacer" : "Appuyer pour signer ici"}
              </button>
            </div>

            <button
              type="button"
              disabled={!signed}
              onClick={() => setConfirmed(true)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Valider le cours
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InstructorAppreciations() {
  const [list, setList] = useState<Appreciation[]>([]);
  const [studentName, setStudentName] = useState(INSTRUCTOR.today[0]?.student ?? "");
  const [type, setType] = useState(INSTRUCTOR.today[0]?.type ?? "Conduite");
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  const [storedStudents, setStoredStudents] = useState<{ prenom: string; nom: string }[]>([]);

  useEffect(() => {
    setList(getAppreciations());
    listStudents()
      .then((rows) => setStoredStudents(rows.map((s) => ({ prenom: s.prenom, nom: s.nom }))))
      .catch(() => setStoredStudents([]));
  }, []);

  // Liste fusionnée : élèves importés/stockés + planning du jour + historique des appréciations
  const studentOptions = useMemo(() => {
    const set = new Set<string>();
    storedStudents.forEach((s) => {
      const name = `${s.prenom ?? ""} ${s.nom ?? ""}`.trim();
      if (name) set.add(name);
    });
    INSTRUCTOR.today.forEach((l) => l.student && set.add(l.student));
    list.forEach((a) => a.studentName && set.add(a.studentName));
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
  }, [storedStudents, list]);

  const submit = () => {
    if (!studentName.trim() || !comment.trim()) return;
    addAppreciation({
      studentName: studentName.trim(),
      type: type.trim() || "Conduite",
      instructor: shortName(INSTRUCTOR.fullName),
      date: formatShortDate(),
      comment: comment.trim(),
    });
    setList(getAppreciations());
    setComment("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Nouvelle appréciation</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Élève
            </label>
            <StudentCombobox
              value={studentName}
              options={studentOptions}
              onChange={setStudentName}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Type de cours
            </label>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Conduite urbaine, Manœuvres…"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Appréciation
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Bonne gestion du gabarit, attention aux angles morts…"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!studentName.trim() || !comment.trim()}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saved ? "✓ Appréciation enregistrée" : "Enregistrer l'appréciation"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Livret d'apprentissage — historique</h2>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune appréciation enregistrée pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((h) => (
              <li key={h.id} className="rounded-xl bg-secondary p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{h.type}</p>
                  <span className="text-[11px] text-muted-foreground">{h.date}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Élève : {h.studentName} · Moniteur : {h.instructor}
                </p>
                <p className="mt-2 text-sm italic text-foreground/90">« {h.comment} »</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function InstructorProfile() {
  const initials = INSTRUCTOR.fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const specialties = [
    "Boîte manuelle",
    "Boîte auto",
    "Conduite accompagnée",
    "Examen blanc",
    "Conduite de nuit",
    "Autoroute",
  ];

  const reviews = [
    { name: "Léa M.", note: 5, text: "Très pédagogue, met en confiance dès la première leçon." },
    { name: "Hugo P.", note: 5, text: "Explications claires, j'ai progressé très vite." },
    { name: "Sara El M.", note: 4, text: "Bons conseils pour l'examen, merci !" },
  ];

  return (
    <div className="space-y-4">
      {/* Carte identité */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="h-20 bg-gradient-to-br from-primary via-primary/60 to-accent" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-card bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
              {initials}
            </div>
            <div className="pb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                <CheckCircle2 className="h-3 w-3" /> Actif
              </span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold">{INSTRUCTOR.fullName}</p>
            <p className="text-xs text-muted-foreground">@{INSTRUCTOR.username}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Award className="h-3.5 w-3.5 text-accent" />
              Moniteur diplômé — BEPECASER
            </p>
          </div>

          <div className="mt-4 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i <= 4 ? "fill-accent text-accent" : "fill-accent/60 text-accent"}`}
              />
            ))}
            <span className="ml-1 text-sm font-semibold">4.9</span>
            <span className="text-xs text-muted-foreground">/ 5 · 87 avis</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <ProfileStat icon={<Users className="h-4 w-4" />} value="42" label="Élèves suivis" />
        <ProfileStat icon={<Clock className="h-4 w-4" />} value="1 248h" label="Heures données" tone="accent" />
        <ProfileStat icon={<TrendingUp className="h-4 w-4" />} value="91%" label="Réussite" tone="success" />
      </div>

      {/* Coordonnées */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Coordonnées
        </h2>
        <ul className="space-y-2.5">
          <ContactRow icon={<Phone className="h-4 w-4" />} label="Téléphone" value="06 12 34 56 78" />
          <ContactRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={`${INSTRUCTOR.username}@europermis-sarcelles.fr`}
          />
          <ContactRow
            icon={<MapPin className="h-4 w-4" />}
            label="Agence"
            value="Euro-Permis Sarcelles"
          />
        </ul>
      </div>

      {/* Spécialités */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Spécialités
        </h2>
        <div className="flex flex-wrap gap-2">
          {specialties.map((s) => (
            <span
              key={s}
              className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Avis récents */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> Derniers avis élèves
        </h2>
        <ul className="space-y-2.5">
          {reviews.map((r) => (
            <li key={r.name} className="rounded-xl bg-secondary p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{r.name}</p>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: r.note }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-accent text-accent" />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs italic text-foreground/85">« {r.text} »</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProfileStat({
  icon,
  value,
  label,
  tone = "primary",
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: "primary" | "success" | "accent";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className={`flex items-center gap-1 ${toneClass}`}>{icon}</div>
      <p className="mt-2 text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </li>
  );
}

function normalizeText(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function StudentCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return options;
    return options.filter((o) => normalizeText(o).includes(q));
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value || "Sélectionnez un élève…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un élève…"
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              {options.length === 0
                ? "Aucun élève. Importez un fichier .txt côté admin."
                : "Aucun résultat."}
            </div>
          ) : (
            filtered.map((s) => {
              const selected = s === value;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition ${
                    selected ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                  }`}
                >
                  <span className="truncate">{s}</span>
                  {selected && <Check className="h-4 w-4" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
