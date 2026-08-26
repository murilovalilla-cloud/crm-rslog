-- Migration 0002: dados fictícios para demonstração do CRM RS LOG.
-- Não contém nenhuma informação real de clientes. Datas de atividades são
-- calculadas em relação a "agora" para que os alertas (atrasado/hoje/futuro)
-- fiquem sempre coerentes, independentemente de quando a migration for aplicada.

-- ============================================================================
-- users
-- ============================================================================
INSERT INTO users (id, email, name, role, active) VALUES
  ('usr-admin',  'admin@rslog.com.br',     'Ana Beatriz Souza',   'admin',    1),
  ('usr-vend-1', 'carlos.lima@rslog.com.br','Carlos Eduardo Lima', 'vendedor', 1),
  ('usr-vend-2', 'fernanda.ramos@rslog.com.br','Fernanda Ramos',  'vendedor', 1);

-- ============================================================================
-- pipeline_stages (10 etapas padrão do funil)
-- ============================================================================
INSERT INTO pipeline_stages (id, name, position, color, is_won, is_lost, is_nutrition, created_by) VALUES
  ('stage-01', 'Lead novo',             1, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-02', 'Tentativa de contato',  2, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-03', 'Contato realizado',     3, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-04', 'Lead qualificado',      4, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-05', 'Cotação solicitada',    5, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-06', 'Cotação enviada',       6, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-07', 'Negociação',            7, '#1f3566', 0, 0, 0, 'usr-admin'),
  ('stage-08', 'Fechado — ganho',       8, '#16a34a', 1, 0, 0, 'usr-admin'),
  ('stage-09', 'Fechado — perdido',     9, '#dc2626', 0, 1, 0, 'usr-admin'),
  ('stage-10', 'Nutrição',             10, '#6b7280', 0, 0, 1, 'usr-admin');

-- ============================================================================
-- loss_reasons
-- ============================================================================
INSERT INTO loss_reasons (id, name, created_by) VALUES
  ('lr-preco',        'Preço acima do orçamento do cliente', 'usr-admin'),
  ('lr-concorrencia', 'Fechou com concorrente',              'usr-admin'),
  ('lr-sem-retorno',  'Sem retorno do cliente',               'usr-admin'),
  ('lr-fora-perfil',  'Fora do perfil de carga atendido',    'usr-admin'),
  ('lr-prazo',        'Prazo de coleta/entrega incompatível', 'usr-admin');

-- ============================================================================
-- companies
-- ============================================================================
INSERT INTO companies (id, name, cnpj, segment, website, phone, city, state, source, owner_id, created_by) VALUES
  ('cmp-001', 'Agroindústria Vale Verde Ltda',   '12.345.678/0001-90', 'Agronegócio',        'valeverde.com.br',       '(51) 3211-4400', 'Passo Fundo',   'RS', 'Indicação',       'usr-vend-1', 'usr-vend-1'),
  ('cmp-002', 'Metalúrgica Sul Forte S.A.',       '23.456.789/0001-01', 'Metalurgia',         'metalsulforte.com.br',   '(54) 3025-7788', 'Caxias do Sul', 'RS', 'Site',            'usr-vend-1', 'usr-vend-1'),
  ('cmp-003', 'Distribuidora Pampa Alimentos',    '34.567.890/0001-12', 'Alimentício',        'pampaalimentos.com.br',  '(55) 3221-9090', 'Santa Maria',   'RS', 'Cold call',       'usr-vend-2', 'usr-vend-2'),
  ('cmp-004', 'Química Rio Grande Insumos',       '45.678.901/0001-23', 'Química',            'riograndeinsumos.com.br','(51) 3344-1122', 'Porto Alegre',  'RS', 'Feira setorial',  'usr-vend-2', 'usr-vend-2'),
  ('cmp-005', 'Móveis Serra Gaúcha Ind.',         '56.789.012/0001-34', 'Moveleiro',          'moveisserragaucha.com.br','(54) 3455-6600', 'Bento Gonçalves','RS', 'Indicação',      'usr-vend-1', 'usr-vend-1'),
  ('cmp-006', 'Calçados Litoral Norte',           '67.890.123/0001-45', 'Calçadista',         'calcadoslitoral.com.br', '(51) 3699-8800', 'Torres',        'RS', 'LinkedIn',        'usr-vend-2', 'usr-vend-2'),
  ('cmp-007', 'Bebidas Planalto Distribuição',    '78.901.234/0001-56', 'Bebidas',            'bebidasplanalto.com.br', '(54) 3212-3344', 'Vacaria',       'RS', 'Site',            'usr-vend-1', 'usr-vend-1'),
  ('cmp-008', 'Eletro Fronteira Componentes',     '89.012.345/0001-67', 'Eletroeletrônico',   'eletrofronteira.com.br', '(55) 3511-2233', 'Uruguaiana',    'RS', 'Cold call',       'usr-vend-2', 'usr-vend-2');

