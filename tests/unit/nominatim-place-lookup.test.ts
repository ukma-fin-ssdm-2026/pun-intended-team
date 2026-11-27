// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { describePlace, NominatimPlaceLookup } from '../../dist/infra/geocoding/nominatim-place-lookup.js';
import { savedPagesClient } from './fixtures/provider-pages.ts';

const ARSENAL_RESPONSE = JSON.stringify({
  name: 'Мистецький Арсенал',
  address: {
    road: 'вулиця Лаврська',
    house_number: '10-12',
    city_district: 'Печерський район',
    city: 'Київ',
  },
});

describe('NominatimPlaceLookup', () => {
  test('names the place and its address in Ukrainian, at building zoom', async () => {
    const http = savedPagesClient({ '/reverse': { status: 200, text: ARSENAL_RESPONSE } });

    const place = await new NominatimPlaceLookup(http).describe({ lat: 50.4357, lng: 30.5555 });

    assert.deepEqual(place, { name: 'Мистецький Арсенал', address: 'вулиця Лаврська, 10-12, Печерський район' });
    const query = new URL(http.requested[0] ?? '').searchParams;
    assert.deepEqual([query.get('lat'), query.get('lon'), query.get('zoom')], ['50.4357', '30.5555', '18']);
  });

  test('gives nothing when Nominatim finds nothing', async () => {
    const http = savedPagesClient({ '/reverse': { status: 200, text: '{"error":"Unable to geocode"}' } });

    assert.equal(await new NominatimPlaceLookup(http).describe({ lat: 50.4, lng: 30.5 }), undefined);
  });

  test('throws when Nominatim answers with an error status', async () => {
    const http = savedPagesClient({ '/reverse': { status: 503, text: '' } });

    await assert.rejects(new NominatimPlaceLookup(http).describe({ lat: 50.4, lng: 30.5 }));
  });
});

describe('describePlace', () => {
  test('names a building without a name by its street and house', () => {
    assert.deepEqual(
      describePlace('', { road: 'вулиця Хрещатик', house_number: '22', borough: 'Шевченківський район' }),
      {
        name: 'вулиця Хрещатик, 22',
        address: 'вулиця Хрещатик, 22, Шевченківський район',
      },
    );
  });

  test('gives nothing for a point with neither a name nor a street', () => {
    assert.equal(describePlace('', { city: 'Київ' }), undefined);
  });
});
