import { Platform } from 'react-native';

/** o driver nativo de animações não existe na web; lá usamos o de javascript. */
export const nativeDriver = Platform.OS !== 'web';
