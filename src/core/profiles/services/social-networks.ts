// Written with the help of Claude
import type { SocialNetwork } from '../types/profile.ts';

interface Rules {
  /** Hosts of a pasted profile link. */
  hosts: string[];
  /** Single path segments on those hosts that are pages of the site, not profiles. */
  reserved: string[];
  /** The stored handle, after cleaning. */
  handle: RegExp;
  /** What the user is told when the handle does not fit. */
  hint: string;
  url: (handle: string) => string;
}

const rules: Record<SocialNetwork, Rules> = {
  telegram: {
    hosts: ['t.me', 'telegram.me'],
    reserved: ['joinchat', 'share', 'addstickers', 'addemoji', 'proxy', 'socks', 'iv', 's', 'c'],
    // No "__", and no "_" at the end.
    handle: /^(?!.*__)[A-Za-z][A-Za-z0-9_]{3,30}[A-Za-z0-9]$/,
    hint: '5 to 32 letters, digits or single underscores, starting with a letter and not ending with an underscore',
    url: (handle) => `https://t.me/${handle}`,
  },
  instagram: {
    hosts: ['instagram.com'],
    reserved: ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'tv'],
    // No "..", and no "." at either end.
    handle: /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/,
    hint: 'up to 30 letters, digits, underscores or single dots, not starting or ending with a dot',
    url: (handle) => `https://instagram.com/${handle}`,
  },
  // A phone number with the country code; wa.me takes the digits only.
  whatsapp: {
    hosts: ['wa.me'],
    reserved: [],
    handle: /^[1-9]\d{9,14}$/,
    hint: 'a phone number with the country code, e.g. +380501234567',
    url: (handle) => `https://wa.me/${handle}`,
  },
  tiktok: {
    hosts: ['tiktok.com'],
    reserved: [],
    handle: /^(?!.*\.$)[A-Za-z0-9._]{2,24}$/,
    hint: '2 to 24 letters, digits, dots or underscores, not ending with a dot',
    url: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  // A username has a letter in it; an account without one is known by the numeric id of profile.php?id=….
  facebook: {
    hosts: ['facebook.com', 'fb.com'],
    reserved: ['people', 'groups', 'pages', 'events', 'watch', 'marketplace', 'photo', 'share'],
    handle: /^(?:\d{5,20}|(?=.*[A-Za-z])[A-Za-z0-9.]{5,50})$/,
    hint: 'a username of 5 to 50 letters, digits or dots, or a profile.php?id= link',
    url: (handle) =>
      /^\d+$/.test(handle) ? `https://facebook.com/profile.php?id=${handle}` : `https://facebook.com/${handle}`,
  },
};

const LINK = /^(?:https?:\/\/)?(?:www\.|m\.)?([^/\s?#]+)(\/[^?#]*)?(\?[^#]*)?/i;

/** The handle a profile link points at; null when it is a link to another site, undefined when it is no profile. */
function handleInLink(network: SocialNetwork, input: string): string | null | undefined {
  const [, host = '', path = '', query = ''] = LINK.exec(input) ?? [];
  const { hosts, reserved } = rules[network];
  if (!hosts.includes(host.toLowerCase())) {
    return null;
  }
  // The site itself, or a page deeper than a profile.
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 1) {
    return undefined;
  }
  const [segment = ''] = segments;
  if (network === 'facebook' && segment.toLowerCase().endsWith('.php')) {
    const id = segment.toLowerCase() === 'profile.php' ? new URLSearchParams(query).get('id') : null;
    return id && /^\d+$/.test(id) ? id : undefined;
  }
  if (network === 'tiktok') {
    return segment.startsWith('@') ? segment.slice(1) : undefined;
  }
  return reserved.includes(segment.toLowerCase()) ? undefined : segment;
}

/**
 * The handle in what the user typed: a nickname with or without "@", or a pasted profile link. Undefined when it does
 * not fit the social network.
 */
export function socialNetworkHandle(network: SocialNetwork, input: string): string | undefined {
  const trimmed = input.trim();
  const fromLink = handleInLink(network, trimmed);
  if (fromLink === undefined) {
    return undefined;
  }
  let value = (fromLink ?? trimmed).replace(/^@/, '');
  if (network === 'whatsapp') {
    value = value.replace(/[\s()+-]/g, '');
  }
  return rules[network].handle.test(value) ? value : undefined;
}

export function socialNetworkHint(network: SocialNetwork): string {
  return rules[network].hint;
}

/** The profile link a mutual match opens; the handle is one socialNetworkHandle returned. */
export function socialNetworkUrl(network: SocialNetwork, handle: string): string {
  return rules[network].url(handle);
}
