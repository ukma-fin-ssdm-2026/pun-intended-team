// Written with the help of Claude
import type { SocialNetwork } from '../types/profile.ts';

interface Rules {
  /** Hosts of a pasted profile link; the handle is the first part of its path. */
  hosts: string[];
  /** The stored handle, after cleaning. */
  handle: RegExp;
  /** What the user is told when the handle does not fit. */
  hint: string;
  url: (handle: string) => string;
}

const rules: Record<SocialNetwork, Rules> = {
  telegram: {
    hosts: ['t.me', 'telegram.me'],
    handle: /^[A-Za-z][A-Za-z0-9_]{4,31}$/,
    hint: '5 to 32 letters, digits or underscores, starting with a letter',
    url: (handle) => `https://t.me/${handle}`,
  },
  instagram: {
    hosts: ['instagram.com'],
    handle: /^[A-Za-z0-9._]{1,30}$/,
    hint: 'up to 30 letters, digits, dots or underscores',
    url: (handle) => `https://instagram.com/${handle}`,
  },
  // A phone number with the country code; wa.me takes the digits only.
  whatsapp: {
    hosts: ['wa.me'],
    handle: /^[1-9]\d{9,14}$/,
    hint: 'a phone number with the country code, e.g. +380501234567',
    url: (handle) => `https://wa.me/${handle}`,
  },
  tiktok: {
    hosts: ['tiktok.com'],
    handle: /^[A-Za-z0-9._]{2,24}$/,
    hint: '2 to 24 letters, digits, dots or underscores',
    url: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  facebook: {
    hosts: ['facebook.com', 'fb.com'],
    handle: /^[A-Za-z0-9.]{5,50}$/,
    hint: '5 to 50 letters, digits or dots',
    url: (handle) => `https://facebook.com/${handle}`,
  },
};

/**
 * The handle in what the user typed: a nickname with or without "@", or a pasted profile link. Undefined when it does
 * not fit the network.
 */
export function socialNetworkHandle(network: SocialNetwork, input: string): string | undefined {
  const { hosts, handle } = rules[network];
  let value = input.trim();
  const [, host = '', path = ''] = /^(?:https?:\/\/)?(?:www\.|m\.)?([^/\s]+)\/([^?#]*)/i.exec(value) ?? [];
  if (hosts.includes(host.toLowerCase())) {
    value = path.replace(/\/.*$/, '');
  }
  value = value.replace(/^@/, '');
  if (network === 'whatsapp') {
    value = value.replace(/[\s()+-]/g, '');
  }
  return handle.test(value) ? value : undefined;
}

export function socialNetworkHint(network: SocialNetwork): string {
  return rules[network].hint;
}

/** The profile link a mutual match opens; the handle is one socialNetworkHandle returned. */
export function socialNetworkUrl(network: SocialNetwork, handle: string): string {
  return rules[network].url(handle);
}
