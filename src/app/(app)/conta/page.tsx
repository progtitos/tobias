import { requireOnboardedUser } from "@/lib/auth/guards";
import { listBankAccounts } from "@/services/bankAccounts";
import { listCreditCards, getCreditCardsUsage } from "@/services/creditCards";
import { computeNetWorth } from "@/services/aggregations";
import { sumInvestmentsByAccount } from "@/services/investments";
import { ContaClient } from "./ContaClient";

export default async function ContaPage() {
  const user = await requireOnboardedUser();
  const [accounts, creditCards, cardsUsage, netWorth, investedByAccount] = await Promise.all([
    listBankAccounts(user.id),
    listCreditCards(user.id),
    getCreditCardsUsage(user.id),
    computeNetWorth(user.id),
    sumInvestmentsByAccount(user.id),
  ]);

  return (
    <ContaClient
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        ownerName: a.ownerName,
        type: a.type,
        balance: a.balance,
        isActive: a.isActive,
        invested: investedByAccount[a.id] ?? 0,
      }))}
      creditCards={creditCards.map((c) => ({
        id: c.id,
        bankAccountId: c.bankAccountId,
        nickname: c.nickname,
        brand: c.brand,
        lastFourDigits: c.lastFourDigits,
        limitAmount: c.limitAmount,
        closingDay: c.closingDay,
        dueDay: c.dueDay,
      }))}
      cardsUsage={cardsUsage}
      totalInvested={netWorth.investedAssets}
    />
  );
}
