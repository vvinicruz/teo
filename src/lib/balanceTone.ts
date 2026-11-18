import type { BalanceTone } from '../domain/finance';
import { colors } from '../theme';

/** cor do número do saldo: verde (positivo), amarelo (abaixo da reserva), vermelho (negativo). */
export const BALANCE_COLOR: Record<BalanceTone, string> = {
  positivo: colors.income,
  reserva: colors.attention,
  negativo: colors.danger,
  zero: colors.textSoft,
};

/** fundo suave do dia no horizonte, quando pede atenção. */
export const BALANCE_SOFT: Record<BalanceTone, string | null> = {
  positivo: null,
  reserva: colors.attentionSoft,
  negativo: colors.dangerSoft,
  zero: null,
};
