import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  CalendarDays,
  CreditCard,
  User,
  Phone,
  MapPin,
  Clock,
  Plus,
  CheckCircle2,
  Circle,
  FileText,
  Download,
  MessageSquare,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BottomNav, type TabItem } from "@/components/BottomNav";
import { SCHOOL, STUDENT, PRICING } from "@/lib/mock-data";
import { getCurrentUser } from "@/lib/auth/auth.functions";
import { getMyStudentProfile, type StudentRecord } from "@/lib/students/queries";
import { getAppreciationsForStudent } from "@/lib/appreciations";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Espace Élève — Euro-Permis Sarcelles" }] }),
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") throw redirect({ to: "/" });
  },
  component: StudentApp,
});

type Tab = "home" | "planning" | "payment" | "profile";

const TABS: TabItem<Tab>[] = [
  { id: "home", label: "Accueil", icon: Home },
  { id: "planning", label: "Planning", icon: CalendarDays },
  { id: "payment", label: "Paiement", icon: CreditCard },
  { id: "profile", label: "Profil", icon: User },
];

function StudentApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);
  useEffect(() => {
    getMyStudentProfile().then(setActiveStudent).catch(() => setActiveStudent(null));
  }, []);
  const firstName = activeStudent?.prenom || "Jean";
  const titles: Record<Tab, string> = {
    home: `Bonjour ${firstName} 👋`,
    planning: "Mon planning",
    payment: "Paiement & tarifs",
    profile: "Mon profil",
  };
  return (
    <>
      <AppShell title={titles[tab]} subtitle="Espace Élève">
        {tab === "home" && <StudentHome student={activeStudent} />}
        {tab === "planning" && <StudentPlanning student={activeStudent} />}
        {tab === "payment" && <StudentPayment student={activeStudent} />}
        {tab === "profile" && <StudentProfile student={activeStudent} />}
      </AppShell>
      <BottomNav items={TABS} active={tab} onChange={setTab} />
    </>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>{children}</div>
  );
}

function fullName(student: StudentRecord | null) {
  return student ? `${student.prenom} ${student.nom}`.trim() : STUDENT.fullName;
}

function initials(student: StudentRecord | null) {
  return student ? `${student.prenom[0] ?? ""}${student.nom[0] ?? ""}`.toUpperCase() : "JD";
}

function parseHours(hours?: string | null) {
  const match = (hours ?? "").match(/^(\d+)\/(\d+)/);
  if (!match) return { done: STUDENT.hoursDone, total: STUDENT.hoursTotal };
  return { done: Number(match[1]), total: Number(match[2]) || STUDENT.hoursTotal };
}

function ProfileLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value || "—"}</span>
    </div>
  );
}

