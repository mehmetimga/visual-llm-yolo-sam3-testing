/**
 * Report Writer
 * Generates HTML, JSON, and JUnit reports from test results
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import type { RunResult } from '@ai-ui/core';

export async function writeReport(results: RunResult[], outDir: string): Promise<void> {
  // Ensure output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Write JSON report
  writeJsonReport(results, outDir);

  // Write HTML report
  writeHtmlReport(results, outDir);

  // Write JUnit XML report
  writeJUnitReport(results, outDir);
}

function writeJsonReport(results: RunResult[], outDir: string): void {
  const reportPath = `${outDir}/run.json`;
  writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
}

function writeHtmlReport(results: RunResult[], outDir: string): void {
  const reportPath = `${outDir}/report.html`;
  
  const totalSteps = results.reduce((sum, r) => sum + r.summary.total, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.summary.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.summary.failed, 0);
  const totalHealed = results.reduce((sum, r) => sum + r.summary.healed, 0);
  const allPassed = results.every(r => r.ok);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI UI Test Report</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --success: #3fb950;
      --error: #f85149;
      --warning: #d29922;
      --accent: #58a6ff;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'SF Mono', 'Fira Code', monospace;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    
    .container { max-width: 1200px; margin: 0 auto; }
    
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    
    .status-badge.passed { background: var(--success); color: #000; }
    .status-badge.failed { background: var(--error); color: #fff; }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin: 2rem 0;
    }
    
    .summary-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }
    
    .summary-card .number {
      font-size: 2.5rem;
      font-weight: 700;
    }
    
    .summary-card .label { color: var(--text-muted); }
    .summary-card.passed .number { color: var(--success); }
    .summary-card.failed .number { color: var(--error); }
    .summary-card.healed .number { color: var(--warning); }
    
    .scenario {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    
    .scenario-header {
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    
    .scenario-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .platform-badge {
      background: var(--accent);
      color: #000;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .steps { padding: 1rem 1.5rem; }
    
    .step {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
    }
    
    .step:last-child { border-bottom: none; }
    
    .step-icon { font-size: 1.25rem; }
    .step-icon.passed { color: var(--success); }
    .step-icon.failed { color: var(--error); }
    
    .step-details { flex: 1; }
    .step-action { color: var(--accent); }
    .step-target { color: var(--text-muted); }
    
    .healing-badge {
      background: var(--warning);
      color: #000;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    
    .timestamp {
      color: var(--text-muted);
      font-size: 0.75rem;
    }
    
    footer {
      margin-top: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      🤖 AI UI Test Report
      <span class="status-badge ${allPassed ? 'passed' : 'failed'}">
        ${allPassed ? 'PASSED' : 'FAILED'}
      </span>
    </h1>
    
    <div class="summary">
      <div class="summary-card">
        <div class="number">${totalSteps}</div>
        <div class="label">Total Steps</div>
      </div>
      <div class="summary-card passed">
        <div class="number">${totalPassed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card failed">
        <div class="number">${totalFailed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card healed">
        <div class="number">${totalHealed}</div>
        <div class="label">Healed</div>
      </div>
    </div>
    
    ${results.map(result => `
    <div class="scenario">
      <div class="scenario-header">
        <div class="scenario-title">
          <span>${result.ok ? '✅' : '❌'}</span>
          <strong>${escapeHtml(result.scenario)}</strong>
          <span class="platform-badge">${result.platform.toUpperCase()}</span>
        </div>
        <div class="timestamp">${result.startedAt}</div>
      </div>
      <div class="steps">
        ${result.steps.map(step => `
        <div class="step">
          <span class="step-icon ${step.ok ? 'passed' : 'failed'}">${step.ok ? '✓' : '✗'}</span>
          <div class="step-details">
            <span class="step-action">${step.stepId}</span>
            ${step.healingAttempts?.length ? '<span class="healing-badge">HEALED</span>' : ''}
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    `).join('')}
    
    <footer>
      Generated by AI UI Automation • ${new Date().toISOString()}
    </footer>
  </div>
</body>
</html>`;

  writeFileSync(reportPath, html, 'utf-8');
}

function writeJUnitReport(results: RunResult[], outDir: string): void {
  const reportPath = `${outDir}/junit.xml`;
  
  const totalTests = results.reduce((sum, r) => sum + r.summary.total, 0);
  const totalFailures = results.reduce((sum, r) => sum + r.summary.failed, 0);
  const totalTime = results.reduce((sum, r) => {
    const start = new Date(r.startedAt).getTime();
    const end = new Date(r.finishedAt).getTime();
    return sum + (end - start) / 1000;
  }, 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="AI UI Tests" tests="${totalTests}" failures="${totalFailures}" time="${totalTime.toFixed(3)}">
${results.map(result => {
  const suiteTime = (new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime()) / 1000;
  return `  <testsuite name="${escapeXml(result.scenario)}" tests="${result.summary.total}" failures="${result.summary.failed}" time="${suiteTime.toFixed(3)}">
${result.steps.map(step => {
  const stepTime = (new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime()) / 1000;
  return `    <testcase name="${escapeXml(step.stepId)}" time="${stepTime.toFixed(3)}"${step.ok ? ' />' : `>
      <failure message="${escapeXml(step.error?.message || 'Step failed')}">${escapeXml(step.error?.stack || '')}</failure>
    </testcase>`}`;
}).join('\n')}
  </testsuite>`;
}).join('\n')}
</testsuites>`;

  writeFileSync(reportPath, xml, 'utf-8');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

