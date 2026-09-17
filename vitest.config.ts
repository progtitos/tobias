import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Escopo mínimo de propósito: só services (lógica pura, sem DB/Next), que é
// o que o projeto tem testável hoje. Componentes/rotas ficam fora — exigiria
// jsdom + mocks de Next/Drizzle, um projeto à parte do que este runner foi
// criado para resolver (testar services/inss.ts).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/services/**/*.test.ts"],
  },
});
