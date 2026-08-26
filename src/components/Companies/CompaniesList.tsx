import { Fragment, useState } from "react";
import type { Company } from "@/lib/types";
import { ContactsList } from "@/components/Contacts/ContactsList";
import { useCompany } from "@/hooks/useCompanies";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

interface CompaniesListProps {
  companies: Company[];
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
}

export function CompaniesList({ companies, onEdit, onDelete }: CompaniesListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Cidade/UF</th>
            <th className="px-4 py-3 font-medium">Responsável</th>
            <th className="px-4 py-3 font-medium">Contatos</th>
            <th className="px-4 py-3 font-medium">Oportunidades</th>
            <th className="px-4 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {companies.map((company) => (
            <Fragment key={company.id}>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    className="font-medium text-navy-700 hover:underline"
                    onClick={() => setExpandedId((prev) => (prev === company.id ? null : company.id))}
                  >
                    {company.name}
                  </button>
                  {company.segment && <p className="text-xs text-slate-400">{company.segment}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {[company.city, company.state].filter(Boolean).join("/") || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{company.owner_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{company.contacts_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-600">{company.opportunities_count ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-xs">
                    <button className="text-navy-600 hover:underline" onClick={() => onEdit(company)}>
                      Editar
                    </button>
                    <button className="text-red-600 hover:underline" onClick={() => onDelete(company)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
              {expandedId === company.id && (
                <tr>
                  <td colSpan={6} className="bg-slate-50 px-4 py-4">
                    <ExpandedContacts companyId={company.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpandedContacts({ companyId }: { companyId: string }) {
  const { data, isLoading } = useCompany(companyId);
  if (isLoading) return <LoadingSpinner label="Carregando contatos..." />;
  if (!data) return null;
  return <ContactsList companyId={companyId} contacts={data.contacts} />;
}
