/**
 * Sinal client-side (localStorage, não sessionStorage: o link "Prefiro subir
 * um extrato agora" do ConnectAccountsStep abre em outra ABA, e
 * sessionStorage não atravessa abas) que avisa o MandatoryTourOverlay pra
 * não sequestrar a tela enquanto a revelação final do onboarding
 * (ProfileRevealOverlay) ainda está em andamento.
 *
 * Sem isso, abrir /conta nessa aba nova caía direto no tour obrigatório
 * antes da pessoa conseguir usar o link de verdade — e, mesmo sem abrir
 * outra aba, o próprio "Ir para o Dashboard" caía num tour com zero
 * respiro (Thiago, 25/09/2026, itens 1 e 2: "já foi direto para o tour da
 * plataforma" / "isso acaba com a surpresa da tela de início").
 *
 * Não mexe em `users.onboardingCompleted` (que continua controlando acesso
 * às rotas de `(app)` via `requireOnboardedUser`) — é só uma janela de
 * cortesia local, com expiração, pro `MandatoryTourOverlay` respeitar
 * enquanto a pessoa ainda está dentro da experiência de revelação.
 */
const KEY = "tobias:onboardingRevealUntil";
const WINDOW_MS = 30 * 60 * 1000; // 30 min — bem mais que o uso real, só uma rede de segurança contra abas esquecidas abertas

export function suppressMandatoryTourDuringReveal() {
  try {
    window.localStorage.setItem(KEY, String(Date.now() + WINDOW_MS));
  } catch {
    // localStorage indisponível (modo privado, quota cheia etc.) — o tour
    // simplesmente não ganha essa proteção extra, sem quebrar o resto do fluxo.
  }
}

export function clearMandatoryTourSuppression() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ver acima
  }
}

export function isMandatoryTourSuppressed(): boolean {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}
