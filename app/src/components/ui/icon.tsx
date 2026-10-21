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
import ChipCheck from '@/assets/icons/chip-check.svg';
import Check from '@/assets/icons/check.svg';
import CheckboxCheck from '@/assets/icons/checkbox-check.svg';
import Clock from '@/assets/icons/clock.svg';
import Close from '@/assets/icons/close.svg';
import ContactPhone from '@/assets/icons/contact-phone.svg';
import ContactSend from '@/assets/icons/contact-send.svg';
import Copy from '@/assets/icons/copy.svg';
import Cup from '@/assets/icons/cup.svg';
import Danger from '@/assets/icons/danger.svg';
import EmptyList from '@/assets/icons/empty-list.svg';
import EmptyMatches from '@/assets/icons/empty-matches.svg';
import EmptySearch from '@/assets/icons/empty-search.svg';
import DeclineClose from '@/assets/icons/decline-close.svg';
import FieldChevron from '@/assets/icons/field-chevron.svg';
import Filter from '@/assets/icons/filter.svg';
import GalleryEdit from '@/assets/icons/gallery-edit.svg';
import Heart from '@/assets/icons/heart.svg';
import Home from '@/assets/icons/home.svg';
import List from '@/assets/icons/list.svg';
import Matches from '@/assets/icons/matches.svg';
import MutualCheck from '@/assets/icons/mutual-check.svg';
import MenuDots from '@/assets/icons/menu-dots.svg';
import Phone from '@/assets/icons/phone.svg';
import Pin from '@/assets/icons/pin.svg';
import ReportBell from '@/assets/icons/report-bell.svg';
import ReportClose from '@/assets/icons/report-close.svg';
import ReportSentCheck from '@/assets/icons/report-sent-check.svg';
import ReportShield from '@/assets/icons/report-shield.svg';
import Search from '@/assets/icons/search.svg';
import Send from '@/assets/icons/send.svg';
import Share from '@/assets/icons/share.svg';
import Shield from '@/assets/icons/shield.svg';
import StateArrow from '@/assets/icons/state-arrow.svg';
import StateClock from '@/assets/icons/state-clock.svg';
import StateDanger from '@/assets/icons/state-danger.svg';
import StatusCheck from '@/assets/icons/status-check.svg';
import StatusClose from '@/assets/icons/status-close.svg';
import Ticket from '@/assets/icons/ticket.svg';
import ToastCheck from '@/assets/icons/toast-check.svg';
import User from '@/assets/icons/user.svg';
import WaitingClock from '@/assets/icons/waiting-clock.svg';
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
  // Exports drawn at their own size with a heavier stroke than the scaled Solar icons: the checkbox tick (16 px, 2.4)
  // and the Д3.1 "Скаргу надіслано" icons (26 px and 18 px, 1.5).
  'checkbox-check': CheckboxCheck,
  // The tick of selected chips (Д1, П1: 14 px, 2.4 px stroke) and the profile contact icons (18 px, 1.5 px stroke).
  'chip-check': ChipCheck,
  'contact-phone': ContactPhone,
  'contact-send': ContactSend,
  clock: Clock,
  close: Close,
  copy: Copy,
  cup: Cup,
  danger: Danger,
  // The 05 "Не цього разу" cross (24 px, 2 px stroke) and the 05.2 / 05.3 status icons (34 px, 1.5 px stroke).
  'decline-close': DeclineClose,
  // Т2.1 empty state (34 px), the snackbar and О2.1 list tick and the waiting badge clock (18 px), all with a 1.5 px stroke.
  'empty-matches': EmptyMatches,
  // Т3.1 empty state (34 px, 1.5 px stroke).
  'empty-list': EmptyList,
  // 01.3 empty state (34 px, 1.5 px stroke).
  'empty-search': EmptySearch,
  // The "Список" field chevron (18 px, 1.5 px stroke).
  'field-chevron': FieldChevron,
  filter: Filter,
  'gallery-edit': GalleryEdit,
  heart: Heart,
  home: Home,
  list: List,
  matches: Matches,
  // The 07 "Взаємно" badge tick (20 px, 2.2 px stroke).
  'mutual-check': MutualCheck,
  'menu-dots': MenuDots,
  phone: Phone,
  pin: Pin,
  'report-bell': ReportBell,
  'report-close': ReportClose,
  'report-sent-check': ReportSentCheck,
  'report-shield': ReportShield,
  search: Search,
  send: Send,
  share: Share,
  shield: Shield,
  // The С1–С3 system state icons (34 px, 1.5 px stroke); С2 turns the arrow up, as Figma does.
  'state-arrow': StateArrow,
  'state-clock': StateClock,
  'state-danger': StateDanger,
  'status-check': StatusCheck,
  'status-close': StatusClose,
  ticket: Ticket,
  'toast-check': ToastCheck,
  user: User,
  'waiting-clock': WaitingClock,
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

// The SVGs keep the exported stroke; .svgrrc turns it (#121212, white, or the field chevron's grey) into currentColor
// at build time, and `color` sets it.
export function Icon({ name, size = 24, color = colors.text.primary, filled = false }: Props) {
  const Svg = icons[name];
  return <Svg width={size} height={size} color={color} fill={filled ? color : 'none'} />;
}
