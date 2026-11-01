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
  // Other hosts of the same network, and a host in capitals.
  { network: 'telegram', input: 'https://telegram.me/olena_k', handle: 'olena_k' },
  { network: 'facebook', input: 'https://fb.com/olena.k', handle: 'olena.k' },
  { network: 'instagram', input: 'HTTPS://WWW.INSTAGRAM.COM/olena.k', handle: 'olena.k' },
  // Facebook accounts without a username are known by id.
  { network: 'facebook', input: 'https://www.facebook.com/profile.php?id=100012345678', handle: '100012345678' },
  { network: 'facebook', input: 'facebook.com/profile.php', handle: undefined },
  // Pages of the site that are not profiles.
  { network: 'facebook', input: 'facebook.com/people/Olena-K/100012345678', handle: undefined },
  { network: 'facebook', input: 'facebook.com/groups/kyivcinema', handle: undefined },
  { network: 'facebook', input: 'facebook.com/watch', handle: undefined },
  { network: 'instagram', input: 'instagram.com/p/C1a2b3', handle: undefined },
  { network: 'instagram', input: 'instagram.com/reel/C1a2b3', handle: undefined },
  { network: 'instagram', input: 'instagram.com/stories/olena.k/123', handle: undefined },
  { network: 'instagram', input: 'instagram.com/explore', handle: undefined },
  { network: 'telegram', input: 't.me/joinchat/AbCdEf', handle: undefined },
  { network: 'telegram', input: 't.me/share/url?url=x', handle: undefined },
  { network: 'telegram', input: 't.me/proxy', handle: undefined },
  { network: 'tiktok', input: 'tiktok.com/olena.k', handle: undefined },
  { network: 'tiktok', input: 'tiktok.com/@olena.k/video/123', handle: undefined },
  // Handles the networks themselves do not allow.
  { network: 'telegram', input: 'olena_k_', handle: undefined },
  { network: 'telegram', input: 'olena__k', handle: undefined },
  { network: 'instagram', input: 'olena..k', handle: undefined },
  { network: 'instagram', input: '.olena', handle: undefined },
  { network: 'tiktok', input: 'olena.', handle: undefined },
  { network: 'facebook', input: '1234', handle: undefined },
  // Length limits.
  { network: 'telegram', input: 'olena', handle: 'olena' },
  { network: 'telegram', input: `o${'a'.repeat(31)}`, handle: `o${'a'.repeat(31)}` },
  { network: 'telegram', input: `o${'a'.repeat(32)}`, handle: undefined },
  { network: 'instagram', input: 'a'.repeat(30), handle: 'a'.repeat(30) },
  { network: 'instagram', input: 'a'.repeat(31), handle: undefined },
  { network: 'tiktok', input: 'ol', handle: 'ol' },
  { network: 'tiktok', input: 'a'.repeat(25), handle: undefined },
  { network: 'whatsapp', input: '+1234567890', handle: '1234567890' },
  { network: 'whatsapp', input: '+1234567890123456', handle: undefined },
  { network: 'facebook', input: 'a'.repeat(51), handle: undefined },
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
  { network: 'facebook', handle: '100012345678', url: 'https://facebook.com/profile.php?id=100012345678' },
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
