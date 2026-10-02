-- Custom SQL migration file, put your code below! --

-- Água, Luz, Internet e Gás como subcategorias de Moradia — pedido do
-- Thiago (02/10/2026): contas de consumo recorrentes da casa não cabiam em
-- nenhuma subcategoria existente (Aluguel, Condomínio, Financiamento,
-- Manutenção). Mesmo padrão da migração 0013 (categoria Pensão): inserido
-- direto aqui porque seedGlobalCategoriesIfNeeded() só roda uma vez e não
-- faz backfill pra instalação que já tinha categorias globais. IF NOT
-- EXISTS (via WHERE NOT EXISTS) deixa seguro rodar de novo / em outro
-- ambiente que já tenha alguma dessas categorias.
INSERT INTO "categories" ("id", "user_id", "name", "type", "parent_id", "is_system")
SELECT substr(md5(random()::text || clock_timestamp()::text || child.name), 1, 24),
  NULL,
  child.name,
  'EXPENSE',
  moradia.id,
  true
FROM (SELECT id FROM "categories" WHERE "user_id" IS NULL AND "name" = 'Moradia' AND "parent_id" IS NULL LIMIT 1) AS moradia
CROSS JOIN (VALUES ('Água'), ('Luz'), ('Internet'), ('Gás')) AS child(name)
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE "user_id" IS NULL AND "parent_id" = moradia.id AND "name" = child.name
);
