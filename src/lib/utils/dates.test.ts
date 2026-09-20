import { describe, it, expect } from "vitest";
import { parseDateOnly, parseDateOnlyOrNull } from "./dates";

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
