import { describe, expect, it } from 'vitest';
import { checklist, currentCycle, EMPTY_ANSWERS, evaluate, irpfStatus, shouldRemind } from '../irpf';

describe('calendário do imposto de renda', () => {
  it('o ciclo atual é o próximo prazo que ainda não acabou', () => {
    expect(currentCycle('2026-04-10').year).toBe(2026);
    expect(currentCycle('2026-11-15').year).toBe(2027);
  });

  it('fases e avisos ao longo do ano', () => {
    expect(irpfStatus('2026-11-15').phase).toBe('preparar');
    expect(shouldRemind(irpfStatus('2026-11-15'))).toBe(false);
    expect(irpfStatus('2027-01-10').phase).toBe('documentos');
    expect(irpfStatus('2027-03-05')).toMatchObject({ phase: 'abre-em-breve', daysToOpen: 10 });
    expect(irpfStatus('2027-04-01').phase).toBe('aberta');
    expect(irpfStatus('2027-05-20')).toMatchObject({ phase: 'reta-final', daysLeft: 12 });
    expect(irpfStatus('2027-05-31')).toMatchObject({ phase: 'ultimos-dias', daysLeft: 1, title: 'hoje é o último dia!' });
    expect(shouldRemind(irpfStatus('2027-05-20'))).toBe(true);
  });

  it('datas de 2027 aparecem como previsão até serem oficiais', () => {
    expect(irpfStatus('2027-04-01').message).toContain('(previsão)');
    expect(irpfStatus('2026-04-01').message).not.toContain('(previsão)');
  });
});

describe('preciso declarar?', () => {
  const cycle = currentCycle('2026-04-01');
  it('acima do limite de rendimentos tributáveis', () => {
    const r = evaluate({ ...EMPTY_ANSWERS, taxableIncome: 3600000 }, cycle);
    expect(r.mustDeclare).toBe(true);
    expect(r.reasons[0]).toContain('35.584');
  });
  it('abaixo de todos os limites', () => {
    const r = evaluate(
      { taxableIncome: 3000000, exemptOver: false, assetsOver: false, capitalGain: false, stockMarket: false, rural: false, newResident: false, abroad: false },
      cycle,
    );
    expect(r).toEqual({ mustDeclare: false, reasons: [], incomplete: false });
  });
  it('bens acima do limite obrigam mesmo com renda baixa', () => {
    expect(evaluate({ ...EMPTY_ANSWERS, taxableIncome: 100000, assetsOver: true }, cycle).mustDeclare).toBe(true);
  });
});

describe('lista de documentos', () => {
  it('monta a lista conforme a situação', () => {
    const ids = checklist(['clt', 'saude']).map((i) => i.id);
    expect(ids).toEqual(['govbr', 'anterior', 'banco', 'informe-empresa', 'recibos-saude', 'plano-saude']);
  });
});
