import "server-only";
import { and, count, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import type ExcelJS from "exceljs";
import { db } from "@/lib/db/client";
import { users, sessions, leads, leadStatusEnum, userRoleEnum, subscriptionPlanEnum, subscriptionStatusEnum } from "@/lib/db/schema";

// ============================================================================
// Painel admin — leitura de usuários/assinaturas (dado já existe em `users`,
// não duplicado aqui) + CRM de leads (tabela nova, ver schema.ts). Pedido do
// Thiago 2026-09-18. Tudo aqui é síncrono/local — nenhum envio de e-mail ou
// WhatsApp em massa (ver comentário no schema sobre por quê).
// ============================================================================

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "PLANNER" | "ADMIN";
  onboardingCompleted: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: Date;
  createdAt: Date;
};

/** Painel geral: contagens rápidas pro topo do /admin. */
export async function getAdminOverview() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // isNull(deletedAt) em toda contagem de usuário — desde que excluir pelo
  // admin virou soft delete, uma conta desativada não deve inflar "total de
  // usuários"/"por status"/"por plano".
  const [totalRow, byStatusRows, byPlanRows, newLast30Row, totalLeadsRow, leadsByStatusRows] = await Promise.all([
    db.select({ n: count() }).from(users).where(isNull(users.deletedAt)),
    db
      .select({ status: users.subscriptionStatus, n: count() })
      .from(users)
      .where(isNull(users.deletedAt))
      .groupBy(users.subscriptionStatus),
    db
      .select({ plan: users.subscriptionPlan, n: count() })
      .from(users)
      .where(isNull(users.deletedAt))
      .groupBy(users.subscriptionPlan),
    db.select({ n: count() }).from(users).where(and(isNull(users.deletedAt), gte(users.createdAt, thirtyDaysAgo))),
    db.select({ n: count() }).from(leads),
    db.select({ status: leads.status, n: count() }).from(leads).groupBy(leads.status),
  ]);

  return {
    totalUsers: totalRow[0]?.n ?? 0,
    newUsersLast30d: newLast30Row[0]?.n ?? 0,
    byStatus: Object.fromEntries(byStatusRows.map((r) => [r.status, r.n])),
    byPlan: Object.fromEntries(byPlanRows.map((r) => [r.plan, r.n])),
    totalLeads: totalLeadsRow[0]?.n ?? 0,
    leadsByStatus: Object.fromEntries(leadsByStatusRows.map((r) => [r.status, r.n])),
  };
}

/**
 * Lista paginada de usuários pro /admin/usuarios, com busca simples por
 * nome/e-mail e filtro opcional por status de assinatura (o que cobre
 * "clientes ativos/inativos/trial" do pedido).
 */
export async function listUsersForAdmin(opts: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

  // Bug real reportado pelo Thiago 2026-09-19: excluir um usuário "não fazia
  // nada" — na verdade fazia (soft delete + derruba sessão), só que a lista
  // nunca escondia quem já tinha `deletedAt` setado, então a linha continuava
  // aparecendo igual antes de excluir.
  const conditions = [isNull(users.deletedAt)];
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(ilike(users.name, term), ilike(users.email, term))!);
  }
  if (opts.status) {
    conditions.push(eq(users.subscriptionStatus, opts.status as (typeof users.subscriptionStatus.enumValues)[number]));
  }
  const where = and(...conditions);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        onboardingCompleted: users.onboardingCompleted,
        subscriptionPlan: users.subscriptionPlan,
        subscriptionStatus: users.subscriptionStatus,
        trialEndsAt: users.trialEndsAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(users).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0, page, pageSize };
}

export type AdminUserEditableFields = {
  name: string;
  email: string;
  role: (typeof userRoleEnum.enumValues)[number];
  subscriptionPlan: (typeof subscriptionPlanEnum.enumValues)[number];
  subscriptionStatus: (typeof subscriptionStatusEnum.enumValues)[number];
  trialEndsAt: Date;
};

