import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Columns3,
  Building2,
  CalendarDays,
  Repeat,
  Sprout,
  FileUp,
  Users,
  ScrollText,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/funil", label: "Funil de vendas", icon: Columns3 },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/cadencias", label: "Cadências", icon: Repeat },
  { to: "/nutricao", label: "Nutrição", icon: Sprout },
  { to: "/importar-exportar", label: "Importar/Exportar", icon: FileUp },
];

// Itens visíveis apenas para administradores (gestão de equipe e auditoria).
// O backend já impõe essa restrição em cada rota (requireAdmin); aqui é só
// para não poluir o menu de vendedores com telas às quais não têm acesso.
const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
];

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
  const { data: me } = useCurrentUser();
  const items = me?.role === "admin" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-navy-800 text-navy-50 transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          "md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && <span className="truncate text-sm font-bold tracking-wide">CRM RS LOG</span>}
          <button
            type="button"
            onClick={onToggle}
            className="hidden rounded-md p-1.5 text-navy-200 hover:bg-navy-700 hover:text-white md:block"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-navy-600 text-white" : "text-navy-200 hover:bg-navy-700 hover:text-white"
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="border-t border-navy-700 px-3 py-3 text-xs text-navy-300">RS LOG · Prospecção ativa</div>
        )}
      </aside>
    </>
  );
}
