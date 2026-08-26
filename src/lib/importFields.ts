import type { ImportEntity } from "./types";

export interface ImportFieldDef {
  key: string;
  label: string;
  required?: boolean;
}

// Campos-alvo aceitos pelo backend (worker/import.ts) para cada tipo de entidade.
// A tela de importação usa esta lista para montar o passo de mapeamento de colunas.
export const IMPORT_FIELDS: Record<ImportEntity, ImportFieldDef[]> = {
  companies: [
    { key: "name", label: "Nome da empresa", required: true },
    { key: "cnpj", label: "CNPJ" },
    { key: "segment", label: "Segmento" },
    { key: "website", label: "Site" },
    { key: "phone", label: "Telefone" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "UF" },
    { key: "source", label: "Origem do lead" },
    { key: "notes", label: "Observações" },
    { key: "owner_email", label: "E-mail do responsável" },
  ],
  contacts: [
    { key: "name", label: "Nome do contato", required: true },
    { key: "company_name", label: "Nome da empresa (para vincular)" },
    { key: "company_cnpj", label: "CNPJ da empresa (para vincular)" },
    { key: "role", label: "Cargo" },
    { key: "is_decision_maker", label: "É decisor? (sim/não)" },
    { key: "email", label: "E-mail" },
    { key: "phone", label: "Telefone" },
    { key: "whatsapp", label: "WhatsApp" },
  ],
  opportunities: [
    { key: "title", label: "Título da oportunidade", required: true },
    { key: "company_name", label: "Nome da empresa (para vincular)" },
    { key: "company_cnpj", label: "CNPJ da empresa (para vincular)" },
    { key: "contact_name", label: "Nome do contato" },
    { key: "stage_name", label: "Etapa do funil (nome exato)" },
    { key: "owner_email", label: "E-mail do responsável" },
    { key: "value", label: "Valor (R$)" },
    { key: "expected_close_date", label: "Previsão de fechamento (AAAA-MM-DD)" },
  ],
};

export const IMPORT_ENTITY_LABELS: Record<ImportEntity, string> = {
  companies: "Empresas",
  contacts: "Contatos",
  opportunities: "Oportunidades",
};

export const IMPORT_ENTITY_NOTES: Record<ImportEntity, string> = {
  companies: "Empresas existentes são identificadas por CNPJ ou, na ausência dele, por nome — linhas equivalentes viram atualização.",
  contacts: "Informe o nome ou CNPJ da empresa para vincular o contato. Contatos existentes são identificados por e-mail ou nome dentro da mesma empresa.",
  opportunities: "Informe o nome ou CNPJ da empresa. A etapa deve ter o nome exato de uma etapa ativa do funil; se não informada, a primeira etapa é usada.",
};
