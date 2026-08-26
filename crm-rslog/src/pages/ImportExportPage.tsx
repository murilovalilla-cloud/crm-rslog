import { useMemo, useState, type ChangeEvent } from "react";
import { useImportPreview, useImportCommit, useImportHistory, triggerExport, type ExportEntity, type ExportFormat } from "@/hooks/useImportExport";
import { IMPORT_ENTITY_LABELS, IMPORT_ENTITY_NOTES, IMPORT_FIELDS } from "@/lib/importFields";
import { applyColumnMapping, guessMapping, parseSpreadsheetFile, type ParsedSheet } from "@/lib/spreadsheet";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ImportEntity, ImportPreviewResponse, ImportRowResult } from "@/lib/types";

type Step = "select" | "mapping" | "preview" | "done";

const EXPORT_ENTITIES: Array<{ key: ExportEntity; label: string }> = [
  { key: "companies", label: "Empresas" },
  { key: "contacts", label: "Contatos" },
  { key: "opportunities", label: "Oportunidades" },
  { key: "activities", label: "Atividades" },
  { key: "quotes", label: "Cotações" },
  { key: "nutrition-leads", label: "Leads em nutrição" },
];

function RowResultBadge({ action }: { action: ImportRowResult["action"] }) {
  const classes: Record<ImportRowResult["action"], string> = {
    create: "bg-green-50 text-alert-done border border-green-200",
    update: "bg-blue-50 text-alert-upcoming border border-blue-200",
    error: "bg-red-50 text-alert-overdue border border-red-200",
  };
  const labels: Record<ImportRowResult["action"], string> = { create: "Criar", update: "Atualizar", error: "Erro" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[action]}`}>{labels[action]}</span>;
}

function PreviewTable({ rows }: { rows: ImportRowResult[] }) {
  const visible = rows.slice(0, 300);
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="text-left text-xs uppercase text-slate-400">
            <th className="px-3 py-2">Linha</th>
            <th className="px-3 py-2">Ação</th>
            <th className="px-3 py-2">Registro</th>
            <th className="px-3 py-2">Erros</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.index} className="border-t border-slate-100">
              <td className="px-3 py-1.5 text-slate-400">{row.index + 1}</td>
              <td className="px-3 py-1.5">
                <RowResultBadge action={row.action} />
              </td>
              <td className="px-3 py-1.5 text-slate-700">{row.label}</td>
              <td className="px-3 py-1.5 text-red-600">{row.errors.join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visible.length && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
          Exibindo {visible.length} de {rows.length} linhas.
        </p>
      )}
    </div>
  );
}

function SummaryBadges({ summary }: { summary: ImportPreviewResponse["summary"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center">
        <p className="text-lg font-semibold text-slate-800">{summary.total}</p>
        <p className="text-xs text-slate-500">Total de linhas</p>
      </div>
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center">
        <p className="text-lg font-semibold text-alert-done">{summary.to_create}</p>
        <p className="text-xs text-slate-500">A criar</p>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-center">
        <p className="text-lg font-semibold text-alert-upcoming">{summary.to_update}</p>
        <p className="text-xs text-slate-500">A atualizar</p>
      </div>
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
        <p className="text-lg font-semibold text-alert-overdue">{summary.errors}</p>
        <p className="text-xs text-slate-500">Com erro (ignoradas)</p>
      </div>
    </div>
  );
}

function ImportWizard() {
  const [entity, setEntity] = useState<ImportEntity>("companies");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>("select");
  const [parseError, setParseError] = useState<string | null>(null);

  const previewMutation = useImportPreview();
  const commitMutation = useImportCommit();

  const fields = IMPORT_FIELDS[entity];
  const mappedRows = useMemo(() => (parsed ? applyColumnMapping(parsed.rows, mapping) : []), [parsed, mapping]);
  const requiredMissing = fields.filter((f) => f.required && !mapping[f.key]);

  const resetAll = () => {
    setFileName(null);
    setParsed(null);
    setMapping({});
    setStep("select");
    setParseError(null);
    previewMutation.reset();
    commitMutation.reset();
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const sheet = await parseSpreadsheetFile(file);
      if (sheet.rows.length === 0) {
        setParseError("A planilha não tem linhas de dados (ou a primeira linha não foi reconhecida como cabeçalho).");
        return;
      }
      setFileName(file.name);
      setParsed(sheet);
      setMapping(guessMapping(sheet.headers, fields));
      setStep("mapping");
    } catch {
      setParseError("Não foi possível ler este arquivo. Verifique se é um .xlsx, .xls ou .csv válido.");
    }
  };

  const runPreview = () => {
    if (!fileName) return;
    previewMutation.mutate(
      { entity_type: entity, file_name: fileName, rows: mappedRows },
      { onSuccess: () => setStep("preview") }
    );
  };

  const runCommit = () => {
    if (!fileName) return;
    commitMutation.mutate(
      { entity_type: entity, file_name: fileName, rows: mappedRows },
      { onSuccess: () => setStep("done") }
    );
  };

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Importar planilha</h2>
        <p className="text-sm text-slate-500">Envie um arquivo .xlsx ou .csv, mapeie as colunas e confira a prévia antes de confirmar.</p>
      </div>

      {step === "select" && (
        <div className="space-y-3">
          <div className="max-w-xs">
            <Select
              label="O que deseja importar?"
              options={(Object.keys(IMPORT_ENTITY_LABELS) as ImportEntity[]).map((key) => ({ value: key, label: IMPORT_ENTITY_LABELS[key] }))}
              value={entity}
              onChange={(e) => setEntity(e.target.value as ImportEntity)}
            />
          </div>
          <p className="text-xs text-slate-500">{IMPORT_ENTITY_NOTES[entity]}</p>
          <div>
            <label className="field-label">Arquivo (.xlsx, .xls ou .csv)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-navy-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-navy-700"
            />
          </div>
          {parseError && <p className="text-sm text-red-600">{parseError}</p>}
        </div>
      )}

      {step === "mapping" && parsed && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-medium">{fileName}</span> · {parsed.rows.length} linha(s) detectada(s) · importando como{" "}
              <span className="font-medium">{IMPORT_ENTITY_LABELS[entity]}</span>
            </p>
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={resetAll}>
              Trocar arquivo
            </button>
          </div>

          <div className="space-y-2">
            {fields.map((field) => (
              <div key={field.key} className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr,1fr]">
                <label className="text-sm text-slate-700">
                  {field.label}
                  {field.required && <span className="ml-1 text-red-500">*</span>}
                </label>
                <Select
                  placeholder="Não mapear"
                  options={parsed.headers.map((h) => ({ value: h, label: h }))}
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {requiredMissing.length > 0 && (
            <p className="text-sm text-red-600">
              Mapeie os campos obrigatórios: {requiredMissing.map((f) => f.label).join(", ")}.
            </p>
          )}
          {previewMutation.isError && (
            <p className="text-sm text-red-600">
              {previewMutation.error instanceof ApiError ? previewMutation.error.message : "Erro ao gerar a prévia."}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={resetAll}>
              Cancelar
            </Button>
            <Button disabled={requiredMissing.length > 0} loading={previewMutation.isPending} onClick={runPreview}>
              Gerar prévia
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && previewMutation.data && (
        <div className="space-y-4">
          <SummaryBadges summary={previewMutation.data.summary} />
          <PreviewTable rows={previewMutation.data.rows} />
          {commitMutation.isError && (
            <p className="text-sm text-red-600">
              {commitMutation.error instanceof ApiError ? commitMutation.error.message : "Erro ao confirmar a importação."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("mapping")}>
              Voltar ao mapeamento
            </Button>
            <Button
              disabled={previewMutation.data.summary.to_create + previewMutation.data.summary.to_update === 0}
              loading={commitMutation.isPending}
              onClick={runCommit}
            >
              Confirmar importação
            </Button>
          </div>
        </div>
      )}

      {step === "done" && commitMutation.data && (
        <div className="space-y-4">
          <EmptyState
            title="Importação concluída"
            description={`${commitMutation.data.summary.to_create} criado(s), ${commitMutation.data.summary.to_update} atualizado(s), ${commitMutation.data.summary.errors} com erro.`}
          />
          <SummaryBadges summary={commitMutation.data.summary} />
          <PreviewTable rows={commitMutation.data.rows} />
          <div className="flex justify-end">
            <Button onClick={resetAll}>Nova importação</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportHistoryPanel() {
  const { data, isLoading } = useImportHistory();
  if (isLoading) return <LoadingSpinner label="Carregando histórico..." className="py-4" />;
  if (!data || data.length === 0) return <p className="text-sm text-slate-400">Nenhuma importação realizada ainda.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400">
            <th className="pb-1">Arquivo</th>
            <th className="pb-1">Tipo</th>
            <th className="pb-1 text-right">Linhas</th>
            <th className="pb-1 text-right">Criadas</th>
            <th className="pb-1 text-right">Atualizadas</th>
            <th className="pb-1 text-right">Erros</th>
            <th className="pb-1">Por</th>
            <th className="pb-1">Quando</th>
          </tr>
        </thead>
        <tbody>
          {data.map((h) => (
            <tr key={h.id} className="border-t border-slate-100">
              <td className="py-1.5">{h.file_name}</td>
              <td className="py-1.5">{IMPORT_ENTITY_LABELS[h.entity_type]}</td>
              <td className="py-1.5 text-right">{h.total_rows}</td>
              <td className="py-1.5 text-right">{h.created_count}</td>
              <td className="py-1.5 text-right">{h.updated_count}</td>
              <td className="py-1.5 text-right">{h.error_count}</td>
              <td className="py-1.5">{h.created_by_name ?? "—"}</td>
              <td className="py-1.5 text-slate-400">{formatDateTime(h.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [pending, setPending] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const run = async (entity: ExportEntity) => {
    setPending(entity);
    setExportError(null);
    try {
      await triggerExport(entity, format);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Erro ao exportar.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Exportar dados</h2>
        <p className="text-sm text-slate-500">Baixe os dados do CRM em CSV, XLSX ou como backup completo em JSON.</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">Formato:</span>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" checked={format === "csv"} onChange={() => setFormat("csv")} /> CSV
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} /> XLSX
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXPORT_ENTITIES.map((item) => (
          <Button key={item.key} variant="secondary" loading={pending === item.key} onClick={() => run(item.key)}>
            Exportar {item.label}
          </Button>
        ))}
        <Button variant="secondary" loading={pending === "backup"} onClick={() => run("backup")}>
          Backup completo (JSON)
        </Button>
      </div>

      {exportError && <p className="text-sm text-red-600">{exportError}</p>}
    </div>
  );
}

export function ImportExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Importação e exportação</h1>
        <p className="text-sm text-slate-500">Traga leads de outras planilhas ou exporte os dados do CRM para análise e backup.</p>
      </div>

      <ImportWizard />

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-800">Histórico de importações</h2>
        <ImportHistoryPanel />
      </div>

      <ExportPanel />
    </div>
  );
}