-- ============================================================================
-- contacts
-- ============================================================================
INSERT INTO contacts (id, company_id, name, role, is_decision_maker, email, phone, whatsapp, created_by) VALUES
  ('ctc-001', 'cmp-001', 'Roberto Anzolin',   'Diretor de Logística',   1, 'roberto.anzolin@valeverde.com.br',   '(51) 99911-2233', '(51) 99911-2233', 'usr-vend-1'),
  ('ctc-002', 'cmp-001', 'Juliana Petry',     'Analista de Compras',    0, 'juliana.petry@valeverde.com.br',     '(51) 99911-2234', '(51) 99911-2234', 'usr-vend-1'),
  ('ctc-003', 'cmp-002', 'Marcelo Tonet',     'Gerente de Suprimentos', 1, 'marcelo.tonet@metalsulforte.com.br', '(54) 99822-3344', '(54) 99822-3344', 'usr-vend-1'),
  ('ctc-004', 'cmp-003', 'Patrícia Weiss',    'Coordenadora de Logística', 1, 'patricia.weiss@pampaalimentos.com.br','(55) 99733-4455','(55) 99733-4455', 'usr-vend-2'),
  ('ctc-005', 'cmp-004', 'Eduardo Franzoi',   'Diretor Industrial',     1, 'eduardo.franzoi@riograndeinsumos.com.br','(51) 99644-5566','(51) 99644-5566', 'usr-vend-2'),
  ('ctc-006', 'cmp-005', 'Simone Bortoluzzi', 'Compradora',             0, 'simone.bortoluzzi@moveisserragaucha.com.br','(54) 99555-6677','(54) 99555-6677', 'usr-vend-1'),
  ('ctc-007', 'cmp-006', 'Alexandre Konzen',  'Sócio-diretor',          1, 'alexandre.konzen@calcadoslitoral.com.br','(51) 99466-7788','(51) 99466-7788', 'usr-vend-2'),
  ('ctc-008', 'cmp-007', 'Camila Dutra',      'Gerente Comercial',      1, 'camila.dutra@bebidasplanalto.com.br','(54) 99377-8899','(54) 99377-8899', 'usr-vend-1'),
  ('ctc-009', 'cmp-008', 'Fábio Reginato',    'Diretor Financeiro',     1, 'fabio.reginato@eletrofronteira.com.br','(55) 99288-9900','(55) 99288-9900', 'usr-vend-2');

