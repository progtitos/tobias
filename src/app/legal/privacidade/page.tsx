import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Política de Privacidade — Tobias" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream-50 px-5 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-900 mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o Tobias
        </Link>

        <h1 className="font-serif text-2xl text-brand-950 mb-1">Política de Privacidade</h1>
        <p className="text-xs text-ink-400 mb-6">
          Versão de rascunho do MVP — ainda não revisada por um advogado. Deve ser substituída por uma versão
          revisada antes do lançamento público.
        </p>

        <div className="space-y-5 text-sm text-ink-700 leading-relaxed">
          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">O que coletamos</h2>
            <p>
              Coletamos os dados que você nos conta diretamente (nome, e-mail, e as informações financeiras que você
              compartilha no onboarding e no chat com o Tobias) e os dados que você registra no app: gastos,
              receitas, objetivos, notas fiscais fotografadas e conversas. Não coletamos dados bancários reais nesta
              versão — tudo é inserido manualmente ou por foto de recibo.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Como usamos seus dados</h2>
            <p>
              Seus dados financeiros são usados exclusivamente para gerar o seu próprio plano, dashboard, orçamento e
              recomendações — nunca são vendidos ou compartilhados com terceiros para fins de publicidade. Parte do
              processamento (leitura de notas fiscais, geração de respostas do chat, análises de compra) é feita por
              um modelo de inteligência artificial (Google Gemini), para o qual enviamos o contexto financeiro
              necessário para responder à sua pergunta.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Onde seus dados ficam armazenados</h2>
            <p>
              Seus dados ficam em um banco de dados Postgres hospedado (Supabase), protegido por senha com hash e
              isolado por conta — cada consulta ao banco é sempre filtrada pelo seu usuário.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Seus direitos</h2>
            <p>
              Você pode excluir permanentemente sua conta e todos os seus dados a qualquer momento, em
              Configurações → Zona de risco. A exclusão remove seu perfil, transações, objetivos, conversas e
              qualquer outro dado financeiro associado à sua conta — não fica nenhuma cópia guardada além dos
              registros mínimos exigidos por lei (quando aplicável).
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Contato</h2>
            <p>Dúvidas sobre privacidade podem ser enviadas para o e-mail de suporte do Tobias.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
