import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { today } from '../domain/dates';

/** data de hoje que se atualiza quando o app volta ao primeiro plano ou vira o dia. */
export function useToday(): string {
  const [value, setValue] = useState(today);
  useEffect(() => {
    const tick = () => setValue((prev) => (prev === today() ? prev : today()));
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return value;
}
