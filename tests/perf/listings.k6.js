// Written with the help of Claude
// TC-10 / PERF-001: GET /api/v1/listings at 500 concurrent sessions for 10 minutes (npm run test:perf).
/* global __ENV */
import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4100';
// A seeded development account (npm run db:seed); its password is the documented dev one.
const PHONE = __ENV.PERF_PHONE || '+380501110001';
const PASSWORD = __ENV.PERF_PASSWORD || 'nearby-dev-password';
// Lowered for a smoke run; PERF-001 is checked only at the defaults.
const VUS = Number(__ENV.PERF_VUS || 500);
const DURATION = __ENV.PERF_DURATION || '10m';

export const options = {
  discardResponseBodies: true,
  scenarios: {
    listings: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  // PERF-001 fit criterion, on the listings requests only, not the sign-in in setup().
  // k6 exits with a non-zero code when one fails.
  thresholds: {
    'http_req_duration{scenario:listings}': ['p(95)<=1000', 'p(99)<=2000', 'max<=5000'],
    'http_req_failed{scenario:listings}': ['rate==0'],
  },
};

// Signs in once for all VUs: sign-in is rate-limited per IP.
export function setup() {
  const res = http.post(`${BASE_URL}/api/v1/auth/sign-in`, JSON.stringify({ phone: PHONE, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
  });
  if (res.status !== 200) {
    fail(`sign-in at ${BASE_URL} answered ${res.status}; is the API running and the database seeded?`);
  }
  return { token: res.json('accessToken') };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api/v1/listings`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
