// Written with the help of Claude
// AI Usage: Icon component over the Solar Linear set exported from Figma; reviewed by Daryna Halytska.
import ArrowLeft from '@/assets/icons/arrow-left.svg';
import ArrowLong from '@/assets/icons/arrow-long.svg';
import ArrowRight from '@/assets/icons/arrow-right.svg';
import Bell from '@/assets/icons/bell.svg';
import Building from '@/assets/icons/building.svg';
import Calendar from '@/assets/icons/calendar.svg';
import Camera from '@/assets/icons/camera.svg';
import CategoryAll from '@/assets/icons/category-all.svg';
import CategoryArt from '@/assets/icons/category-art.svg';
import CategoryCinema from '@/assets/icons/category-cinema.svg';
import CategoryLecture from '@/assets/icons/category-lecture.svg';
import CategoryMusic from '@/assets/icons/category-music.svg';
import CheckBold from '@/assets/icons/check-bold.svg';
import Check from '@/assets/icons/check.svg';
import Clock from '@/assets/icons/clock.svg';
import Close from '@/assets/icons/close.svg';
import Copy from '@/assets/icons/copy.svg';
import Cup from '@/assets/icons/cup.svg';
import Danger from '@/assets/icons/danger.svg';
import Filter from '@/assets/icons/filter.svg';
import GalleryEdit from '@/assets/icons/gallery-edit.svg';
import Heart from '@/assets/icons/heart.svg';
import Home from '@/assets/icons/home.svg';
import List from '@/assets/icons/list.svg';
import Matches from '@/assets/icons/matches.svg';
import MenuDots from '@/assets/icons/menu-dots.svg';
import Phone from '@/assets/icons/phone.svg';
import Pin from '@/assets/icons/pin.svg';
import Search from '@/assets/icons/search.svg';
import Send from '@/assets/icons/send.svg';
import Share from '@/assets/icons/share.svg';
import Shield from '@/assets/icons/shield.svg';
import Ticket from '@/assets/icons/ticket.svg';
import User from '@/assets/icons/user.svg';
import { colors } from '@/styles/tokens';

const icons = {
  'arrow-left': ArrowLeft,
  'arrow-long': ArrowLong,
  'arrow-right': ArrowRight,
  bell: Bell,
  building: Building,
  calendar: Calendar,
  camera: Camera,
  'category-all': CategoryAll,
  'category-art': CategoryArt,
  'category-cinema': CategoryCinema,
  'category-lecture': CategoryLecture,
  'category-music': CategoryMusic,
  check: Check,
  // Figma's "Іконка / Обрано": the same check drawn at 16 px with a 2.2 px stroke.
  'check-bold': CheckBold,
  clock: Clock,
  close: Close,
  copy: Copy,
  cup: Cup,
  danger: Danger,
  filter: Filter,
  'gallery-edit': GalleryEdit,
  heart: Heart,
  home: Home,
  list: List,
  matches: Matches,
  'menu-dots': MenuDots,
  phone: Phone,
  pin: Pin,
  search: Search,
  send: Send,
  share: Share,
  shield: Shield,
  ticket: Ticket,
  user: User,
};

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  // Fills the outline with the same colour; meant for single closed shapes such as the heart.
  filled?: boolean;
};

// The SVGs keep the exported stroke; .svgrrc turns it (#121212 or white) into currentColor at build time, and `color`
// sets it.
export function Icon({ name, size = 24, color = colors.text.primary, filled = false }: Props) {
  const Svg = icons[name];
  return <Svg width={size} height={size} color={color} fill={filled ? color : 'none'} />;
}
