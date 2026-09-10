import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Termos de Uso: Tobias" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-50 px-5 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-900 mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o Tobias
        </Link>

        <h1 className="font-serif text-2xl text-brand-950 mb-1">Termos de Uso</h1>
        <p className="text-xs text-ink-400 mb-6">
          Versão de rascunho do MVP, ainda não revisada por um advogado. Deve ser substituída por uma versão
          revisada antes do lançamento público.
        </p>

        <div className="space-y-5 text-sm text-ink-700 leading-relaxed">
          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">O que é o Tobias</h2>
            <p>
              O Tobias é um assistente de planejamento financeiro pessoal apoiado por inteligência artificial. Ele
              organiza os dados que você registra, calcula projeções e sugere ações, mas as decisões financeiras
              finais são sempre suas.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">O Tobias não é um consultor financeiro certificado</h2>
            <p>
              As projeções, diagnósticos e recomendações do Tobias (incluindo a Bússola Financeira, a Curva de
              Aposentadoria e o assistente &quot;Posso comprar?&quot;) são estimativas baseadas em fórmulas e nos
              dados que você forneceu. Não são aconselhamento financeiro, contábil, jurídico ou de investimento
              profissional. Decisões importantes devem ser validadas com um profissional qualificado.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Período de teste e assinatura</h2>
            <p>
              Novas contas começam com um período de teste gratuito de 15 dias. Após o período de teste, o acesso a
              recursos pagos pode ser encerrado ou limitado, conforme o plano vigente no momento.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Responsabilidade sobre os dados inseridos</h2>
            <p>
              Você é responsável pela exatidão dos dados que insere manualmente ou por foto de recibo. O Tobias
              sinaliza sempre que uma informação vem de uma estimativa da IA em vez de um dado real que você
              confirmou.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-ink-900 mb-1.5">Cancelamento</h2>
            <p>Você pode excluir sua conta a qualquer momento em Configurações → Zona de risco.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
