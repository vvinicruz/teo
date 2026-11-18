import { useWindowDimensions } from 'react-native';
import { DESKTOP_MIN } from '../theme';

/** tela de computador (ou tablet deitado): barra lateral e conteúdo mais largo. */
export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN;
}
