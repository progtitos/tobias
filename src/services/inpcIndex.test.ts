import { describe, it, expect } from "vitest";
import { corrigirPeloInpc, fatorCorrecaoInpc, isCompetenciaElegivel, ULTIMO_ANO_FECHADO } from "./inpcIndex";

describe("inpcIndex", () => {
  it("não corrige (fator 1) uma competência do último ano fechado", () => {
    expect(fatorCorrecaoInpc(ULTIMO_ANO_FECHADO)).toBe(1);
  });

  it("não corrige (fator 1) uma competência mais recente que o último ano fechado", () => {
    expect(fatorCorrecaoInpc(ULTIMO_ANO_FECHADO + 1)).toBe(1);
  });

  it("corrige um valor antigo para cima (mais anos entre a competência e hoje = correção maior)", () => {
    const fator2010 = fatorCorrecaoInpc(2010);
    const fator2020 = fatorCorrecaoInpc(2020);
    expect(fator2010).toBeGreaterThan(fator2020);
    expect(fator2020).toBeGreaterThan(1);
  });

  it("trata 1994 com o mesmo fator de 1995 (fallback documentado)", () => {
    expect(fatorCorrecaoInpc(1994)).toBe(fatorCorrecaoInpc(1995));
  });

  it("corrigirPeloInpc aplica o fator ao valor", () => {
    const competencia = new Date(Date.UTC(2020, 0, 1));
    expect(corrigirPeloInpc(1000, competencia)).toBeCloseTo(1000 * fatorCorrecaoInpc(2020));
  });

  it("competência antes de jul/1994 não é elegível", () => {
    expect(isCompetenciaElegivel(new Date(Date.UTC(1994, 5, 1)))).toBe(false);
    expect(isCompetenciaElegivel(new Date(Date.UTC(1994, 6, 1)))).toBe(true);
    expect(isCompetenciaElegivel(new Date(Date.UTC(2020, 0, 1)))).toBe(true);
  });
});
