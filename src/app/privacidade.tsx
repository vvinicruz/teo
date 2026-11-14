import { LegalDocument } from '../components';
import { PRIVACY } from '../content/legal';

export default function Privacidade() {
  return (
    <LegalDocument
      title="política de privacidade"
      intro="como o teo cuida dos seus dados. resumindo: seus dados são seus, ficam protegidos e não são vendidos."
      sections={PRIVACY}
    />
  );
}
