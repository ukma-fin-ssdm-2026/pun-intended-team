// Written with the help of Claude
// Logos from Simple Icons 16.35.0 (CC0), drawn in one colour like the Solar icons around them.
import Facebook from '@/assets/icons/social/facebook.svg';
import Instagram from '@/assets/icons/social/instagram.svg';
import Telegram from '@/assets/icons/social/telegram.svg';
import TikTok from '@/assets/icons/social/tiktok.svg';
import WhatsApp from '@/assets/icons/social/whatsapp.svg';
import type { components } from '@/api/schema';
import { colors } from '@/styles/tokens';

type SocialNetwork = components['schemas']['SocialNetwork'];

const logos = {
  telegram: Telegram,
  instagram: Instagram,
  whatsapp: WhatsApp,
  tiktok: TikTok,
  facebook: Facebook,
} satisfies Record<SocialNetwork, unknown>;

type Props = {
  network: SocialNetwork;
  size?: number;
  color?: string;
};

export function SocialNetworkIcon({ network, size = 24, color = colors.text.primary }: Readonly<Props>) {
  const Svg = logos[network];
  return <Svg width={size} height={size} fill={color} />;
}
