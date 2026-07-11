import { type LucideIcon } from "lucide-react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
};

export function BottomNav<T extends string>({ items, active, onChange }: Props<T>) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = it.id === active;
          return (
            <li key={it.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(it.id)}
                className={`flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                    isActive ? "bg-primary/15" : "bg-transparent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
