-- Migration 0003: consolida o funil de 10 para 5 etapas e adiciona o campo
-- de decisor digitado livremente na oportunidade.
--
-- Ordem importante (para não violar a FK RESTRICT de opportunities.stage_id
-- nem a UNIQUE INDEX de pipeline_stages.position):
--   1) Reatribuir as oportunidades das etapas que serão removidas para a
--      etapa equivalente que vai permanecer.
--   2) Só então excluir as etapas antigas (activity_history.from_stage_id /
--      to_stage_id ficam NULL automaticamente via ON DELETE SET NULL).
--   3) Só então renomear/reposicionar as 5 etapas que restaram.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1) Reatribuir oportunidades das etapas que serão removidas
-- ============================================================================
-- Tentativa de contato, Contato realizado, Lead qualificado e Cotação
-- solicitada eram todas etapas de prospecção anteriores ao envio da cotação
-- -> viram "Lead novo - prospecção" (stage-01).
UPDATE opportunities
   SET stage_id = 'stage-01'
 WHERE stage_id IN ('stage-02', 'stage-03', 'stage-04', 'stage-05');

-- Negociação (07) vira parte de "Negociação - cotação enviada" (stage-06).
UPDATE opportunities
   SET stage_id = 'stage-06'
 WHERE stage_id = 'stage-07';

-- ============================================================================
-- 2) Excluir as etapas que não existem mais
-- ============================================================================
DELETE FROM pipeline_stages
 WHERE id IN ('stage-02', 'stage-03', 'stage-04', 'stage-05', 'stage-07');

-- ============================================================================
-- 3) Renomear/reposicionar as 5 etapas que permanecem
-- ============================================================================
UPDATE pipeline_stages SET name = 'Lead novo - prospecção',        position = 1, color = '#2563eb' WHERE id = 'stage-01';
UPDATE pipeline_stages SET name = 'Negociação - cotação enviada',  position = 2, color = '#d97706' WHERE id = 'stage-06';
UPDATE pipeline_stages SET name = 'Frete Fechado',                 position = 3, color = '#16a34a' WHERE id = 'stage-08';
UPDATE pipeline_stages SET name = 'Negociação - não fechado',      position = 4, color = '#dc2626' WHERE id = 'stage-09';
UPDATE pipeline_stages SET name = 'Lead - Nutrição',                position = 5, color = '#6b7280' WHERE id = 'stage-10';

-- ============================================================================
-- 4) Campo de decisor digitado livremente (além do contato/decisor cadastrado)
-- ============================================================================
ALTER TABLE opportunities ADD COLUMN decision_maker_name TEXT;
