import { listEmailCampaigns, getEmailConfigStatus } from "@/services/emailMarketing";
import { MarketingClient } from "./MarketingClient";

export default async function AdminMarketingPage() {
  const [campaigns, { configured }] = await Promise.all([listEmailCampaigns(), Promise.resolve(getEmailConfigStatus())]);

  return <MarketingClient campaigns={campaigns} configured={configured} />;
}
