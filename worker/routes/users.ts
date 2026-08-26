// Rotas de usuários: /api/users e /api/me
//
// Cadastro de novos usuários (vendedores) ainda é feito diretamente no banco
// (ver README > "Adicionar novos vendedores") na Etapa 1. Uma tela de gestão
// de equipe fica prevista para a Etapa 3, junto do endurecimento da
// autenticação.

import { Hono } from "hono";
import type { AppEnv } from "../types";

const users = new Hono<AppEnv>();

// GET /api/users — lista usuários ativos, usada para preencher seletores de
// "responsável comercial" nos formulários de empresa/oportunidade/atividade.
users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY name ASC"
  ).all();
  return c.json({ data: results });
});

export default users;
