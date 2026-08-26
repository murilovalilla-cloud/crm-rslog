// Rotas de motivos de perda: /api/loss-reasons
// Catálogo simples usado ao mover uma oportunidade para uma etapa de perda.

import { Hono } from "hono";
import type { AppEnv } from "../types";

const lossReasons = new Hono<AppEnv>();

lossReasons.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name FROM loss_reasons WHERE active = 1 ORDER BY name ASC"
  ).all();
  return c.json({ data: results });
});

export default lossReasons;
