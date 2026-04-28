//it's a Node.js script that hammers the API continuously 
// and logs every success and failure with timestamps so we can measure exact recovery time:


const http = require('http');

const RESULTS = [];
let requestCount = 0;
let lastStatus = null;

async function makeRequest() {
  const id = Math.floor(Math.random() * 10000) + 1;
  const start = Date.now();
  const reqId = ++requestCount;
  
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000/users/${id}`, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        const success = res.statusCode === 200;
        const event = { reqId, time: new Date().toISOString(), status: res.statusCode, latency, success };
        RESULTS.push(event);
        if (success !== lastStatus) {
          console.log(`[${event.time}] ${success ? '✅ RECOVERED' : '❌ FAILING'} status=${res.statusCode} latency=${latency}ms`);
          lastStatus = success;
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      const event = { reqId, time: new Date().toISOString(), status: 'ERROR', error: err.code || err.message, success: false };
      RESULTS.push(event);
      if (lastStatus !== false) {
        console.log(`[${event.time}] ❌ FAILING — ${err.code || err.message}`);
        lastStatus = false;
      }
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
    });
  });
}

async function run() {
  console.log('🚀 Starting failover test — 30 concurrent workers, ~10 req/sec/worker');
  console.log('   Press Ctrl+C to stop and see summary\n');
  
  const workers = Array.from({ length: 30 }, async () => {
    while (true) {
      await makeRequest();
      await new Promise(r => setTimeout(r, 100));  // 10 req/sec per worker
    }
  });
  
  process.on('SIGINT', () => {
    console.log('\n\n📊 SUMMARY');
    const total = RESULTS.length;
    const successes = RESULTS.filter(r => r.success).length;
    const failures = total - successes;
    
    // Find the failure window
    const firstFailure = RESULTS.find(r => !r.success);
    const lastFailure = [...RESULTS].reverse().find(r => !r.success);
    
    console.log(`Total requests:    ${total}`);
    console.log(`Successful:        ${successes} (${((successes/total)*100).toFixed(2)}%)`);
    console.log(`Failed:            ${failures} (${((failures/total)*100).toFixed(2)}%)`);
    
    if (firstFailure && lastFailure && firstFailure !== lastFailure) {
      const outageMs = new Date(lastFailure.time) - new Date(firstFailure.time);
      console.log(`First failure:     ${firstFailure.time}`);
      console.log(`Last failure:      ${lastFailure.time}`);
      console.log(`Outage window:     ${(outageMs/1000).toFixed(1)} seconds`);
    }
    process.exit(0);
  });
  
  await Promise.all(workers);
}

run();