// Tant qu'une fiche élève réelle est chargée, on masque le contenu de
// démonstration (planning fictif, solde fictif, livret fictif...) — ces
// fonctionnalités ne sont pas encore branchées sur de vraies données.
// `isReal` remplace l'ancienne notion `source === "import"`.
function StudentHome({ student }: { student: StudentRecord | null }) {
  const isReal = !!student;
  const { done, total } = parseHours(student?.hours);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const address = [student?.adresse, student?.codePostal, student?.ville]
    .filter(Boolean)
    .join(", ");
  const balance = isReal ? 0 : STUDENT.balance;
  return (
    <div className="space-y-4">
      {isReal ? (
        <Card className="bg-gradient-to-br from-muted/40 to-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Prochain cours</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Aucun cours programmé pour le moment.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contactez le secrétariat pour planifier votre première leçon.
          </p>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-primary/25 to-card">
          <p className="text-xs uppercase tracking-wider text-primary">Prochain cours</p>
          <p className="mt-1 text-lg font-semibold">{STUDENT.nextLesson.date}</p>
          <p className="text-sm text-muted-foreground">
            {STUDENT.nextLesson.time} · {STUDENT.nextLesson.instructor}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{STUDENT.nextLesson.place}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted-foreground">Heures effectuées</p>
          <p className="mt-1 text-2xl font-bold">
            {done}
            <span className="text-sm font-medium text-muted-foreground">/{total}h</span>
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Solde</p>
          <p className="mt-1 text-2xl font-bold">{balance} €</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {isReal ? "Aucune transaction" : "Crédit disponible"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          href={SCHOOL.phoneHref}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Phone className="h-4 w-4" /> Appeler
        </a>
        <a
          href={SCHOOL.mapsHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          <MapPin className="h-4 w-4" /> Itinéraire
        </a>
      </div>

      {student && (
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Dossier connecté</h2>
          </div>
          <p className="text-sm font-semibold">{student.civilite} {fullName(student)}</p>
          <p className="mt-1 text-xs text-muted-foreground">NEPH : {student.neph || "—"}</p>
          {address && <p className="mt-1 text-xs text-muted-foreground">{address}</p>}
        </Card>
      )}

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Horaires bureau</h2>
        </div>
        <ul className="divide-y divide-border text-sm">
          {SCHOOL.hours.map((h) => (
            <li key={h.day} className="flex justify-between py-2">
              <span className="text-muted-foreground">{h.day}</span>
              <span className="text-right font-medium">{h.time}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Horaires conduite</h2>
        </div>
        <ul className="divide-y divide-border text-sm">
          {SCHOOL.drivingHours.map((h) => (
            <li key={h.day} className="flex justify-between py-2">
              <span className="text-muted-foreground">{h.day}</span>
              <span className="text-right font-medium">{h.time}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StudentPlanning({ student }: { student: StudentRecord | null }) {
  const isReal = !!student;
  const name = fullName(student);
  const upcoming = isReal ? [] : STUDENT.upcoming;
  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs text-muted-foreground">Semaine en cours</p>
        <p className="mt-1 text-base font-semibold">26 mai – 1 juin 2026</p>
        {student && <p className="mt-1 text-xs text-muted-foreground">Planning de {name}</p>}
      </Card>
      {upcoming.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun cours programmé pour le moment.
        </div>
      ) : (
        upcoming.map((l, i) => (
          <Card key={i} className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{l.type}</p>
              <p className="text-xs text-muted-foreground">
                {l.date} · {l.time} · {l.instructor}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              À venir
            </span>
          </Card>
        ))
      )}
    </div>
  );
}

function StudentPayment({ student }: { student: StudentRecord | null }) {
  const isReal = !!student;
  const [bought, setBought] = useState(0);
  const baseBalance = isReal ? 0 : STUDENT.balance;
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-accent/25 to-card">
        <p className="text-xs uppercase tracking-wider text-accent">Solde financier</p>
        <p className="mt-1 text-3xl font-bold">{baseBalance + bought * 60} €</p>
        <p className="text-xs text-muted-foreground">Mis à jour à l'instant</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Heures supplémentaires</h2>
        <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
          <div>
            <p className="text-sm font-medium">1 heure de conduite</p>
            <p className="text-xs text-muted-foreground">60 € · facturée à la séance</p>
          </div>
          <button
            type="button"
            onClick={() => setBought((b) => b + 1)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Acheter
          </button>
        </div>
        {bought > 0 && (
          <p className="mt-2 text-xs text-success">
            ✓ {bought} h ajoutée{bought > 1 ? "s" : ""} (simulation)
          </p>
        )}
      </Card>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold">Grille tarifaire</h2>
        <div className="space-y-2">
          {(() => {
            const grouped = new Map<number, typeof PRICING[number][]>();
            PRICING.forEach((p) => {
              const list = grouped.get(p.price) || [];
              list.push(p);
              grouped.set(p.price, list);
            });
            return Array.from(grouped.entries()).map(([price, items]) => (
              <Card key={price} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {items.map((p) => (
                    <div key={p.id} className={items.length > 1 ? "border-b border-border/60 py-1.5 last:border-b-0 last:pb-0 first:pt-0" : ""}>
                      <p className="text-sm font-medium">{p.title}</p>
                      {p.badge && (
                        <span className="mt-0.5 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          {p.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="shrink-0 text-base font-bold text-primary">{price} €</p>
              </Card>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

function StudentProfile({ student }: { student: StudentRecord | null }) {
  const isReal = !!student;
  const name = fullName(student);
  const skills = isReal
    ? STUDENT.skills.map((s) => ({ ...s, done: false }))
    : STUDENT.skills;
  const documents = isReal ? [] : STUDENT.documents;
  const displayName = `${student?.prenom ?? ""} ${student?.nom ?? ""}`.trim() || (isReal ? "" : "Jean Dupont");
  const extra = getAppreciationsForStudent(displayName).map((a) => ({
    date: a.date,
    type: a.type,
    instructor: a.instructor,
    comment: a.comment,
  }));
  const baseHistory = isReal ? [] : STUDENT.history;
  const history = [...extra, ...baseHistory];
  const address = [student?.adresse, student?.codePostal, student?.ville, student?.pays]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {initials(student)}
        </div>
        <div>
          <p className="text-base font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">@{student?.username ?? STUDENT.username}</p>
          <p className="text-xs text-muted-foreground">NEPH : {student?.neph || STUDENT.neph}</p>
        </div>
      </Card>

      {student && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Informations du dossier</h2>
          <div className="space-y-2 text-sm">
            <ProfileLine label="Civilité" value={student.civilite} />
            <ProfileLine label="Date de naissance" value={student.dateNaissance} />
            <ProfileLine label="Lieu de naissance" value={student.lieuNaissance} />
            {student.departementNaissance && <ProfileLine label="Département" value={student.departementNaissance} />}
            {student.paysNaissance && <ProfileLine label="Pays naissance" value={student.paysNaissance} />}
            {address && <ProfileLine label="Adresse" value={address} />}
            {student.telephone && <ProfileLine label="Téléphone" value={student.telephone} />}
            {student.email && <ProfileLine label="Email" value={student.email} />}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Livret pédagogique{isReal && <span className="ml-2 text-[10px] font-normal text-muted-foreground">· 0 % de progression</span>}
        </h2>
        <ul className="space-y-2">
          {skills.map((s) => (
            <li key={s.name} className="flex items-center gap-2 text-sm">
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={s.done ? "" : "text-muted-foreground"}>{s.name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Mes documents</h2>
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun document. Déposez vos pièces auprès du secrétariat.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li
                key={d.name}
                className="flex items-center gap-3 rounded-xl bg-secondary p-3"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground">{d.size}</p>
                </div>
                {d.status === "valid" ? (
                  <span className="rounded-full bg-success/15 px-2 py-1 text-[10px] font-semibold uppercase text-success">
                    Validé ✔
                  </span>
                ) : (
                  <span className="rounded-full bg-accent/20 px-2 py-1 text-[10px] font-semibold uppercase text-accent">
                    En attente ⏳
                  </span>
                )}
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
                  aria-label={`Télécharger ${d.name}`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Livret d'apprentissage — historique</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun commentaire de moniteur pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((h, i) => (
              <li key={i} className="rounded-xl bg-secondary p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{h.type}</p>
                  <span className="text-[11px] text-muted-foreground">{h.date}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Moniteur : {h.instructor}</p>
                <p className="mt-2 text-sm italic text-foreground/90">« {h.comment} »</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
