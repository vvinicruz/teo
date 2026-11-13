import { useData } from '../data/DataProvider';
import { formatMoney } from '../domain/money';
import { Text, type TextProps } from './Text';

interface Props extends Omit<TextProps, 'children'> {
  value: number;
  sign?: boolean;
  /** ignora o "esconder valores" (ex.: dentro de formulários). */
  alwaysShow?: boolean;
}

/** valor em reais, respeitando a preferência de esconder valores. */
export function Money({ value, sign, alwaysShow, ...rest }: Props) {
  const { data } = useData();
  const hidden = data.settings.hideValues && !alwaysShow;
  return (
    <Text {...rest} accessibilityLabel={hidden ? 'valor escondido' : formatMoney(value)}>
      {hidden ? 'R$ ••••' : formatMoney(value, { sign })}
    </Text>
  );
}
