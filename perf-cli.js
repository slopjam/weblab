#!/usr/bin/env node

const PerformanceTestSuite = require('./perf-suite.js');
const PerformanceComparisonEngine = require('./compare.js');
const ReportGenerator = require('./reports/report-generator.js');
const ValidationSystem = require('./validation.js');
const fs = require('fs');
const path = require('path');

class PerformanceCLI {
  constructor() {
    this.commands = {
      'run': this.runTests.bind(this),
      'compare': this.compareResults.bind(this),
      'validate': this.validateResults.bind(this),
      'report': this.generateReport.bind(this),
      'config': this.showConfig.bind(this),
      'help': this.showHelp.bind(this)
    };

    this.defaultConfig = {
      environments: {
        development: {
          name: 'development',
          pageUrl: 'https://variant-pete-a--develop--sit.cecm-web.test-web-cloud.siriusxm.com/care/phx/subscribe/checkout/purchase/satellite/organic/new?programcode=MCP5FOR12',
          mainJsUrl: 'https://variant-pete-a--develop--sit.cecm-web.test-web-cloud.siriusxm.com/care/phx/main.js',
          baseUrl: 'https://variant-pete-a--develop--sit.cecm-web.test-web-cloud.siriusxm.com'
        },
        production: {
          name: 'production',
          pageUrl: 'https://care.siriusxm.com/subscribe/checkout/purchase/satellite/organic/new?programcode=MCP5FOR12',
          mainJsUrl: 'https://care.siriusxm.com/ngapp/main-GGAVZFWV.js',
          baseUrl: 'https://care.siriusxm.com'
        }
      },
      scenarios: ['cold-start', 'warm-start', 'critical-path', 'api-endpoints'],
      iterations: 10,
      outputDir: './results',
      timeout: 30000,
      retryAttempts: 3,
      enableLogging: true
    };
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    const options = this.parseOptions(args.slice(1));

    try {
      if (this.commands[command]) {
        await this.commands[command](options);
      } else {
        console.error(`Unknown command: ${command}`);
        this.showHelp();
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  parseOptions(args) {
    const options = {};

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]?.replace(/^--/, '');
      const value = args[i + 1];

      if (key && value !== undefined) {
        // Convert string values to appropriate types
        if (value === 'true') options[key] = true;
        else if (value === 'false') options[key] = false;
        else if (!isNaN(value) && !isNaN(parseFloat(value))) options[key] = parseFloat(value);
        else options[key] = value;
      } else if (key) {
        options[key] = true; // Boolean flags
      }
    }

    return options;
  }

  async runTests(options) {
    console.log('🚀 Starting Performance Test Suite...\n');

    // Load configuration
    const config = await this.loadConfig(options.config);
    this.applyOptionsToConfig(config, options);

    // Validate configuration
    this.validateConfig(config);

    // Create test suite
    const testSuite = new PerformanceTestSuite(config);

    // Run tests
    const results = await testSuite.runTestSuite();

    // Validate results
    const validation = new ValidationSystem();
    const validationResult = await validation.validateTestRun(results);

    console.log(`\n📊 Test Suite Validation Score: ${validationResult.score}/100`);
    if (!validationResult.passed) {
      console.log('⚠️  Validation Issues Detected:');
      validationResult.issues.forEach(issue => {
        console.log(`   - ${issue.message}`);
      });
    }

    // Generate reports
    const reportGenerator = new ReportGenerator();
    const reportFiles = reportGenerator.generateAllReports(results, config.outputDir, {
      console: true,
      markdown: !options.noMarkdown,
      html: !options.noHtml,
      csv: !options.noCsv,
      summary: true
    });

    console.log('\n📄 Reports Generated:');
    Object.entries(reportFiles).forEach(([type, file]) => {
      console.log(`   ${type}: ${file}`);
    });

    // Save validation results
    const validationPath = path.join(config.outputDir, `validation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(validationPath, JSON.stringify(validationResult, null, 2));
    console.log(`   validation: ${validationPath}`);

    if (options.baseline) {
      const baseline = validation.createBaseline(results, options.baseline);
      const baselinePath = path.join(config.outputDir, `baseline-${options.baseline}.json`);
      fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
      console.log(`   baseline: ${baselinePath}`);
    }

    console.log('\n✅ Performance testing completed successfully!');

    // Exit with error code if validation failed
    if (!validationResult.passed && options.strict) {
      process.exit(1);
    }
  }

  async compareResults(options) {
    if (!options.baseline || !options.comparison) {
      console.error('Error: Both --baseline and --comparison file paths are required');
      process.exit(1);
    }

    console.log('📊 Comparing Performance Results...\n');

    // Load result files
    const baselineResults = JSON.parse(fs.readFileSync(options.baseline, 'utf8'));
    const comparisonResults = JSON.parse(fs.readFileSync(options.comparison, 'utf8'));

    // Perform comparison
    const comparisonEngine = new PerformanceComparisonEngine();
    const comparison = comparisonEngine.compareEnvironments(
      baselineResults.results?.[Object.keys(baselineResults.results)[0]] || baselineResults,
      comparisonResults.results?.[Object.keys(comparisonResults.results)[0]] || comparisonResults
    );

    // Generate comparison report
    const reportGenerator = new ReportGenerator();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = options.output || './results';

    // Create comparison results structure for reporting
    const comparisonReport = {
      metadata: {
        timestamp,
        type: 'comparison',
        baseline: options.baseline,
        comparison: options.comparison
      },
      comparison
    };

    // Save detailed comparison
    const comparisonPath = path.join(outputDir, `comparison-${timestamp}.json`);
    fs.writeFileSync(comparisonPath, JSON.stringify(comparisonReport, null, 2));

    // Generate console output
    this.printComparison(comparison);

    // Generate reports if requested
    if (!options.noReport) {
      const reportFiles = reportGenerator.generateAllReports(comparisonReport, outputDir);
      console.log('\n📄 Comparison Reports Generated:');
      Object.entries(reportFiles).forEach(([type, file]) => {
        console.log(`   ${type}: ${file}`);
      });
    }

    console.log(`\nDetailed comparison saved to: ${comparisonPath}`);

    // Exit with error code if regressions detected
    if (comparison.summary.regressions.length > 0 && options.strict) {
      console.log('\n❌ Performance regressions detected!');
      process.exit(1);
    } else {
      console.log('\n✅ Comparison completed successfully!');
    }
  }

  async validateResults(options) {
    if (!options.file) {
      console.error('Error: --file path is required');
      process.exit(1);
    }

    console.log('🔍 Validating Performance Results...\n');

    // Load results
    const results = JSON.parse(fs.readFileSync(options.file, 'utf8'));

    // Validate
    const validation = new ValidationSystem();
    const validationResult = await validation.validateTestRun(results);

    // Print validation results
    console.log(`Validation Score: ${validationResult.score}/100`);
    console.log(`Status: ${validationResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

    if (validationResult.issues.length > 0) {
      console.log('🚨 Issues:');
      validationResult.issues.forEach(issue => {
        console.log(`   - ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
      console.log('');
    }

    if (validationResult.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      validationResult.warnings.forEach(warning => {
        console.log(`   - ${warning.message}`);
      });
      console.log('');
    }

    if (validationResult.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      validationResult.recommendations.forEach(rec => {
        console.log(`   - ${rec.message}`);
        if (rec.actions) {
          rec.actions.forEach(action => {
            console.log(`     • ${action}`);
          });
        }
      });
    }

    // Compare against baseline if provided
    if (options.baseline) {
      const baseline = JSON.parse(fs.readFileSync(options.baseline, 'utf8'));
      const baselineComparison = validation.validateAgainstBaseline(results, baseline);

      console.log('\n📊 Baseline Comparison:');
      console.log(`Score: ${baselineComparison.score}/100`);

      if (baselineComparison.regressions.length > 0) {
        console.log('\n📉 Regressions:');
        baselineComparison.regressions.forEach(reg => {
          console.log(`   - ${reg.environment}.${reg.scenario}.${reg.metric}: ${reg.changePercent.toFixed(2)}% worse`);
        });
      }

      if (baselineComparison.improvements.length > 0) {
        console.log('\n📈 Improvements:');
        baselineComparison.improvements.forEach(imp => {
          console.log(`   - ${imp.environment}.${imp.scenario}.${imp.metric}: ${Math.abs(imp.changePercent).toFixed(2)}% better`);
        });
      }
    }

    // Exit with error code if validation failed
    if (!validationResult.passed && options.strict) {
      process.exit(1);
    }
  }

  async generateReport(options) {
    if (!options.file) {
      console.error('Error: --file path is required');
      process.exit(1);
    }

    console.log('📄 Generating Performance Report...\n');

    // Load results
    const results = JSON.parse(fs.readFileSync(options.file, 'utf8'));

    // Generate reports
    const reportGenerator = new ReportGenerator();
    const outputDir = options.output || './results';
    const reportOptions = {
      console: !options.noConsole,
      markdown: !options.noMarkdown,
      html: !options.noHtml,
      csv: !options.noCsv,
      summary: !options.noSummary
    };

    const reportFiles = reportGenerator.generateAllReports(results, outputDir, reportOptions);

    console.log('📄 Reports Generated:');
    Object.entries(reportFiles).forEach(([type, file]) => {
      console.log(`   ${type}: ${file}`);
    });

    console.log('\n✅ Report generation completed successfully!');
  }

  async showConfig(options) {
    const config = await this.loadConfig(options.file);

    if (options.key) {
      const value = this.getConfigValue(config, options.key);
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log('📋 Current Configuration:');
      console.log(JSON.stringify(config, null, 2));
    }
  }

  showHelp() {
    console.log(`
🚀 Performance Test Suite CLI

USAGE:
  node perf-cli.js <command> [options]

COMMANDS:
  run            Run performance tests
  compare        Compare two performance test results
  validate       Validate performance test results
  report         Generate reports from test results
  config         Show configuration
  help           Show this help message

RUN OPTIONS:
  --config <file>        Configuration file path
  --scenarios <list>     Comma-separated list of scenarios to run
  --iterations <num>     Number of iterations per scenario (default: 10)
  --timeout <ms>         Timeout for each test (default: 30000)
  --output <dir>         Output directory (default: ./results)
  --baseline <name>      Create a baseline with this name
  --strict               Exit with error code on validation failure
  --no-markdown          Skip markdown report generation
  --no-html              Skip HTML report generation
  --no-csv               Skip CSV report generation
  --verbose              Enable verbose logging

COMPARE OPTIONS:
  --baseline <file>      Baseline results file
  --comparison <file>    Comparison results file
  --output <dir>         Output directory (default: ./results)
  --strict               Exit with error code on regressions
  --no-report            Skip report generation

VALIDATE OPTIONS:
  --file <file>          Results file to validate
  --baseline <file>      Baseline file for comparison
  --strict               Exit with error code on validation failure

REPORT OPTIONS:
  --file <file>          Results file to generate reports from
  --output <dir>         Output directory (default: ./results)
  --no-console           Skip console output
  --no-markdown          Skip markdown report
  --no-html              Skip HTML report
  --no-csv               Skip CSV report
  --no-summary           Skip summary report

CONFIG OPTIONS:
  --file <file>          Configuration file to display
  --key <path>           Show specific configuration value

EXAMPLES:
  # Run full test suite
  node perf-cli.js run

  # Run specific scenarios with custom iterations
  node perf-cli.js run --scenarios cold-start,warm-start --iterations 5

  # Create a baseline
  node perf-cli.js run --baseline v1.0.0

  # Compare two test results
  node perf-cli.js compare --baseline baseline-v1.0.0.json --comparison results-latest.json

  # Validate results against baseline
  node perf-cli.js validate --file results.json --baseline baseline.json

  # Generate custom reports
  node perf-cli.js report --file results.json --output ./reports --no-csv

CONFIGURATION:
  Create a 'perf-config.json' file in your project root to customize settings.
  Use 'node perf-cli.js config' to see current configuration.

EXIT CODES:
  0: Success
  1: Failure (tests failed, validation failed, or errors occurred)
`);
  }

  async loadConfig(configPath) {
    let config = { ...this.defaultConfig };

    // Try to load config file
    const configFiles = [
      configPath,
      './perf-config.json',
      './performance.config.js',
      './package.json'
    ].filter(Boolean);

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        try {
          let fileConfig;
          if (file.endsWith('.js')) {
            fileConfig = require(path.resolve(file));
          } else {
            const content = fs.readFileSync(file, 'utf8');
            const parsed = JSON.parse(content);
            fileConfig = file.endsWith('package.json') ? parsed.performanceTest || {} : parsed;
          }

          config = { ...config, ...fileConfig };
          break;
        } catch (error) {
          console.warn(`Warning: Could not load config from ${file}: ${error.message}`);
        }
      }
    }

    return config;
  }

  applyOptionsToConfig(config, options) {
    if (options.scenarios) {
      config.scenarios = options.scenarios.split(',').map(s => s.trim());
    }
    if (options.iterations) config.iterations = options.iterations;
    if (options.timeout) config.timeout = options.timeout;
    if (options.output) config.outputDir = options.output;
    if (options.retryAttempts) config.retryAttempts = options.retryAttempts;
    if (options.verbose !== undefined) config.enableLogging = options.verbose;
  }

  validateConfig(config) {
    if (!config.environments || Object.keys(config.environments).length === 0) {
      throw new Error('No environments configured');
    }

    Object.entries(config.environments).forEach(([name, env]) => {
      if (!env.pageUrl || !env.mainJsUrl) {
        throw new Error(`Environment '${name}' missing required URLs`);
      }
    });

    if (!config.scenarios || config.scenarios.length === 0) {
      throw new Error('No scenarios configured');
    }

    if (config.iterations < 1 || config.iterations > 100) {
      throw new Error('Iterations must be between 1 and 100');
    }
  }

  getConfigValue(config, key) {
    return key.split('.').reduce((obj, part) => obj?.[part], config);
  }

  printComparison(comparison) {
    console.log(`Comparing ${comparison.comparison} vs ${comparison.baseline}:\n`);

    if (comparison.summary.significantChanges.length > 0) {
      console.log('📊 Significant Changes:');
      comparison.summary.significantChanges.forEach(change => {
        console.log(`   ${change}`);
      });
      console.log('');
    }

    if (comparison.summary.regressions.length > 0) {
      console.log('📉 Performance Regressions:');
      comparison.summary.regressions.forEach(regression => {
        console.log(`   ▼ ${regression}`);
      });
      console.log('');
    }

    if (comparison.summary.improvements.length > 0) {
      console.log('📈 Performance Improvements:');
      comparison.summary.improvements.forEach(improvement => {
        console.log(`   ▲ ${improvement}`);
      });
      console.log('');
    }

    const impact = comparison.summary.overallImpact;
    const emoji = impact === 'positive' ? '✅' : impact === 'negative' ? '❌' : '🔄';
    console.log(`${emoji} Overall Impact: ${impact.toUpperCase()}`);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new PerformanceCLI();
  cli.run().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = PerformanceCLI;