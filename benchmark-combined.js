import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics to track reads vs writes separately
const writeErrors  = new Counter('write_errors');
const readErrors   = new Counter('read_errors');
const writeTrend   = new Trend('write_duration');
const readTrend    = new Trend('read_duration');

export const options = {
  stages: [
    { duration: '30s', target: 50  },   // warm up
    { duration: '60s', target: 200 },   // normal load
    { duration: '60s', target: 500 },   // peak load
    { duration: '30s', target: 200 },   // step down
    { duration: '30s', target: 0   },   // cool down
  ],
  thresholds: {
    http_req_duration:        ['p(95)<1000', 'p(99)<2000'],
    http_req_failed:          ['rate<0.05'],   // less than 5% errors
    write_duration:           ['p(95)<1500'],
    read_duration:            ['p(95)<800'],
  },
};

const BASE_URL = 'http://localhost:3000';
let userCounter = 100000; // start writes at high ID to avoid conflicts

export default function () {
  const rand = Math.random();

  if (rand < 0.70) {
    // 70% reads — simulate real-world read-heavy traffic
    const id = Math.floor(Math.random() * 10000) + 1;
    const start = Date.now();

    const res = http.get(`${BASE_URL}/users/${id}`, {
      timeout: '15s',
      tags: { type: 'read' },
    });

    readTrend.add(Date.now() - start);

    const ok = check(res, {
      'read status 200': (r) => r.status === 200,
      'read has id':     (r) => r.json('id') !== undefined,
    });

    if (!ok) readErrors.add(1);

  } else if (rand < 0.90) {
    // 20% writes — concurrent inserts
    const uid = ++userCounter;
    const start = Date.now();

    const res = http.post(
      `${BASE_URL}/users`,
      JSON.stringify({
        email: `loadtest_${uid}_${Date.now()}@test.com`,
        name:  `Load User ${uid}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: '15s',
        tags: { type: 'write' },
      }
    );

    writeTrend.add(Date.now() - start);

    const ok = check(res, {
      'write status 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    if (!ok) writeErrors.add(1);

  } else {
    // 10% list queries — heavier reads
    const res = http.get(`${BASE_URL}/users`, {
      timeout: '15s',
      tags: { type: 'list' },
    });

    check(res, {
      'list status 200':    (r) => r.status === 200,
      'list has results':   (r) => Array.isArray(r.json()),
    });
  }

  sleep(0.1);
}