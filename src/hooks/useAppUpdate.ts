import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** arquivo principal do app que está rodando agora (muda a cada versão publicada). */
const ENTRY = /\/_expo\/static\/js\/web\/entry-[^"']+\.js/;
const EVERY = 30 * 60 * 1000;

function currentEntry(): string | null {
  const doc = (globalThis as { document?: Document }).document;
  const script = doc ? [...doc.querySelectorAll('script[src]')].find((s) => ENTRY.test(s.getAttribute('src') ?? '')) : null;
  return script?.getAttribute('src')?.match(ENTRY)?.[0] ?? null;
}

/**
 * no navegador: avisa quando há uma versão nova do teo publicada. confere ao abrir,
 * quando a pessoa volta para o app e a cada 30 minutos.
 */
export function useAppUpdate(): { available: boolean; reload: () => void } {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const running = currentEntry();
    if (!running) return; // modo de desenvolvimento
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        const latest = (await res.text()).match(ENTRY)?.[0];
        if (!stopped && latest && latest !== running) setAvailable(true);
      } catch {
        // sem internet: tenta de novo depois
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, EVERY);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);

  return { available, reload: () => globalThis.location?.reload() };
}
