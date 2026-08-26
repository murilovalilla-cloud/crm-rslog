import type { ReactNode } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { formatCurrencyBRL, formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/api";

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) return <LoadingSpinner label="Carregando indicadores..." />;
  if (error || !data) {
    return (
      <EmptyState
        tone="error"
        title="Não foi possível carregar o dashboard"
        description={error instanceof ApiError ? error.message : "Tente novamente em instantes."}
      />
    );
  }

  const { totals } = data;
  const maxStageCount = Math.max(1, ...data.stage_distribution.map((s) => s.count));
  const maxSourceCount = Math.max(1, ...data.best_lead_sources.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Indicadores calculados em tempo real a partir do banco de dados.</p>
        </div>
        <p className="text-xs text-slate-400">Atualizado em {formatDate(data.generated_at)}</p>
      </div>

      {/* Indicadores gerais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total de leads" value={String(totals.total_leads)} />
        <MetricCard label="Leads novos no mês" value={String(totals.new_leads_month)} />
        <MetricCard label="Contatos realizados no mês" value={String(totals.contacts_made_month)} />
        <MetricCard label="Leads qualificados" value={String(totals.qualified_leads)} />
        <MetricCard label="Atividades atrasadas" value={String(totals.overdue_activities)} hint="Requer atenção imediata" />
        <MetricCard label="Atividades de hoje" value={String(totals.today_activities)} />
        <MetricCard label="Negócios parados" value={String(totals.stalled_deals)} hint="Sem contato há 10+ dias" />
        <MetricCard label="Cotações solicitadas" value={String(totals.quotes_requested)} />
      </div>

      {/* Indicadores comerciais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cotações enviadas" value={String(totals.quotes_sent)} />
        <MetricCard label="Valor total cotado" value={formatCurrencyBRL(totals.total_quoted_value)} />
        <MetricCard label="Vendas concluídas" value={String(totals.won_deals)} />
        <MetricCard label="Receita vendida" value={formatCurrencyBRL(totals.won_revenue)} />
        <MetricCard label="Ticket médio" value={formatCurrencyBRL(totals.avg_ticket)} />
        <MetricCard
          label="Tempo médio de fechamento"
          value={totals.avg_days_to_close !== null ? `${totals.avg_days_to_close.toFixed(0)} dia(s)` : "—"}
        />
        <MetricCard label="Valor do funil aberto" value={formatCurrencyBRL(totals.open_funnel_value)} />
        <MetricCard
          label="Previsão de receita"
          value={formatCurrencyBRL(totals.revenue_forecast)}
          hint="Estimativa ponderada por etapa, não é garantia de fechamento"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funil por etapa */}
        <SectionCard title="Funil por etapa" subtitle="Quantidade e valor de oportunidades abertas em cada etapa">
          {data.stage_distribution.length === 0 ? (
            <p className="text-sm text-slate-400">Sem oportunidades no funil.</p>
          ) : (
            <div className="space-y-2">
              {data.stage_distribution.map((stage) => (
                <div key={stage.stage_id}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{stage.stage_name}</span>
                    <span>
                      {stage.count} · {formatCurrencyBRL(stage.value)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-navy-500"
                      style={{ width: `${Math.max(4, (stage.count / maxStageCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Melhores origens de leads */}
        <SectionCard title="Melhores origens de leads" subtitle="Empresas cadastradas por origem">
          {data.best_lead_sources.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma origem registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.best_lead_sources.map((source) => (
                <div key={source.source}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{source.source}</span>
                    <span>
                      {source.count} · {formatCurrencyBRL(source.value)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-navy-400"
                      style={{ width: `${Math.max(4, (source.count / maxSourceCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Vendas por responsável */}
        <SectionCard title="Vendas por responsável" subtitle="Negócios fechados-ganhos por vendedor">
          {data.sales_by_owner.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma venda concluída ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-1">Vendedor</th>
                  <th className="pb-1 text-right">Vendas</th>
                  <th className="pb-1 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {data.sales_by_owner.map((row) => (
                  <tr key={row.owner_id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{row.owner_name}</td>
                    <td className="py-1.5 text-right">{row.count}</td>
                    <td className="py-1.5 text-right font-medium text-slate-700">{formatCurrencyBRL(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Atividades por responsável */}
        <SectionCard title="Atividades por responsável" subtitle="Atividades pendentes atribuídas a cada vendedor">
          {data.activities_by_owner.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma atividade pendente.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-1">Vendedor</th>
                  <th className="pb-1 text-right">Atividades pendentes</th>
                </tr>
              </thead>
              <tbody>
                {data.activities_by_owner.map((row) => (
                  <tr key={row.owner_id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{row.owner_name}</td>
                    <td className="py-1.5 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Motivos de perda */}
        <SectionCard title="Motivos de perda" subtitle="Oportunidades fechadas-perdidas por motivo">
          {data.loss_reasons.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma perda registrada ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-1">Motivo</th>
                  <th className="pb-1 text-right">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {data.loss_reasons.map((row) => (
                  <tr key={row.reason} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{row.reason}</td>
                    <td className="py-1.5 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Negócios parados */}
        <SectionCard title="Negócios parados" subtitle="Oportunidades abertas sem contato registrado há 10+ dias">
          {data.stalled_deals_list.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum negócio parado no momento.</p>
          ) : (
            <ul className="space-y-2">
              {data.stalled_deals_list.map((deal) => (
                <li key={deal.id} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">{deal.title}</p>
                  <p className="text-xs text-slate-500">
                    {deal.company_name} · {deal.owner_name ?? "Sem responsável"} · {formatCurrencyBRL(deal.value)}
                  </p>
                  <p className="text-xs text-alert-overdue">Sem contato desde {formatDate(deal.last_touch_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
