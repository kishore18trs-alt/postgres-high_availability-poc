import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 100 },    // warm up
    { duration: '30s', target: 500 },    // medium load
    { duration: '60s', target: 1500 },   // OVERLOAD — exceeds PG max_connections
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.50'],   // allow up to 50% failure to keep test running
  },
};

export default function () {
  const id = Math.floor(Math.random() * 10000) + 1;
  const res = http.get(`http://localhost:3000/users/${id}`, {
    timeout: '30s',
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.02);
}



// import http from 'k6/http';
// import { check, sleep } from 'k6';

// export const options = {
//   stages: [
//     { duration: '20s', target: 500 },
//     { duration: '40s', target: 1500 },
//     { duration: '40s', target: 3000 },
//     { duration: '60s', target: 5000 },
//     { duration: '20s', target: 0 },
//   ],
//   thresholds: {
//     http_req_failed: ['rate<0.50'],
//   },
// };

// export default function () {
//   const id = Math.floor(Math.random() * 10000) + 1;
//   const res = http.get(`http://localhost:3000/users/${id}`, {
//     timeout: '30s',
//   });
//   check(res, {
//     'status is 200': (r) => r.status === 200,
//   });
//   sleep(0.02);
// }