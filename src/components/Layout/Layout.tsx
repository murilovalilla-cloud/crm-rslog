import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/funil": "Funil de vendas",
  "/empresas": "Empresas",
  "/calendario": "Calendário",
  "/cadencias": "Cadências de prospecção",
  "/nutricao": "Nutrição de leads",
  "/importar-exportar": "Importar / Exportar",
  "/usuarios": "Usuários da equipe",
  "/auditoria": "Trilha de auditoria",
};

function getStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem("crm-sidebar-collapsed") === "1";
  } catch {
    return false;
  }
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = TITLES[location.pathname] ?? "CRM RS LOG";

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("crm-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ambiente sem localStorage disponível — segue sem persistir a preferência */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
