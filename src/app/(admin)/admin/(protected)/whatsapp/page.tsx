import { listWhatsAppCampaigns, getWhatsAppMarketingConfigStatus } from "@/services/whatsappMarketing";
import { WhatsAppMarketingClient } from "./WhatsAppMarketingClient";

export default async function AdminWhatsAppPage() {
  const campaigns = await listWhatsAppCampaigns();
  const { configured } = getWhatsAppMarketingConfigStatus();

  return <WhatsAppMarketingClient campaigns={campaigns} configured={configured} />;
}
