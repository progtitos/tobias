import { redirect } from "next/navigation";

// Sonhos saiu do menu principal e mora dentro de Patrimônio agora — mantido
// como redirecionamento por segurança, caso alguém tenha essa URL salva
// (favorito, link enviado pelo Tobias em conversas antigas, etc.).
export default function GoalsPage() {
  redirect("/patrimonio#sonhos");
}
