"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "../../adminFormat";
import {
  createWhatsAppCampaignAction,
  previewWhatsAppAudienceAction,
  sendWhatsAppCampaignAction,
  type CreateWhatsAppCampaignState,
} from "./actions";
import type { WhatsAppCampaignRow } from "@/services/whatsappMarketing";

const STATUS_BADGE: Record<WhatsAppCampaignRow["status"], { tone: "neutral" | "gold" | "ok" | "danger"; label: string }> = {
  DRAFT: { tone: "neutral", label: "Rascunho" },
  SENDING: { tone: "gold", label: "Enviando" },
  SENT: { tone: "ok", label: "Enviada" },
  FAILED: { tone: "danger", label: "Falhou" },
};

function CampaignComposer() {
  const [state, formAction, pending] = useActionState<CreateWhatsAppCampaignState, FormData>(
    createWhatsAppCampaignAction,
    undefined
  );
  const [audience, setAudience] = useState<number | null>(null);
  const [, startAudienceTransition] = useTransition();

  useEffect(() => {
    startAudienceTransition(async () => {
      const count = await previewWhatsAppAudienceAction();
      setAudience(count);
    });
  }, [startAudienceTransition]);

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <h2 className="font-sans font-semibold text-onbrand mb-1">Nova campanha</h2>
        <p className="text-xs text-onbrand/50 mb-4">
          Usa o mesmo template pré-aprovado pela Meta para todos os destinatários. Fora da janela de 24h de conversa, a
          API da Meta só aceita templates de marketing aprovados, não texto livre.
        </p>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="templateName">Nome do template (aprovado na Meta)</Label>
              <Input id="templateName" name="templateName" placeholder="Ex.: promo_setembro" required />
            </div>
            <div>
              <Label htmlFor="templateLanguage">Idioma do template</Label>
              <Input id="templateLanguage" name="templateLanguage" defaultValue="pt_BR" required />
            </div>
          </div>

          <p className="text-sm text-onbrand/70">
            Audiência: {audience === null ? "carregando..." : `${audience} contato(s) com WhatsApp verificado e opt-in`}.
          </p>

          <FieldError>{state?.error}</FieldError>

          <Button type="submit" loading={pending}>
            Criar campanha (rascunho)
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CampaignRow({ campaign }: { campaign: WhatsAppCampaignRow }) {
  const [confirmSend, setConfirmSend] = useState(false);
  const [pending, startTransition] = useTransition();
  const badge = STATUS_BADGE[campaign.status];

  return (
    <tr className="even:bg-onbrand/[0.025]">
      <td className="px-4 py-3 text-onbrand font-medium max-w-[220px] truncate">{campaign.templateName}</td>
      <td className="px-4 py-3 text-onbrand/60">{campaign.templateLanguage}</td>
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
        title={`Enviar "${campaign.templateName}" para ${campaign.recipientCount} contato(s)?`}
        description="Isso dispara mensagens de WhatsApp de verdade agora. Não pode ser desfeito."
        pending={pending}
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => {
          startTransition(async () => {
            const result = await sendWhatsAppCampaignAction(campaign.id);
            if (result.error) toast.error(result.error);
            setConfirmSend(false);
          });
        }}
      />
    </tr>
  );
}

export function WhatsAppMarketingClient({
  campaigns,
  configured,
}: {
  campaigns: WhatsAppCampaignRow[];
  configured: boolean;
}) {
  return (
    <div>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Marketing (WhatsApp)</h1>
      <p className="text-sm text-onbrand/55 mb-6">
        Disparo em massa via WhatsApp Business, só para contatos com opt-in verificado.
      </p>

      {!configured && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <p className="text-sm text-warn-400">
              WhatsApp Business ainda não está configurado (WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID). Você pode
              criar campanhas como rascunho, mas o envio fica bloqueado até a conta ser configurada e ter pelo menos
              um template de marketing aprovado pela Meta.
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
                <th className="px-4 pt-4 pb-2.5 font-medium">Template</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Idioma</th>
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
                  <td colSpan={8} className="px-4 py-8 text-center text-onbrand/50">
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
