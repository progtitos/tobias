#!/usr/bin/env bash
# Aplica a correção da causa raiz das bordas brancas (rodada final) e limpa
# os arquivos .patch que ficaram commitados no repositório por engano.
# Rode este script na RAIZ do seu clone local do tobias.
set -euo pipefail

if [ ! -f "package.json" ] || [ ! -d "src" ]; then
  echo "Rode este script na raiz do repositório tobias (onde está o package.json)." >&2
  exit 1
fi

echo "== Removendo patches soltos do repositório =="
PATCHES=(
  0007-feat-curva-aposentadoria-pilares-inss.patch
  0008-fix-vitest-types-node-peer-dep.patch
  0009-feat-reskin-Dashboard-para-dire-o-visual-energia-tip.patch
  0010-Revert-feat-reskin-Dashboard-para-dire-o-visual-ener.patch
  0011-feat-redesenha-onboarding-e-chat-na-Dire-o-A-acolhim.patch
  0012-feat-perfil-comportamental-PCA-dados-de-INSS-no-onbo.patch
  0020-fix-texto-do-bot-o-de-cadastro-base-CSS-do-avatar-in.patch
  0021-fix-security-corrige-vazamento-de-reset-de-senha-adi.patch
  0022-feat-comemora-o-contida-ao-bater-meta-na-tela-de-Pat.patch
  0023-fix-suaviza-borda-branca-do-bal-o-do-Tobias-no-chat-.patch
  0024-fix-corrige-sequ-ncia-onboarding-conectar-contas-tou.patch
  0025-fix-garante-coleta-de-idade-no-onboarding-para-a-cur.patch
  0026-feat-reescreve-landing-page-sem-Open-Finance-IA-cate.patch
  0027-feat-troca-se-o-Pilares-da-LP-para-a-Op-o-B-trilha-h.patch
  claude-patches/0001-fix-deixa-claro-no-grafico-de-aposentadoria-que-a-cu.patch
  claude-patches/0002-feat-painel-admin-usuarios-assinaturas-e-CRM-de-lead.patch
  claude-patches/0003-fix-abole-bordas-brancas-fixas-do-DS-e-reconstroi-Ad.patch
  claude-patches/0004-fix-corrige-contraste-ilegivel-botao-primario-bolha-tobias.patch
  claude-patches/0005-feat-guia-obrigatorio-primeiro-acesso.patch
)
for p in "${PATCHES[@]}"; do
  if [ -e "$p" ]; then
    git rm -q --cached --ignore-unmatch "$p" 2>/dev/null || true
    rm -f "$p"
    echo "  removido: $p"
  fi
done
rmdir claude-patches 2>/dev/null || true

echo "== Copiando arquivos corrigidos (causa raiz das bordas brancas) =="
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -v "$SELF_DIR/.gitignore" .gitignore
mkdir -p "src/app/(app)/chat" "src/app/onboarding" "src/components/chat" "src/components/landing"
cp -v "$SELF_DIR/src/app/globals.css" src/app/globals.css
cp -v "$SELF_DIR/src/app/onboarding/layout.tsx" src/app/onboarding/layout.tsx
cp -v "$SELF_DIR/src/app/(app)/chat/ChatPageClient.tsx" "src/app/(app)/chat/ChatPageClient.tsx"
cp -v "$SELF_DIR/src/components/chat/ChatWindow.tsx" src/components/chat/ChatWindow.tsx
cp -v "$SELF_DIR/src/components/landing/BrandButton.tsx" src/components/landing/BrandButton.tsx
cp -v "$SELF_DIR/src/components/landing/GifPlaceholder.tsx" src/components/landing/GifPlaceholder.tsx
cp -v "$SELF_DIR/src/components/landing/Header.tsx" src/components/landing/Header.tsx
cp -v "$SELF_DIR/src/components/landing/Home.tsx" src/components/landing/Home.tsx

echo "== Status do git =="
git add -A
git status --short

cat <<MSG

Pronto. Confira o "git status" acima, e se estiver tudo certo:

  git commit -m "fix: causa raiz das bordas brancas (reset global fora de @layer) + limpa patches soltos do repo"
  git push

MSG
