import { LegalDocument } from '../components';
import { TERMS } from '../content/legal';

export default function Termos() {
  return (
    <LegalDocument
      title="termos de uso"
      intro="as regras de uso do teo, sem juridiquês desnecessário."
      sections={TERMS}
    />
  );
}
