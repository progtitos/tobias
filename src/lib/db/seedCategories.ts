import "server-only";
import { isNull, eq, and } from "drizzle-orm";
import { db } from "./client";
import { categories } from "./schema";

type Kind = "INCOME" | "EXPENSE" | "INVESTMENT";

const CATEGORY_TREE: { name: string; type: Kind; icon: string; children?: string[] }[] = [
  { name: "Moradia", type: "EXPENSE", icon: "home", children: ["Aluguel", "Condomínio", "Financiamento", "Manutenção"] },
  { name: "Alimentação", type: "EXPENSE", icon: "utensils", children: ["Supermercado", "Restaurante", "Delivery"] },
  { name: "Transporte", type: "EXPENSE", icon: "car", children: ["Combustível", "Transporte por app", "Transporte público", "Manutenção do veículo"] },
  { name: "Saúde", type: "EXPENSE", icon: "heart-pulse", children: ["Plano de saúde", "Farmácia", "Consultas"] },
  { name: "Educação", type: "EXPENSE", icon: "graduation-cap", children: ["Escola", "Faculdade", "Cursos"] },
  { name: "Lazer", type: "EXPENSE", icon: "party-popper", children: ["Streaming", "Cinema e shows", "Hobbies"] },
  { name: "Viagens", type: "EXPENSE", icon: "plane" },
  { name: "Compras", type: "EXPENSE", icon: "shopping-bag", children: ["Roupas", "Eletrônicos", "Casa"] },
  { name: "Família", type: "EXPENSE", icon: "users" },
  { name: "Filhos", type: "EXPENSE", icon: "baby" },
  { name: "Impostos", type: "EXPENSE", icon: "receipt" },
  { name: "Seguros", type: "EXPENSE", icon: "shield" },
  { name: "Assinaturas", type: "EXPENSE", icon: "repeat" },
  { name: "Dívidas", type: "EXPENSE", icon: "credit-card", children: ["Cartão de crédito", "Empréstimo", "Financiamento"] },
  { name: "Doações", type: "EXPENSE", icon: "hand-heart" },
  { name: "Trabalho", type: "EXPENSE", icon: "briefcase" },
  { name: "Outros", type: "EXPENSE", icon: "more-horizontal" },
  { name: "Investimentos", type: "INVESTMENT", icon: "trending-up" },
  { name: "Salário", type: "INCOME", icon: "wallet" },
  { name: "Freelance", type: "INCOME", icon: "laptop" },
  { name: "Aluguel recebido", type: "INCOME", icon: "key" },
  { name: "Rendimentos", type: "INCOME", icon: "line-chart" },
  { name: "Outras receitas", type: "INCOME", icon: "more-horizontal" },
];

/** Idempotent: only seeds if no global (userId=null) categories exist yet. */
export async function seedGlobalCategoriesIfNeeded() {
  const existing = await db.select({ id: categories.id }).from(categories).where(isNull(categories.userId)).limit(1);
  if (existing.length > 0) return { seeded: false };

  for (const top of CATEGORY_TREE) {
    const [parent] = await db
      .insert(categories)
      .values({ userId: null, name: top.name, type: top.type, icon: top.icon, isSystem: true })
      .returning({ id: categories.id });

    if (top.children?.length) {
      await db.insert(categories).values(
        top.children.map((childName) => ({
          userId: null,
          name: childName,
          type: top.type,
          parentId: parent.id,
          isSystem: true,
        }))
      );
    }
  }
  return { seeded: true };
}

export async function getGlobalAndUserCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.isSystem, true), isNull(categories.userId)))
    .then(async (systemCats) => {
      const userCats = await db.select().from(categories).where(eq(categories.userId, userId));
      return [...systemCats, ...userCats];
    });
}
