"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "../../adminFormat";
import { createCampaignAction, previewAudienceAction, sendCampaignAction, type CreateCampaignState } from "./actions";
import type { EmailCampaignRow } from "@/services/emailMarketing";

const LEAD_STATUS_OPTIONS = [
  { value: "NEW", label: "Novo" },
  { value: "CONTACTED", label: "Contatado" },
  { value: "QUALIFIED", label: "Qualificado" },
  { value: "CONVERTED", label: "Convertido" },
  { value: "LOST", label: "Perdido" },
] as const;

const USER_STATUS_OPTIONS = [
  { value: "TRIALING", label: "Em trial" },
  { value: "ACTIVE", label: "Assinante ativo" },
  { value: "PAST_DUE", label: "Pagamento em atraso" },
  { value: "CANCELED", label: "Cancelado" },
] as const;

const STATUS_BADGE: Record<EmailCampaignRow["status"], { tone: "neutral" | "gold" | "ok" | "danger"; label: string }> = {
  DRAFT: { tone: "neutral", label: "Rascunho" },
  SENDING: { tone: "gold", label: "Enviando" },
  SENT: { tone: "ok", label: "Enviada" },
  FAILED: { tone: "danger", label: "Falhou" },
};

function CampaignComposer() {
  const [state, formAction, pending] = useActionState<CreateCampaignState, FormData>(createCampaignAction, undefined);
  const [audiencePreview, setAudiencePreview] = useState<number | null>(null);
  const [previewPending, startPreviewTransition] = useTransition();
  const [body, setBody] = useState("");

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <h2 className="font-sans font-semibold text-onbrand mb-1">Nova campanha</h2>
        <p className="text-xs text-onbrand/50 mb-4">
          Todo envio inclui automaticamente um link de descadastro real no rodapé, não é possível remover.
        </p>
        <form
          action={(formData) => {
            setAudiencePreview(null);
            formAction(formData);
          }}
          className="space-y-4"
        >
          <div>
            <p className="text-xs font-medium text-onbrand/70 mb-2">Audiência: leads por status</p>
            <div className="flex flex-wrap gap-3">
              {LEAD_STATUS_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm text-onbrand/80">
                  <input type="checkbox" name="leadStatuses" value={opt.value} className="h-4 w-4 rounded accent-gold-500" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-onbrand/70 mb-2">Audiência: usuários por status de assinatura</p>
            <div className="flex flex-wrap gap-3">
              {USER_STATUS_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm text-onbrand/80">
                  <input type="checkbox" name="userStatuses" value={opt.value} className="h-4 w-4 rounded accent-gold-500" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Assunto</Label>
            <Input id="subject" name="subject" placeholder="Ex.: Novidades no Tobias este mês" required />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bodyHtml">Corpo do e-mail (HTML)</Label>
              <Textarea
                id="bodyHtml"
                name="bodyHtml"
                rows={10}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<p>Olá! ...</p>"
              />
            </div>
            <div>
              <Label htmlFor="preview">Pré-visualização</Label>
              <iframe
                id="preview"
                title="Pré-visualização do e-mail"
                srcDoc={body || "<p style='font-family:sans-serif;color:#999'>A pré-visualização aparece aqui.</p>"}
                className="w-full h-[218px] rounded-lg border border-onbrand/10 bg-white"
              />
            </div>
          </div>

          <FieldError>{state?.error}</FieldError>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={previewPending}
              onClick={(e) => {
                const form = (e.currentTarget as HTMLButtonElement).closest("form");
                if (!form) return;
                const formData = new FormData(form);
                startPreviewTransition(async () => {
                  const count = await previewAudienceAction(formData);
                  setAudiencePreview(count);
                });
              }}
            >
              Ver tamanho da audiência
            </Button>
            {audiencePreview !== null && (
              <span className="text-sm text-onbrand/70">
                {audiencePreview} destinatário(s) únicos, sem contar quem já descadastrou.
              </span>
            )}
            <Button type="submit" loading={pending} className="ml-auto">
              Criar campanha (rascunho)
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CampaignRow({ campaign }: { campaign: EmailCampaignRow }) {
  const [confirmSend, setConfirmSend] = useState(false);
  const [pending, startTransition] = useTransition();
  const badge = STATUS_BADGE[campaign.status];

  return (
    <tr className="even:bg-onbrand/[0.025]">
      <td className="px-4 py-3 text-onbrand font-medium max-w-[240px] truncate">{campaign.subject}</td>
      <td className="px-4 py-3">
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </td>
      <td className="px-4 py-3 text-onbrand/70 tabular-nums">{campaign.recipientCount}</td>
      <td className="px-4 py-3 text-ok-400 tabular-nums">{campaign.sentCount}</td>
      <td className="px-4 py-3 text-danger-300 tabular-nums">{campaign.failedCount}</td>
      <td className="px-4 py-3 text-onbrand/60 tabular-nums">{formatDate(campaign.createdAt)}</td>
      <td className="px-4 py-3 text-right">
        {campaign.status === "DRAFT" && (
          <Button type="button" size="sm" loading={pending} onClick={() => setConfirmSend(true)}>
            <Send className="h-3.5 w-3.5" /> Enviar
          </Button>
        )}
      </td>

      <ConfirmDialog
        open={confirmSend}
        title={`Enviar "${campaign.subject}" para ${campaign.recipientCount} destinatário(s)?`}
        description="Isso dispara e-mails de verdade agora. Não pode ser desfeito."
        pending={pending}
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => {
          startTransition(async () => {
            const result = await sendCampaignAction(campaign.id);
            if (result.error) toast.error(result.error);
            setConfirmSend(false);
          });
        }}
      />
    </tr>
  );
}

export function MarketingClient({ campaigns, configured }: { campaigns: EmailCampaignRow[]; configured: boolean }) {
  return (
    <div>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Marketing (e-mail)</h1>
      <p className="text-sm text-onbrand/55 mb-6">Campanhas de e-mail para leads e usuários, via Resend.</p>

      {!configured && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <p className="text-sm text-warn-400">
              Resend ainda não está configurado (RESEND_API_KEY/RESEND_FROM_EMAIL). Você pode criar campanhas como
              rascunho, mas o envio fica bloqueado até essas variáveis serem configuradas.
            </p>
          </CardContent>
        </Card>
      )}

      <CampaignComposer />

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onbrand/50 text-xs uppercase tracking-wide">
                <th className="px-4 pt-4 pb-2.5 font-medium">Assunto</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Status</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Audiência</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Enviados</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Falhas</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Criada em</th>
                <th className="px-4 pt-4 pb-2.5 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-onbrand/50">
                    Nenhuma campanha criada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
