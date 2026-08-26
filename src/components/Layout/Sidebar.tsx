import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/funil", label: "Funil de vendas", icon: "🗂️" },
  { to: "/empresas", label: "Empresas", icon: "🏢" },
  { to: "/calendario", label: "Calendário", icon: "📅" },
  { to: "/cadencias", label: "Cadências", icon: "🔁" },
  { to: "/nutricao", label: "Nutrição", icon: "🌱" },
  { to: "/importar-exportar", label: "Importar/Exportar", icon: "📁" },
];

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
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
            className="hidden rounded-md p-1.5 text-navy-200 hover:bg-navy-700 md:block"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-2">
          {NAV_ITEMS.map((item) => (
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
              <span aria-hidden="true">{item.icon}</span>
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
