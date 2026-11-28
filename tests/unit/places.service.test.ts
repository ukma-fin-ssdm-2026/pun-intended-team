// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { PlaceLookup } from '../../dist/core/listings/adapters/place-lookup.js';
import { PlacesService } from '../../dist/core/listings/services/places.service.js';
import type { PlaceDescription, Point } from '../../dist/core/listings/types/place.js';

const ARSENAL: PlaceDescription = { name: 'Мистецький Арсенал', address: 'вулиця Лаврська, 10-12, Печерський район' };
const POINT: Point = { lat: 50.4357123, lng: 30.5555456 };
const DAY_MS = 24 * 60 * 60 * 1000;

function makeService(
  describe: (point: Point) => Promise<PlaceDescription | undefined> = () => Promise.resolve(ARSENAL),
) {
  const placeLookup = { describe: mock.fn(describe) };
  return { service: new PlacesService(placeLookup as unknown as PlaceLookup), placeLookup };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('PlacesService.describe', () => {
  test('asks the lookup for the point rounded to 5 decimals', async () => {
    const { service, placeLookup } = makeService();

    assert.deepEqual(await service.describe(POINT), ARSENAL);
    assert.deepEqual(placeLookup.describe.mock.calls[0]?.arguments, [{ lat: 50.43571, lng: 30.55555 }]);
  });

  test('answers a point it was asked about lately from memory, the same rounded point too', async () => {
    const { service, placeLookup } = makeService();

    await service.describe(POINT, 0);
    await service.describe({ lat: 50.435714, lng: 30.555549 }, 1000);

    assert.equal(placeLookup.describe.mock.callCount(), 1);
  });

  test('asks again after a day', async () => {
    const { service, placeLookup } = makeService();

    await service.describe(POINT, 0);
    await service.describe(POINT, DAY_MS + 1);

    assert.equal(placeLookup.describe.mock.callCount(), 2);
  });

  test('answers NOT_FOUND when nothing is there, and remembers that too', async () => {
    const { service, placeLookup } = makeService(() => Promise.resolve(undefined));

    await assert.rejects(service.describe(POINT, 0), isDomainError('NOT_FOUND'));
    await assert.rejects(service.describe(POINT, 1), isDomainError('NOT_FOUND'));
    assert.equal(placeLookup.describe.mock.callCount(), 1);
  });

  test('answers PLACE_LOOKUP_UNAVAILABLE when the lookup cannot be reached, and asks again next time', async () => {
    const { service, placeLookup } = makeService(() => Promise.reject(new Error('timeout')));

    await assert.rejects(service.describe(POINT, 0), isDomainError('PLACE_LOOKUP_UNAVAILABLE'));
    await assert.rejects(service.describe(POINT, 1), isDomainError('PLACE_LOOKUP_UNAVAILABLE'));
    assert.equal(placeLookup.describe.mock.callCount(), 2);
  });

  test('refuses a point outside Kyiv without asking the lookup', async () => {
    const { service, placeLookup } = makeService();

    await assert.rejects(service.describe({ lat: 49.8441, lng: 24.0262 }), isDomainError('PLACE_OUTSIDE_CITY'));
    assert.equal(placeLookup.describe.mock.callCount(), 0);
  });
});
