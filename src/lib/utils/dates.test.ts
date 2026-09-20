import { describe, it, expect } from "vitest";
import { parseDateOnly, parseDateOnlyOrNull, completeDayMonthOnly } from "./dates";

describe("parseDateOnly", () => {
  it("aceita ISO (YYYY-MM-DD)", () => {
    const d = parseDateOnly("2026-03-05");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // março = índice 2
    expect(d.getUTCDate()).toBe(5);
  });

  it("aceita ISO com componente de hora (prefixo)", () => {
    const d = parseDateOnly("2026-03-05T00:00:00.000Z");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(5);
  });

  it("aceita DD/MM/AAAA (formato BR comum em extratos)", () => {
    const d = parseDateOnly("05/03/2026");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // março, não maio — nunca MM/DD
    expect(d.getUTCDate()).toBe(5);
  });

  it("aceita DD-MM-AAAA", () => {
    const d = parseDateOnly("05-03-2026");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(5);
  });

  it("aceita DD/MM/AA assumindo 20AA", () => {
    const d = parseDateOnly("05/03/26");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(5);
  });

  it("aceita MM/AAAA assumindo dia 01 (competência do CNIS, sem dia)", () => {
    const d = parseDateOnly("10/2008");
    expect(d.getUTCFullYear()).toBe(2008);
    expect(d.getUTCMonth()).toBe(9); // outubro = índice 9
    expect(d.getUTCDate()).toBe(1);
  });

  it("aceita MM-AAAA", () => {
    const d = parseDateOnly("03-2020");
    expect(d.getUTCFullYear()).toBe(2020);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(1);
  });

  it("rejeita mês impossível em MM/AAAA", () => {
    expect(() => parseDateOnly("13/2020")).toThrow();
    expect(() => parseDateOnly("00/2020")).toThrow();
  });

  it("rejeita dia/mês impossível mesmo em formato BR", () => {
    expect(() => parseDateOnly("31/02/2026")).toThrow();
  });

  it("rejeita string completamente fora de formato", () => {
    expect(() => parseDateOnly("não é uma data")).toThrow();
    expect(() => parseDateOnly("")).toThrow();
  });
});

describe("parseDateOnlyOrNull", () => {
  it("devolve null em vez de lançar erro para data inválida", () => {
    expect(parseDateOnlyOrNull("lixo")).toBeNull();
    expect(parseDateOnlyOrNull(null)).toBeNull();
    expect(parseDateOnlyOrNull(undefined)).toBeNull();
  });

  it("devolve a data corretamente parseada para formato BR válido", () => {
    const d = parseDateOnlyOrNull("05/03/2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(5);
  });
});

describe("completeDayMonthOnly", () => {
  const ref = new Date(Date.UTC(2026, 8, 13, 12, 0, 0)); // 13/09/2026, fechamento típico de fatura

  it("completa DD/MM com o ano da referência quando o mês é próximo", () => {
    expect(completeDayMonthOnly("13/09", ref)).toBe("2026-09-13");
    expect(completeDayMonthOnly("18/08", ref)).toBe("2026-08-18");
    expect(completeDayMonthOnly("07/08", ref)).toBe("2026-08-07");
  });

  it("completa DD-MM com o ano da referência", () => {
    expect(completeDayMonthOnly("13-09", ref)).toBe("2026-09-13");
  });

  it("usa o ano anterior quando o mês da transação é dezembro mas a referência é janeiro (virada de ano)", () => {
    const refJan = new Date(Date.UTC(2027, 0, 5, 12, 0, 0)); // fatura fecha em janeiro/2027
    expect(completeDayMonthOnly("20/12", refJan)).toBe("2026-12-20");
  });

  it("usa o ano seguinte no caso simétrico (referência em dezembro, transação em janeiro)", () => {
    const refDec = new Date(Date.UTC(2026, 11, 20, 12, 0, 0));
    expect(completeDayMonthOnly("05/01", refDec)).toBe("2027-01-05");
  });

  it("devolve sem alteração datas que já têm ano ou não são DD/MM puro", () => {
    expect(completeDayMonthOnly("2026-09-13", ref)).toBe("2026-09-13");
    expect(completeDayMonthOnly("13/09/2026", ref)).toBe("13/09/2026");
    expect(completeDayMonthOnly("10/2008", ref)).toBe("10/2008");
  });
});