-- ============================================================================
-- opportunities (distribuídas pelas etapas do funil)
-- ============================================================================
INSERT INTO opportunities (id, company_id, contact_id, title, stage_id, owner_id, value, status, expected_close_date, created_by) VALUES
  ('opp-001', 'cmp-001', 'ctc-001', 'Frete fracionado — safra de soja',           'stage-01', 'usr-vend-1', 18500.00, 'aberta', NULL, 'usr-vend-1'),
  ('opp-002', 'cmp-002', 'ctc-003', 'Transporte de bobinas de aço',               'stage-02', 'usr-vend-1', 42000.00, 'aberta', NULL, 'usr-vend-1'),
  ('opp-003', 'cmp-003', 'ctc-004', 'Distribuição refrigerada — Região Central',  'stage-03', 'usr-vend-2', 27500.00, 'aberta', NULL, 'usr-vend-2'),
  ('opp-004', 'cmp-004', 'ctc-005', 'Transporte de granéis químicos',             'stage-04', 'usr-vend-2', 61000.00, 'aberta', NULL, 'usr-vend-2'),
  ('opp-005', 'cmp-005', 'ctc-006', 'Frete de móveis — rota Sul/Sudeste',         'stage-05', 'usr-vend-1', 33800.00, 'aberta', NULL, 'usr-vend-1'),
  ('opp-006', 'cmp-006', 'ctc-007', 'Distribuição de calçados — RS/SC',          'stage-06', 'usr-vend-2', 21200.00, 'aberta', NULL, 'usr-vend-2'),
  ('opp-007', 'cmp-007', 'ctc-008', 'Transporte de bebidas — rota metropolitana', 'stage-07', 'usr-vend-1', 15900.00, 'aberta', NULL, 'usr-vend-1'),
  ('opp-008', 'cmp-008', 'ctc-009', 'Frete dedicado — componentes eletrônicos',   'stage-08', 'usr-vend-2', 48750.00, 'ganha', NULL, 'usr-vend-2'),
  ('opp-009', 'cmp-002', 'ctc-003', 'Transporte de peças usinadas',               'stage-09', 'usr-vend-1', 12300.00, 'perdida', NULL, 'usr-vend-1'),
  ('opp-010', 'cmp-003', 'ctc-004', 'Frete sazonal — período de festas',          'stage-10', 'usr-vend-2', 9800.00,  'nutricao', NULL, 'usr-vend-2');

UPDATE opportunities SET loss_reason_id = 'lr-concorrencia', created_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-25 days'), closed_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 days') WHERE id = 'opp-009';
-- created_at precisa ficar ANTES de closed_at, senão o indicador "tempo médio de
-- fechamento" do dashboard (baseado em julianday(closed_at) - julianday(created_at)) dá negativo.
UPDATE opportunities SET created_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-18 days'), closed_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 days') WHERE id = 'opp-008';

