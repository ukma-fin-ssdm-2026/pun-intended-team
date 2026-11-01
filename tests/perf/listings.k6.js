// Written with the help of Claude
// TC-10 / PERF-001: GET /api/v1/listings at 500 concurrent sessions for 10 minutes (npm run test:perf).
/* global __ENV */
import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4100';
// An access token from a Google sign-in; it is valid for 60 minutes, longer than the run.
const TOKEN = __ENV.PERF_TOKEN;
// Lowered for a smoke run; PERF-001 is checked only at the defaults.
const VUS = Number(__ENV.PERF_VUS || 500);
const DURATION = __ENV.PERF_DURATION || '10m';

export const options = {
  discardResponseBodies: true,
  scenarios: {
    listings: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  // PERF-001 fit criterion, on the listings requests only.
  // k6 exits with a non-zero code when one fails.
  thresholds: {
    'http_req_duration{scenario:listings}': ['p(95)<=1000', 'p(99)<=2000', 'max<=5000'],
    'http_req_failed{scenario:listings}': ['rate==0'],
  },
};

// One token for all VUs. k6 cannot sign in with Google itself.
export function setup() {
  if (!TOKEN) {
    fail('PERF_TOKEN is not set: sign in with Google and pass the access token');
  }
  const res = http.get(`${BASE_URL}/api/v1/listings`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (res.status !== 200) {
    fail(`GET /api/v1/listings at ${BASE_URL} answered ${res.status}; is the API running and the token valid?`);
  }
  return { token: TOKEN };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api/v1/listings`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
