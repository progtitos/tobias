import { getFinanceOverview, getMonthlyChargeEvents, getPastDuePayments, getMercadoPagoSyncStatus } from "@/services/adminFinance";
import { FinanceiroClient } from "./FinanceiroClient";

export default async function AdminFinanceiroPage() {
  const [overview, monthlySeries, pastDue, syncStatus] = await Promise.all([
    getFinanceOverview(),
    getMonthlyChargeEvents(12),
    getPastDuePayments(),
    getMercadoPagoSyncStatus(),
  ]);

  return (
    <FinanceiroClient
      mrr={overview.mrr}
      activeSubscribers={overview.activeSubscribers}
      trialing={overview.trialing}
      pastDueCount={overview.pastDue}
      canceled={overview.canceled}
      plans={overview.plans}
      monthlySeries={monthlySeries}
      pastDue={pastDue}
      syncStatus={syncStatus}
    />
  );
}
