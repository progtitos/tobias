import "server-only";
import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, leads, leadStatusEnum } from "@/lib/db/schema";
import { trackEvent } from "./analytics";

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

  const [totalRow, byStatusRows, byPlanRows, newLast30Row, totalLeadsRow, leadsByStatusRows] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ status: users.subscriptionStatus, n: count() }).from(users).groupBy(users.subscriptionStatus),
    db.select({ plan: users.subscriptionPlan, n: count() }).from(users).groupBy(users.subscriptionPlan),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo)),
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

  const conditions = [];
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(ilike(users.name, term), ilike(users.email, term)));
  }
  if (opts.status) {
    conditions.push(eq(users.subscriptionStatus, opts.status as (typeof users.subscriptionStatus.enumValues)[number]));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

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
 * Importa um CSV de leads em lote. Aceita cabeçalho em qualquer ordem entre
 * name/nome, email, phone/telefone/celular — tolera variação de planilha
 * exportada de CRM diferente. Insere em blocos de 500 (nada de um único
 * INSERT com 50 mil linhas) e nunca falha a leva inteira por causa de uma
 * linha ruim: linhas sem nome/e-mail/telefone (as 3 vazias) são só puladas e
 * contadas em `skipped`.
 */
export async function importLeadsFromCsv(csvText: string, source: string): Promise<{ imported: number; skipped: number; total: number }> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return { imported: 0, skipped: 0, total: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.findIndex((h) => ["name", "nome", "nome completo"].includes(h)),
    email: header.findIndex((h) => ["email", "e-mail", "e_mail"].includes(h)),
    phone: header.findIndex((h) => ["phone", "telefone", "celular", "whatsapp"].includes(h)),
  };

  const dataRows = rows.slice(1);
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
