import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout/Layout";
import { AuthGate } from "@/components/Layout/AuthGate";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { DashboardPage } from "@/pages/DashboardPage";
import { KanbanPage } from "@/pages/KanbanPage";
import { CompaniesPage } from "@/pages/CompaniesPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { CadencesPage } from "@/pages/CadencesPage";
import { NutritionPage } from "@/pages/NutritionPage";
import { UsersPage } from "@/pages/UsersPage";
import { AuditLogPage } from "@/pages/AuditLogPage";

// Carregada sob demanda: esta página embute a biblioteca de planilhas
// (SheetJS), que é pesada e só é necessária quando o usuário realmente
// acessa a tela de importação/exportação — evita inflar o bundle principal.
const ImportExportPage = lazy(() => import("@/pages/ImportExportPage").then((m) => ({ default: m.ImportExportPage })));

export function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/funil" element={<KanbanPage />} />
          <Route path="/empresas" element={<CompaniesPage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/cadencias" element={<CadencesPage />} />
          <Route path="/nutricao" element={<NutritionPage />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/auditoria" element={<AuditLogPage />} />
          <Route
            path="/importar-exportar"
            element={
              <Suspense fallback={<LoadingSpinner label="Carregando..." />}>
                <ImportExportPage />
              </Suspense>
            }
          />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </AuthGate>
  );
}
