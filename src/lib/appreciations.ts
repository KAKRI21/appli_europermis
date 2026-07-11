export const APPRECIATIONS_STORAGE_KEY = "europermis.appreciations.v1";

export type Appreciation = {
  id: string;
  studentName: string;
  type: string;
  instructor: string;
  date: string;
  comment: string;
  createdAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAppreciations(): Appreciation[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(APPRECIATIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Appreciation[]) : [];
  } catch {
    return [];
  }
}

export function saveAppreciations(list: Appreciation[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(APPRECIATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function addAppreciation(a: Omit<Appreciation, "id" | "createdAt">) {
  const list = getAppreciations();
  const entry: Appreciation = {
    ...a,
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  saveAppreciations([entry, ...list]);
  return entry;
}

export function formatShortDate(d = new Date()) {
  const days = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${days[d.getDay()]} ${dd}/${mm}`;
}

export function getAppreciationsForStudent(displayName: string): Appreciation[] {
  const norm = displayName.trim().toLowerCase();
  if (!norm) return [];
  return getAppreciations().filter((a) => {
    const an = a.studentName.trim().toLowerCase();
    if (an === norm) return true;
    // Loose match: "Yanis K." matches "Yanis Kettani"
    const [first] = norm.split(" ");
    const [afirst] = an.split(" ");
    return first && afirst && first === afirst;
  });
}
