// Helper puro (sem "use client") pra poder ser chamado tanto de Server
// Components (page.tsx) quanto importado por Client Components — um export
// de um módulo "use client" vira uma referência opaca em RSC e não pode ser
// CHAMADO como função direto de um Server Component, só usado como
// componente/prop (foi exatamente esse erro em runtime que isolar aqui evita).
export function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}
