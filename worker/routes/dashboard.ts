// Rota do dashboard: GET /api/dashboard
//
// Todos os indicadores são calculados a partir de consultas reais ao D1 —
// nada aqui vem de dado simulado. Algumas definições de negócio exigem uma
// escolha explícita (documentada em cada bloco) porque o funil é
// personalizável (etapas podem ser renomeadas/reordenadas pelo usuário):
//   - "Leads qualificados" considera oportunidades abertas na 4ª etapa (ou
//     posterior) do funil ativo — aproximação razoável enquanto não existe
//     uma flag dedicada de "etapa de qualificação".
//   - "Previsão de receita" pondera o valor das oportunidades abertas pela
//     posição relativa da etapa dentro das etapas não-terminais (ganho/
//     perda/nutrição ficam de fora) — uma estimativa simples, não uma
//     probabilidade estatística real de fechamento.
//   - "Negócios parados" são oportunidades abertas sem nenhum evento no
//     histórico (activity_history) há mais de 10 dias.

import { Hono } from "hono";
import type { AppEnv } from "../types";

const dashboard = new Hono<AppEnv>();

const STALLED_THRESHOLD_DAYS = 10;

dashboard.get("/", async (c) => {
  const db = c.env.DB;

  const stages = await db.prepare("SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY position ASC").all<{
    id: string;
    name: string;
    position: number;
    is_won: number;
    is_lost: number;
    is_nutrition: number;
  }>();

  const qualifiedThreshold = stages.results[3]?.position ?? stages.results[stages.results.length - 1]?.position ?? 0;

  const [
    totalLeads,
    newLeadsMonth,
    contactsMadeMonth,
    overdueActivities,
    todayActivities,
    qualifiedLeads,
    quoteTotals,
    wonTotals,
    avgDaysToClose,
    openFunnelValue,
    stageDistribution,
    openStageValues,
    salesByOwner,
    activitiesByOwner,
    bestLeadSources,
    lossReasons,
    stalledDeals,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) as n FROM companies").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM companies WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) as n FROM activity_history
         WHERE type IN ('ligacao','email','whatsapp','reuniao','visita')
           AND strftime('%Y-%m', occurred_at) = strftime('%Y-%m', 'now')`
      )
      .first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM activities WHERE status = 'pendente' AND date(due_at) < date('now')").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM activities WHERE status = 'pendente' AND date(due_at) = date('now')").first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) as n FROM opportunities o JOIN pipeline_stages s ON s.id = o.stage_id
         WHERE o.status = 'aberta' AND s.position >= ?`
      )
      .bind(qualifiedThreshold)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status != 'rascunho' THEN 1 ELSE 0 END), 0) as sent, COALESCE(SUM(value), 0) as total_value
         FROM quotes`
      )
      .first<{ total: number; sent: number; total_value: number }>(),
    db.prepare("SELECT COUNT(*) as n, COALESCE(SUM(value), 0) as revenue FROM opportunities WHERE status = 'ganha'").first<{
      n: number;
      revenue: number;
    }>(),
    db
      .prepare(
        "SELECT AVG(julianday(closed_at) - julianday(created_at)) as avg_days FROM opportunities WHERE status = 'ganha' AND closed_at IS NOT NULL"
      )
      .first<{ avg_days: number | null }>(),
    db.prepare("SELECT COALESCE(SUM(value), 0) as total FROM opportunities WHERE status = 'aberta'").first<{ total: number }>(),
    db
      .prepare(
        `SELECT s.id as stage_id, s.name as stage_name, s.position, COUNT(o.id) as count, COALESCE(SUM(o.value), 0) as value
         FROM pipeline_stages s LEFT JOIN opportunities o ON o.stage_id = s.id
         WHERE s.active = 1
         GROUP BY s.id ORDER BY s.position ASC`
      )
      .all<{ stage_id: string; stage_name: string; position: number; count: number; value: number }>(),
    db
      .prepare(
        `SELECT s.position, COALESCE(SUM(o.value), 0) as value
         FROM pipeline_stages s LEFT JOIN opportunities o ON o.stage_id = s.id AND o.status = 'aberta'
         WHERE s.active = 1 AND s.is_won = 0 AND s.is_lost = 0 AND s.is_nutrition = 0
         GROUP BY s.id ORDER BY s.position ASC`
      )
      .all<{ position: number; value: number }>(),
    db
      .prepare(
        `SELECT u.id as owner_id, u.name as owner_name, COUNT(o.id) as count, COALESCE(SUM(o.value), 0) as value
         FROM opportunities o JOIN users u ON u.id = o.owner_id
         WHERE o.status = 'ganha'
         GROUP BY u.id ORDER BY value DESC`
      )
      .all<{ owner_id: string; owner_name: string; count: number; value: number }>(),
    db
      .prepare(
        `SELECT u.id as owner_id, u.name as owner_name, COUNT(a.id) as count
         FROM activities a JOIN users u ON u.id = a.owner_id
         GROUP BY u.id ORDER BY count DESC`
      )
      .all<{ owner_id: string; owner_name: string; count: number }>(),
    db
      .prepare(
        `SELECT COALESCE(c.source, 'Não informado') as source, COUNT(o.id) as count, COALESCE(SUM(o.value), 0) as value
         FROM opportunities o JOIN companies c ON c.id = o.company_id
         WHERE o.status = 'ganha'
         GROUP BY source ORDER BY value DESC LIMIT 10`
      )
      .all<{ source: string; count: number; value: number }>(),
    db
      .prepare(
        `SELECT COALESCE(lr.name, 'Sem motivo informado') as reason, COUNT(o.id) as count
         FROM opportunities o LEFT JOIN loss_reasons lr ON lr.id = o.loss_reason_id
         WHERE o.status = 'perdida'
         GROUP BY reason ORDER BY count DESC`
      )
      .all<{ reason: string; count: number }>(),
    db
      .prepare(
        `SELECT * FROM (
           SELECT o.id, o.title, c.name as company_name, o.value, o.owner_id, u.name as owner_name,
             COALESCE((SELECT MAX(h.occurred_at) FROM activity_history h WHERE h.opportunity_id = o.id), o.created_at) as last_touch_at
           FROM opportunities o
           JOIN companies c ON c.id = o.company_id
           LEFT JOIN users u ON u.id = o.owner_id
           WHERE o.status = 'aberta'
         ) t
         WHERE julianday('now') - julianday(t.last_touch_at) > ?
         ORDER BY t.last_touch_at ASC
         LIMIT 200`
      )
      .bind(STALLED_THRESHOLD_DAYS)
      .all<{ id: string; title: string; company_name: string; value: number | null; owner_id: string | null; owner_name: string | null; last_touch_at: string }>(),
  ]);

  const openRows = openStageValues.results;
  const revenueForecast = openRows.reduce((sum, row, index) => {
    const weight = (index + 1) / openRows.length;
    return sum + row.value * weight;
  }, 0);

  const wonCount = wonTotals?.n ?? 0;
  const wonRevenue = wonTotals?.revenue ?? 0;

  return c.json({
    data: {
      generated_at: new Date().toISOString(),
      totals: {
        total_leads: totalLeads?.n ?? 0,
        new_leads_month: newLeadsMonth?.n ?? 0,
        contacts_made_month: contactsMadeMonth?.n ?? 0,
        overdue_activities: overdueActivities?.n ?? 0,
        today_activities: todayActivities?.n ?? 0,
        qualified_leads: qualifiedLeads?.n ?? 0,
        quotes_requested: quoteTotals?.total ?? 0,
        quotes_sent: quoteTotals?.sent ?? 0,
        total_quoted_value: quoteTotals?.total_value ?? 0,
        won_deals: wonCount,
        won_revenue: wonRevenue,
        avg_ticket: wonCount > 0 ? wonRevenue / wonCount : 0,
        avg_days_to_close: avgDaysToClose?.avg_days ?? null,
        open_funnel_value: openFunnelValue?.total ?? 0,
        revenue_forecast: Math.round(revenueForecast * 100) / 100,
        stalled_deals: stalledDeals.results.length,
      },
      stage_distribution: stageDistribution.results,
      sales_by_owner: salesByOwner.results,
      activities_by_owner: activitiesByOwner.results,
      best_lead_sources: bestLeadSources.results,
      loss_reasons: lossReasons.results,
      stalled_deals_list: stalledDeals.results.slice(0, 20),
    },
  });
});

export default dashboard;