/**
 * Criação de usuário pelo admin — pedido do Thiago 2026-09-19 depois de
 * tentar criar um acesso admin direto no Supabase e não funcionar: dava pra
 * escrever `role = 'ADMIN'` via SQL, mas não dava pra gerar um
 * `password_hash` bcrypt válido por SQL puro sem repetir a mesma lógica de
 * `hashPassword()` — por isso a conta criada não conseguia logar em
 * `/admin/login`. Esse caminho aqui usa a função de hash de verdade, então
 * cobre inclusive criar novos admins (não só clientes comuns).
 * `onboardingCompleted` começa `true` pra role != USER (staff não passa pela
 * introdução do produto) e `false` pra USER (cliente criado manualmente
 * ainda deveria ver o onboarding normal no primeiro login).
 */
export async function createUserForAdmin(
  fields: AdminUserEditableFields & { password: string }
): Promise<{ id: string }> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, fields.email)).limit(1);
  if (existing.length > 0) {
    throw new Error("Já existe uma conta com esse e-mail.");
  }

  const { hashPassword } = await import("@/lib/auth/password");
  const passwordHash = await hashPassword(fields.password);

  const [row] = await db
    .insert(users)
    .values({
      name: fields.name,
      email: fields.email,
      passwordHash,
      role: fields.role,
      onboardingCompleted: fields.role !== "USER",
      subscriptionPlan: fields.subscriptionPlan,
      subscriptionStatus: fields.subscriptionStatus,
      trialEndsAt: fields.trialEndsAt,
    })
    .returning({ id: users.id });

  return row;
}

/** Edição pontual de usuário pelo `/admin/usuarios` — pedido do Thiago 2026-09-19. */
export async function updateUserForAdmin(userId: string, fields: AdminUserEditableFields): Promise<void> {
  await db
    .update(users)
    .set({
      name: fields.name,
      email: fields.email,
      role: fields.role,
      subscriptionPlan: fields.subscriptionPlan,
      subscriptionStatus: fields.subscriptionStatus,
      trialEndsAt: fields.trialEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Exclusão de usuário pelo admin — soft delete (`deletedAt`), igual ao resto
 * do produto já trata contas removidas (`getCurrentUser()` recusa login pra
 * quem tem `deletedAt` setado), nunca um DELETE físico: a tabela `users` é
 * referenciada por praticamente todo o resto do schema (contas, lançamentos,
 * investimentos, sessões de chat...) e um hard delete arriscaria FK
 * violation ou apagar dado financeiro por engano. Também derruba toda sessão
 * ativa da pessoa na hora (`sessions`), pra excluir ter efeito imediato.
 * Nunca permite o admin excluir a própria conta por aqui — motivo por trás
 * de `guardUserId`, checado no server action.
 */
export async function softDeleteUserForAdmin(userId: string): Promise<void> {
  await db.update(users).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export type AdminLeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: (typeof leadStatusEnum.enumValues)[number];
  notes: string | null;
  createdAt: Date;
};

export async function listLeadsForAdmin(opts: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminLeadRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

  const conditions = [];
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(ilike(leads.name, term), ilike(leads.email, term), ilike(leads.phone, term)));
  }
  if (opts.status) {
    conditions.push(eq(leads.status, opts.status as (typeof leadStatusEnum.enumValues)[number]));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ n: count() }).from(leads).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0, page, pageSize };
}

export async function updateLeadStatus(leadId: string, status: (typeof leadStatusEnum.enumValues)[number]) {
  await db.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, leadId));
}

