import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { addDays } from '../domain/dates';
import { goalToNudge } from '../domain/goals';
import { useToday } from './useToday';

const KEY = 'teo:lembretes-metas:v1';
/** depois de dispensar, o lembrete daquela meta some por uma semana. */
const SNOOZE_DAYS = 7;

/** lembrete gentil para a meta que está há mais tempo sem receber nada. */
export function useGoalNudge() {
  const { data } = useData();
  const todayDate = useToday();
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSnoozed(JSON.parse(raw) as Record<string, string>))
      .catch(() => {});
  }, []);

  const nudge = useMemo(() => {
    const dismissed = new Set(Object.entries(snoozed).filter(([, until]) => until > todayDate).map(([id]) => id));
    return goalToNudge(data, todayDate, dismissed);
  }, [data, todayDate, snoozed]);

  const dismiss = useCallback(
    (goalId: string) => {
      const next = { ...snoozed, [goalId]: addDays(todayDate, SNOOZE_DAYS) };
      setSnoozed(next);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    },
    [snoozed, todayDate],
  );

  return { nudge, dismiss };
}
