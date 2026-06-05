import { createServer } from "node:http";
import { loadHistory, calculateUptime } from "./monitor.js";
import type { MonitorRun, DashboardOptions } from "../types.js";
import { exec } from "node:child_process";

export function buildDashboardHtml(_history?: MonitorRun[], _suiteFile?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>mcpunit Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #ffffff;
    --surface: #ffffff;
    --hover: #f5f5f7;
    --text: #111111;
    --secondary: #6e6e73;
    --green: #34c759;
    --red: #ff3b30;
    --border: #e5e5e7;
  }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 80px 20px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  #app {
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    font-size: 40px;
    font-weight: 600;
    letter-spacing: -0.03em;
    margin: 0 0 16px 0;
  }
  p.hero-sub {
    font-size: 16px;
    color: var(--secondary);
    margin: 0 0 48px 0;
  }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: var(--secondary);
    margin: 0 0 24px 0;
  }
  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 48px 0;
  }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 12px;
  }
  .dot.green { background: var(--green); }
  .dot.red { background: var(--red); }

  .tool-row {
    display: flex;
    justify-content: space-between;
    padding: 14px 16px;
    border-radius: 12px;
    font-size: 15px;
    transition: background 0.2s ease;
    margin: 0 -16px;
  }
  .tool-row:hover {
    background: var(--hover);
  }
  .tool-name {
    display: flex;
    align-items: center;
    font-weight: 500;
  }
  .tool-metric {
    color: var(--secondary);
    font-variant-numeric: tabular-nums;
  }

  .activity-grid {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .activity-block {
    width: 14px;
    height: 14px;
    border-radius: 2px;
  }
  .activity-block.passed { background: #e5e5e7; }
  .activity-block.passed:hover { background: #d1d1d6; }
  .activity-block.failed { background: var(--red); opacity: 0.8; }
  .activity-block.failed:hover { opacity: 1; }

  .event-day {
    margin-bottom: 32px;
  }
  .event-day h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
  .event {
    display: flex;
    gap: 24px;
    padding: 8px 0;
    font-size: 15px;
  }
  .event-time {
    color: var(--secondary);
    min-width: 80px;
    font-variant-numeric: tabular-nums;
  }
</style>
</head>
<body>
<div id="app">Loading...</div>

<script>
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  
  function getStatus(runs) {
    if (runs.length === 0) return { status: 'unknown' };
    const last = runs[runs.length - 1];
    return {
      up: last.failed === 0 && last.errored === 0,
      failing: last.failed + last.errored,
      lastRun: last.timestamp,
      run: last
    };
  }
  
  function render(runs) {
    if (runs.length === 0) {
      document.getElementById('app').innerHTML = '<p style="color: var(--secondary)">Waiting for first run...</p>';
      return;
    }
    
    const current = getStatus(runs);
    const last24h = runs.filter(r => (Date.now() - new Date(r.timestamp).getTime()) < 24*60*60*1000);
    const uptime24h = last24h.length ? (last24h.filter(r => r.failed === 0 && r.errored === 0).length / last24h.length * 100).toFixed(2) : 100;
    
    // Hero
    let html = '';
    if (current.up) {
      html += \`<h1>All systems operational</h1><p class="hero-sub">\${uptime24h}% uptime over the last 24 hours</p>\`;
    } else {
      const failingNames = current.run.results.filter(r => r.status !== 'passed').map(r => r.name);
      const namesText = failingNames.length <= 2 ? failingNames.join(' and ') : \`\${failingNames.slice(0, 2).join(', ')} and \${failingNames.length - 2} more\`;
      html += \`<h1>\${current.failing} service\${current.failing > 1 ? 's' : ''} degraded</h1><p class="hero-sub">\${namesText} experiencing failures</p>\`;
    }
    
    html += \`<hr><h2>Tools</h2><div>\`;
    
    // Tools breakdown
    const tools = {};
    if (current.run) {
      current.run.results.forEach(r => {
        tools[r.name] = { name: r.name, lastStatus: r.status, lastDuration: r.durationMs };
      });
    }
    
    Object.values(tools).forEach(t => {
      const up = t.lastStatus === "passed";
      html += \`
        <div class="tool-row">
          <div class="tool-name">
            <span class="dot \${up ? 'green' : 'red'}"></span>
            \${t.name}
          </div>
          <div class="tool-metric">\${t.lastDuration}ms</div>
        </div>
      \`;
    });
    html += \`</div><hr><h2>Activity</h2><div class="activity-grid">\`;
    
    // Activity Grid
    const recent = runs.slice(-200);
    recent.forEach(r => {
      const isFail = r.failed > 0 || r.errored > 0;
      html += \`<div class="activity-block \${isFail ? 'failed' : 'passed'}" title="\${formatTime(r.timestamp)} - \${isFail ? 'Failed' : 'Passed'}"></div>\`;
    });
    html += \`</div><hr><h2>Recent Events</h2>\`;
    
    // Events
    const alerts = [];
    let lastFailed = false;
    let failedSince = null;
    let failedNames = [];
    
    runs.forEach(r => {
      const currentFailing = r.results.filter(x => x.status !== 'passed').map(x => x.name);
      const hasFailed = currentFailing.length > 0;
      
      if (hasFailed && !lastFailed) {
        failedSince = new Date(r.timestamp);
        failedNames = currentFailing;
        const names = failedNames.length <= 2 ? failedNames.join(' and ') : \`\${failedNames[0]} and \${failedNames.length - 1} more\`;
        alerts.push({ time: new Date(r.timestamp), type: 'error', msg: \`\${names} failure\` });
      } else if (!hasFailed && lastFailed && failedSince) {
        const names = failedNames.length <= 2 ? failedNames.join(' and ') : \`\${failedNames[0]} and \${failedNames.length - 1} more\`;
        alerts.push({ time: new Date(r.timestamp), type: 'recovery', msg: \`\${names} recovered\` });
        failedSince = null;
        failedNames = [];
      }
      lastFailed = hasFailed;
    });
    
    alerts.reverse();
    
    if (alerts.length === 0) {
      html += \`<div class="event"><div class="event-time">--</div><div style="color: var(--secondary)">No recent incidents.</div></div>\`;
    } else {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      const groups = {};
      alerts.slice(0, 20).forEach(a => {
        let dayStr = a.time.toDateString();
        let groupName = dayStr;
        if (dayStr === today) groupName = 'Today';
        else if (dayStr === yesterday) groupName = 'Yesterday';
        else groupName = a.time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(a);
      });
      
      Object.entries(groups).forEach(([day, dayAlerts]) => {
        html += \`<div class="event-day"><h3>\${day}</h3>\`;
        dayAlerts.forEach(a => {
          const timeStr = a.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          html += \`
            <div class="event">
              <div class="event-time">\${timeStr}</div>
              <div class="message" style="color: \${a.type === 'error' ? 'var(--text)' : 'var(--secondary)'}">\${a.msg}</div>
            </div>
          \`;
        });
        html += \`</div>\`;
      });
    }
    
    document.getElementById('app').innerHTML = html;
  }
  
  async function fetchRuns() {
    try {
      const res = await fetch('/api/runs');
      const runs = await res.json();
      render(runs);
    } catch(e) {
      console.error("Failed to fetch runs", e);
    }
  }
  
  fetchRuns();
  setInterval(fetchRuns, 10000);
</script>
</body>
</html>`;
}

export async function startDashboard(options: DashboardOptions): Promise<void> {
  const server = createServer((req, res) => {
    // Enable CORS just in case
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(buildDashboardHtml([], options.suiteFile));
    } else if (req.url === "/api/runs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const history = loadHistory(options.suiteFile);
      res.end(JSON.stringify(history));
    } else if (req.url === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const history = loadHistory(options.suiteFile);
      res.end(JSON.stringify({
        uptime24h: calculateUptime(history, 24*60*60*1000)
      }));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(options.port, () => {
      if (options.open) {
        exec(`open http://localhost:${options.port}`, () => {});
      }
      resolve();
    });
  });
}