/**
 * Chamada no momento em que o pagamento de um usuário é confirmado
 * (`markSubscriptionActive`, quando `subscriptionStatus` vira "ACTIVE") —
 * pedido do Thiago 2026-09-19 pra linkar quem pagou com "convertido" no CRM
 * de leads automaticamente. Casa por e-mail (case-insensitive, comparando os
 * dois lados em minúsculo — não usa `ilike` puro porque um e-mail com `_`
 * seria interpretado como wildcard de um caractere) porque hoje não existe
 * nenhum id de lead guardado no cadastro do usuário pra casar por chave
 * direta; se um dia esse vínculo passar a existir (ex.: link de convite com
 * o id do lead na URL), trocar pra casar por id é mais confiável que por
 * e-mail. Não mexe em leads sem e-mail (import de CSV que só tinha
 * telefone) nem em leads já `CONVERTED`.
 */
export async function convertLeadsForPaidUser(userId: string, email: string): Promise<number> {
  const result = await db
    .update(leads)
    .set({ status: "CONVERTED", convertedUserId: userId, updatedAt: new Date() })
    .where(
      and(
        sql`lower(${leads.email}) = lower(${email})`,
        sql`${leads.status} != 'CONVERTED'`
      )
    )
    .returning({ id: leads.id });
  return result.length;
}

/**
 * Parser de CSV sem dependência externa — cobre o caso comum (aspas duplas
 * pra escapar vírgula/quebra de linha dentro de um campo, sem aspas
 * aninhadas). Pra CSVs mais malformados no futuro, trocar por uma lib de
 * verdade (papaparse) é queda de braço menor que este arquivo inteiro.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // skip, \n handles the row break
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => r.some((f) => f.trim().length > 0));
}

/**
 * Lê a primeira aba de um .xlsx/.xls e devolve no mesmo formato de
 * `parseCsv` (array de linhas, cada uma um array de células em texto) —
 * assim o resto do pipeline de import (cabeçalho em qualquer ordem, lotes de
 * 500, linha vazia pulada) é um só, não importa se o arquivo veio como CSV
 * ou Excel. `exceljs` em vez de `xlsx`/SheetJS de propósito: a versão do
 * `xlsx` disponível no npm tem CVE de prototype pollution conhecida sem fix
 * publicado lá (o fix só existe no registry próprio da SheetJS, que não é
 * alcançável daqui) — mesmo o upload sendo restrito a admin autenticado,
 * não vale a pena.
 */
async function parseExcelRows(buffer: ArrayBuffer): Promise<string[][]> {
  const { default: ExcelJSLib } = await import("exceljs");
  const workbook = new ExcelJSLib.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    // `row.values` é 1-indexado e o índice 0 vem undefined — pula ele.
    const values = row.values as ExcelJS.CellValue[];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      if (v == null) cells.push("");
      else if (v instanceof Date) cells.push(v.toISOString());
      else if (typeof v === "object" && "text" in v) cells.push(String((v as { text: unknown }).text ?? ""));
      else if (typeof v === "object" && "result" in v) cells.push(String((v as { result: unknown }).result ?? ""));
      else cells.push(String(v));
    }
    rows.push(cells);
  });
  return rows.filter((r) => r.some((f) => f.trim().length > 0));
}

/**
 * Núcleo do import de leads em lote, comum a CSV e Excel — recebe linhas já
 * parseadas (primeira linha = cabeçalho). Aceita cabeçalho em qualquer ordem
 * entre name/nome, email, phone/telefone/celular — tolera variação de
 * planilha exportada de CRM diferente. Insere em blocos de 500 (nada de um
 * único INSERT com 50 mil linhas) e nunca falha a leva inteira por causa de
 * uma linha ruim: linhas sem nome/e-mail/telefone (as 3 vazias) são só
 * puladas e contadas em `skipped`.
 */
