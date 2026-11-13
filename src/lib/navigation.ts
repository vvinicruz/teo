import { router } from 'expo-router';
import type { Entry } from '../domain/finance';

/** abre o item certo: um lançamento existente ou uma previsão para confirmar/ajustar. */
export function openEntry(e: Entry) {
  if (e.transactionId) {
    router.push({ pathname: '/movimentacao', params: { id: e.transactionId } });
  } else if (e.recurrenceId) {
    router.push({
      pathname: '/movimentacao',
      params: { recurrenceId: e.recurrenceId, occurrenceDate: e.originalDate },
    });
  }
}