-- ============================================================================
-- activities (uma atrasada, uma de hoje, uma futura e uma concluída por
-- oportunidade em aberto, para exercitar os 4 estados de alerta do calendário)
-- ============================================================================
INSERT INTO activities (id, opportunity_id, type, title, description, due_at, status, owner_id, created_by) VALUES
  ('act-001', 'opp-001', 'ligacao',  'Ligar para apresentar a RS LOG',         'Primeiro contato com Roberto Anzolin.',              STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days'), 'pendente', 'usr-vend-1', 'usr-vend-1'),
  ('act-002', 'opp-002', 'email',    'Enviar apresentação institucional',      'E-mail com portfólio de cargas especiais.',          STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'),             'pendente', 'usr-vend-1', 'usr-vend-1'),
  ('act-003', 'opp-003', 'whatsapp', 'Follow-up sobre proposta de refrigerado', 'Confirmar recebimento da proposta.',                 STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '+3 days'), 'pendente', 'usr-vend-2', 'usr-vend-2'),
  ('act-004', 'opp-004', 'reuniao',  'Reunião técnica sobre granéis químicos', 'Alinhar requisitos de segurança do transporte.',     STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 days'), 'pendente', 'usr-vend-2', 'usr-vend-2'),
  ('act-005', 'opp-005', 'visita',   'Visita técnica à fábrica',               'Avaliar volume e tipo de embalagem dos móveis.',     STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '+5 days'), 'pendente', 'usr-vend-1', 'usr-vend-1'),
  ('act-006', 'opp-006', 'followup', 'Follow-up da cotação enviada',           'Verificar aprovação interna da cotação.',            STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'),             'pendente', 'usr-vend-2', 'usr-vend-2'),
  ('act-007', 'opp-007', 'ligacao',  'Ligação de negociação de valores',       'Discutir condições comerciais finais.',              STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 days'), 'pendente', 'usr-vend-1', 'usr-vend-1'),
  ('act-008', 'opp-001', 'email',    'Enviar case de agronegócio',             'Case de sucesso com transporte de grãos.',           STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 days'), 'concluida', 'usr-vend-1', 'usr-vend-1'),
  ('act-009', 'opp-008', 'reuniao',  'Reunião de fechamento',                  'Assinatura do contrato de frete dedicado.',          STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 days'), 'concluida', 'usr-vend-2', 'usr-vend-2');

UPDATE activities SET completed_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 days') WHERE id = 'act-008';
UPDATE activities SET completed_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 days') WHERE id = 'act-009';

-- ============================================================================
-- activity_history (linha do tempo de cada oportunidade)
-- ============================================================================
INSERT INTO activity_history (id, opportunity_id, type, description, occurred_at, created_by) VALUES
  ('hist-001', 'opp-001', 'sistema',    'Oportunidade criada a partir de indicação.',            STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 days'), 'usr-vend-1'),
  ('hist-002', 'opp-001', 'email',      'E-mail enviado com case de sucesso do agronegócio.',    STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 days'), 'usr-vend-1'),
  ('hist-003', 'opp-002', 'sistema',    'Oportunidade criada a partir do site.',                  STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days'), 'usr-vend-1'),
  ('hist-004', 'opp-003', 'ligacao',    'Ligação realizada — cliente pediu proposta por e-mail.', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 days'), 'usr-vend-2'),
  ('hist-005', 'opp-008', 'cotacao',    'Cotação nº 2026-0012 aprovada pelo cliente.',            STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 days'), 'usr-vend-2'),
  ('hist-006', 'opp-008', 'reuniao',    'Reunião de fechamento realizada, contrato assinado.',    STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 days'), 'usr-vend-2'),
  ('hist-009', 'opp-009', 'observacao', 'Cliente optou pelo concorrente por preço.',              STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 days'), 'usr-vend-1'),
  ('hist-010', 'opp-010', 'observacao', 'Sem orçamento neste momento; retomar após o verão.',     STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 days'), 'usr-vend-2');

INSERT INTO activity_history (id, opportunity_id, type, description, from_stage_id, to_stage_id, occurred_at, created_by) VALUES
  ('hist-007', 'opp-009', 'mudanca_etapa', 'Movida de "Negociação" para "Fechado — perdido".', 'stage-07', 'stage-09', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 days'), 'usr-vend-1'),
  ('hist-008', 'opp-010', 'mudanca_etapa', 'Movida de "Contato realizado" para "Nutrição".',   'stage-03', 'stage-10', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 days'), 'usr-vend-2');

-- ============================================================================
-- notes
-- ============================================================================
INSERT INTO notes (id, opportunity_id, content, created_by) VALUES
  ('note-001', 'opp-001', 'Cliente prefere contato pela manhã. Volume médio mensal estimado em 40 toneladas.', 'usr-vend-1'),
  ('note-002', 'opp-004', 'Exige transportadora com certificação para produtos químicos (MOPP).',              'usr-vend-2'),
  ('note-003', 'opp-010', 'Reavaliar retomada após a entressafra, conforme combinado com a Patrícia.',         'usr-vend-2');

-- ============================================================================
-- nutrition_leads (registro de nutrição para a oportunidade opp-010)
-- ============================================================================
INSERT INTO nutrition_leads (id, opportunity_id, reason, resume_at, status, created_by) VALUES
  ('nut-001', 'opp-010', 'Sem orçamento disponível no período.', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 days'), 'em_nutricao', 'usr-vend-2');

-- ============================================================================
-- audit_log (exemplos de auditoria já registrados)
-- ============================================================================
INSERT INTO audit_log (id, entity_type, entity_id, action, field_name, old_value, new_value, user_id, user_email, occurred_at) VALUES
  ('aud-001', 'opportunity', 'opp-009', 'stage_change', 'stage_id', 'stage-07', 'stage-09', 'usr-vend-1', 'carlos.lima@rslog.com.br', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 days')),
  ('aud-002', 'opportunity', 'opp-010', 'stage_change', 'stage_id', 'stage-03', 'stage-10', 'usr-vend-2', 'fernanda.ramos@rslog.com.br', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 days')),
  ('aud-003', 'opportunity', 'opp-008', 'stage_change', 'stage_id', 'stage-07', 'stage-08', 'usr-vend-2', 'fernanda.ramos@rslog.com.br', STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now', '-4 days'));