export async function importLeadsFromRows(rows: string[][], source: string): Promise<{ imported: number; skipped: number; total: number }> {
  if (rows.length === 0) return { imported: 0, skipped: 0, total: 0 };

  // Acha o cabeçalho procurando nas primeiras linhas, não assumindo que é
  // sempre a linha 0 — planilha Excel exportada com uma linha de título
  // acima da tabela de verdade (comum, diferente de CSV) fazia o cabeçalho
  // "de fato" cair na linha 1 ou 2, e como nada batia com nome/email/telefone
  // na linha 0, TODAS as linhas de dado eram descartadas como "vazias" (bug
  // reportado pelo Thiago 2026-09-19: 0 de 39 importados).
  // Casa por substring depois de normalizar (minúsculo, sem acento, sem
  // pontuação/espaço) em vez de comparar a célula inteira contra uma lista
  // fechada — cabeçalho real de CRM varia muito ("E-mail do lead", "Nome
  // Completo", "Telefone/WhatsApp", "Contato"...) e uma comparação exata
  // batia só com "nome"/"email"/"telefone" sozinhos, descartando qualquer
  // variação como se a coluna não existisse.
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const NAME_KEYWORDS = ["nome", "name", "cliente", "lead"];
  const EMAIL_KEYWORDS = ["email", "mail"];
  const PHONE_KEYWORDS = ["telefone", "celular", "whatsapp", "fone", "contato", "phone", "tel"];
  const findByKeyword = (header: string[], keywords: string[]) =>
    header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const HEADER_SCAN_LIMIT = 5;
  let headerRowIndex = -1;
  let idx = { name: -1, email: -1, phone: -1 };
  for (let i = 0; i < Math.min(HEADER_SCAN_LIMIT, rows.length); i++) {
    const header = rows[i].map(normalize);
    // "email"/"mail" é o sinal mais confiável (dificilmente aparece em outra
    // coluna) — resolve ele primeiro pra não deixar "nome" grudar num
    // cabeçalho tipo "Nome do e-mail" achando a coluna errada.
    const emailCol = findByKeyword(header, EMAIL_KEYWORDS);
    const nameCol = findByKeyword(
      header.map((h, i2) => (i2 === emailCol ? "" : h)),
      NAME_KEYWORDS
    );
    const phoneCol = findByKeyword(
      header.map((h, i2) => (i2 === emailCol || i2 === nameCol ? "" : h)),
      PHONE_KEYWORDS
    );
    if (nameCol >= 0 || emailCol >= 0 || phoneCol >= 0) {
      headerRowIndex = i;
      idx = { name: nameCol, email: emailCol, phone: phoneCol };
      break;
    }
  }
  if (headerRowIndex === -1) {
    throw new Error(
      "Não encontrei uma coluna de nome, e-mail ou telefone nas primeiras linhas do arquivo. Confira se o cabeçalho usa um desses nomes."
    );
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const toInsert: (typeof leads.$inferInsert)[] = [];
  let skipped = 0;

  for (const r of dataRows) {
    const name = idx.name >= 0 ? r[idx.name]?.trim() : undefined;
    const email = idx.email >= 0 ? r[idx.email]?.trim() : undefined;
    const phone = idx.phone >= 0 ? r[idx.phone]?.trim() : undefined;
    if (!name && !email && !phone) {
      skipped++;
      continue;
    }
    toInsert.push({ name: name || null, email: email || null, phone: phone || null, source, status: "NEW" });
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    if (batch.length > 0) await db.insert(leads).values(batch);
  }

  return { imported: toInsert.length, skipped, total: dataRows.length };
}

/**
 * Ponto de entrada único do form de import — decide CSV vs Excel pela
 * extensão do arquivo e devolve linhas já parseadas prontas pro
 * `importLeadsFromRows`. Pedido do Thiago 2026-09-19: o form aceitava só
 * `.csv`, mas as planilhas que ele recebe às vezes são `.xlsx`/`.xls`.
 */
export async function importLeadsFromFile(file: File, source: string): Promise<{ imported: number; skipped: number; total: number }> {
  const name = file.name.toLowerCase();
  let rows: string[][];
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    rows = await parseExcelRows(await file.arrayBuffer());
  } else {
    rows = parseCsv(await file.text());
  }
  return importLeadsFromRows(rows, source);
}
