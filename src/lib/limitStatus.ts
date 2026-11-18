import type { BudgetStatus } from '../domain/finance';
import { colors } from '../theme';

/** como mostramos a situação de uma categoria em relação ao limite do mês. */
export const STATUS_LABEL: Record<BudgetStatus, string> = {
  tranquilo: 'dentro do limite',
  atencao: 'perto do limite',
  passou: 'passou do limite',
};

export const STATUS_COLOR: Record<BudgetStatus, string> = {
  tranquilo: colors.income,
  atencao: colors.attention,
  passou: colors.danger,
};
