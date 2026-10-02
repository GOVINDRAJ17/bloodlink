/**
 * Performance Budget Verification Script
 * =====================================
 * Enforces SLA budgets for BloodLink emergency application:
 * - Static / Cached / Fast Routes: < 500 ms
 * - Frontend Page Shells: < 1,000 ms
 * - Live / Resilient Fallback Routes: < 3,000 ms worst-case
 *
 * Exit code 0 if all routes comply, 1 if any route breaches budget.
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

const BUDGET_CONFIG = [
  {
    name: "Chronic Care API",
    path: "/api/chronic-care?condition=ALL",
    budgetMs: 500,
    category: "Static/Cached API"
  },
  {
    name: "Analytics Predict API",
    path: "/api/analytics/predict",
    budgetMs: 500,
    category: "Static/Cached API"
  },
  {
    name: "Map Layers API",
    path: "/api/map/layers",
    budgetMs: 500,
    category: "Static/Cached API"
  },
  {
    name: "Notification Logs API",
    path: "/api/notifications/logs",
    budgetMs: 500,
    category: "Static/Cached API"
  },
  {
    name: "Nearby Facilities Live Route",
    path: "/api/hospitals/nearby?lat=19.85109775&lng=75.3021&radiusKm=20",
    budgetMs: 3000,
    category: "Live Emergency Route"
  },
  {
    name: "Search Page Shell",
    path: "/search",
    budgetMs: 1000,
    category: "Frontend Shell"
  },
  {
    name: "Chronic Care Page Shell",
    path: "/chronic-care",
    budgetMs: 1000,
    category: "Frontend Shell"
  }
];

async function measureRoute(url, iterations = 3) {
  const times = [];
  let lastStatus = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      lastStatus = res.status;
      await res.text();
      const elapsed = Math.round(performance.now() - start);
      times.push(elapsed);
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      times.push(elapsed);
      lastStatus = 500;
    }
  }

  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { times, avg, min, max, status: lastStatus };
}

async function runBudgetChecks() {
  console.log(`\n======================================================`);
  console.log(`⏱️  BloodLink SLA Performance Budget Verification`);
  console.log(`Target Host: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // Warmup run
  try {
    await fetch(`${BASE_URL}/api/chronic-care?condition=ALL`);
  } catch {}

  let allPassed = true;
  const results = [];

  for (const item of BUDGET_CONFIG) {
    const fullUrl = `${BASE_URL}${item.path}`;
    process.stdout.write(`Testing ${item.name} (${item.path})... `);
    const measurement = await measureRoute(fullUrl, 3);
    const passed = measurement.max <= item.budgetMs && measurement.status < 500;

    if (!passed) {
      allPassed = false;
    }

    results.push({
      ...item,
      ...measurement,
      passed
    });

    console.log(passed ? `✅ PASS (${measurement.avg}ms avg, max ${measurement.max}ms)` : `❌ FAIL (${measurement.max}ms > ${item.budgetMs}ms budget)`);
  }

  console.log(`\n-----------------------------------------------------------------------------------------------------`);
  console.log(`| Route / Endpoint                        | Budget    | Min       | Avg       | Max       | Status | Result |`);
  console.log(`-----------------------------------------------------------------------------------------------------`);

  for (const r of results) {
    const namePadded = r.name.padEnd(40, " ");
    const budgetPadded = `${r.budgetMs}ms`.padEnd(9, " ");
    const minPadded = `${r.min}ms`.padEnd(9, " ");
    const avgPadded = `${r.avg}ms`.padEnd(9, " ");
    const maxPadded = `${r.max}ms`.padEnd(9, " ");
    const statusPadded = `${r.status}`.padEnd(6, " ");
    const resultPadded = r.passed ? "✅ PASS" : "❌ FAIL";

    console.log(`| ${namePadded} | ${budgetPadded} | ${minPadded} | ${avgPadded} | ${maxPadded} | ${statusPadded} | ${resultPadded} |`);
  }
  console.log(`-----------------------------------------------------------------------------------------------------\n`);

  if (!allPassed) {
    console.error(`❌ Performance budget breached! One or more routes exceeded their SLA threshold.`);
    process.exit(1);
  } else {
    console.log(`🎉 All routes strictly adhere to BloodLink performance budgets!`);
    process.exit(0);
  }
}

runBudgetChecks();
