#!/usr/bin/env node
/**
 * AI UI Automation - Orchestrator CLI
 * Main entry point for running cross-platform UI tests
 */

import { Command } from 'commander';
import { config as dotenvConfig } from 'dotenv';
import { loadConfig } from './config.js';
import { runTests } from './runManager.js';
import { writeReport } from './reportWriter.js';
import type { Platform } from '@ai-ui/core';

// Load environment variables
dotenvConfig();

const program = new Command();

program
  .name('ai-ui-test')
  .description('AI-powered cross-platform UI testing')
  .version('0.1.0');

program
  .option('-s, --spec <path>', 'Path to .feature spec file')
  .option('-e, --english <text>', 'English test description')
  .option('-p, --platform <platforms>', 'Target platforms: web, mobile, or web,mobile', 'web')
  .option('-b, --baseUrl <url>', 'Base URL for web tests', 'http://localhost:3000')
  .option('-a, --appPath <path>', 'Path to Flutter app (APK/IPA)')
  .option('-o, --outDir <path>', 'Output directory for artifacts', './out')
  .option('--headed', 'Run in headed mode (visible browser)', false)
  .option('--real', 'Enable real browser execution (vs mock mode)', false)
  .option('--timeout <ms>', 'Step timeout in milliseconds', '30000')
  .option('--vgs', 'Enable Vision Grounding Service', false)
  .option('--vms', 'Enable Visual Memory Service', false)
  .option('--sam3', 'Enable SAM-3 Segmentation', false)
  .action(async (options) => {
    console.log('\n🤖 AI UI Automation - Starting test run...\n');

    try {
      // Parse platforms
      const platforms = options.platform.split(',').map((p: string) => p.trim()) as Platform[];
      
      // Validate input
      if (!options.spec && !options.english) {
        console.error('❌ Error: Either --spec or --english must be provided');
        process.exit(1);
      }

      // Load configuration
      const config = loadConfig({
        specPath: options.spec,
        englishInput: options.english,
        platforms,
        baseUrl: options.baseUrl,
        appPath: options.appPath,
        outDir: options.outDir,
        headed: options.headed,
        timeout: parseInt(options.timeout, 10),
        realExecution: options.real,
        vgsEnabled: options.vgs,
        vmsEnabled: options.vms,
        sam3Enabled: options.sam3,
      });

      console.log('📋 Configuration:');
      console.log(`   Platforms: ${platforms.join(', ')}`);
      console.log(`   Mode: ${config.realExecution ? '🌐 Real Browser' : '🔷 Mock'}`);
      console.log(`   Output: ${config.outDir}`);
      if (options.spec) console.log(`   Spec: ${options.spec}`);
      if (options.english) console.log(`   English: "${options.english}"`);
      if (config.headed) console.log(`   Headed: true (visible browser)`);
      console.log('');

      // Run tests
      const results = await runTests(config);

      // Write reports
      await writeReport(results, config.outDir);

      // Print summary
      console.log('\n📊 Test Results Summary:');
      for (const result of results) {
        const statusIcon = result.ok ? '✅' : '❌';
        console.log(`   ${statusIcon} [${result.platform}] ${result.scenario}`);
        console.log(`      Total: ${result.summary.total}, Passed: ${result.summary.passed}, Failed: ${result.summary.failed}, Healed: ${result.summary.healed}`);
      }

      console.log(`\n📁 Artifacts saved to: ${config.outDir}`);
      console.log('   - run.json (raw results)');
      console.log('   - report.html (visual report)');
      console.log('   - junit.xml (CI report)');
      console.log('');

      // Exit with appropriate code
      const allPassed = results.every(r => r.ok);
      process.exit(allPassed ? 0 : 1);

    } catch (err) {
      console.error('\n❌ Test run failed:', err);
      process.exit(1);
    }
  });

program.parse();
