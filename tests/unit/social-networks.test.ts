// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  socialNetworkHandle,
  socialNetworkHint,
  socialNetworkUrl,
} from '../../dist/core/profiles/services/social-networks.js';
import type { SocialNetwork } from '../../dist/core/profiles/types/profile.js';

const handles: { network: SocialNetwork; input: string; handle: string | undefined }[] = [
  { network: 'telegram', input: 'olena_k', handle: 'olena_k' },
  { network: 'telegram', input: ' @olena_k ', handle: 'olena_k' },
  { network: 'telegram', input: 'https://t.me/olena_k', handle: 'olena_k' },
  { network: 'telegram', input: 't.me/olena_k?start=1', handle: 'olena_k' },
  { network: 'telegram', input: 'olen', handle: undefined },
  { network: 'telegram', input: '1olena', handle: undefined },
  { network: 'instagram', input: '@olena.k', handle: 'olena.k' },
  { network: 'instagram', input: 'https://www.instagram.com/olena.k/', handle: 'olena.k' },
  { network: 'instagram', input: 'olena k', handle: undefined },
  { network: 'whatsapp', input: '+380 (50) 123-45-67', handle: '380501234567' },
  { network: 'whatsapp', input: 'https://wa.me/380501234567', handle: '380501234567' },
  { network: 'whatsapp', input: '050 123', handle: undefined },
  { network: 'tiktok', input: 'https://www.tiktok.com/@olena.k', handle: 'olena.k' },
  { network: 'tiktok', input: '@olena.k', handle: 'olena.k' },
  { network: 'facebook', input: 'https://m.facebook.com/olena.k', handle: 'olena.k' },
  { network: 'facebook', input: 'olena_k', handle: undefined },
  // A link to another site is not taken apart; its text does not fit any handle.
  { network: 'telegram', input: 'https://instagram.com/olena_k', handle: undefined },
];

describe('socialNetworkHandle', () => {
  for (const { network, input, handle } of handles) {
    test(`${network}: ${JSON.stringify(input)} → ${handle ?? 'rejected'}`, () => {
      assert.equal(socialNetworkHandle(network, input), handle);
    });
  }
});

const urls: { network: SocialNetwork; handle: string; url: string }[] = [
  { network: 'telegram', handle: 'olena_k', url: 'https://t.me/olena_k' },
  { network: 'instagram', handle: 'olena.k', url: 'https://instagram.com/olena.k' },
  { network: 'whatsapp', handle: '380501234567', url: 'https://wa.me/380501234567' },
  { network: 'tiktok', handle: 'olena.k', url: 'https://www.tiktok.com/@olena.k' },
  { network: 'facebook', handle: 'olena.k', url: 'https://facebook.com/olena.k' },
];

describe('socialNetworkUrl', () => {
  for (const { network, handle, url } of urls) {
    test(`${network}: ${handle} → ${url}`, () => {
      assert.equal(socialNetworkUrl(network, handle), url);
    });
  }
});

describe('socialNetworkHint', () => {
  test('describes what a WhatsApp handle looks like', () => {
    assert.match(socialNetworkHint('whatsapp'), /phone number/);
  });
});
