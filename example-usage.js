const PerformanceTestSuite = require('./perf-suite.js');
const PerformanceComparisonEngine = require('./compare.js');
const ReportGenerator = require('./reports/report-generator.js');
const ValidationSystem = require('./validation.js');

async function runComprehensiveExample() {
  console.log('🚀 Performance Testing Framework - Comprehensive Example\n');

  try {
    // 1. Configure the test suite
    const config = {
      environments: {
        staging: {
          name: 'staging',
          pageUrl: 'https://staging.example.com/app',
          mainJsUrl: 'https://staging.example.com/assets/main.js',
          baseUrl: 'https://staging.example.com'
        },
        production: {
          name: 'production',
          pageUrl: 'https://www.example.com/app',
          mainJsUrl: 'https://www.example.com/assets/main-abc123.js',
          baseUrl: 'https://www.example.com'
        }
      },
      scenarios: ['cold-start', 'warm-start', 'critical-path', 'api-endpoints'],
      iterations: 5, // Reduced for example
      timeout: 30000,
      retryAttempts: 2,
      outputDir: './example-results'
    };

    // 2. Create and run the test suite
    console.log('📊 Step 1: Running comprehensive performance tests...');
    const testSuite = new PerformanceTestSuite(config);
    const results = await testSuite.runTestSuite();

    console.log(`✅ Test suite completed in ${results.metadata.duration}ms\n`);

    // 3. Validate the results
    console.log('🔍 Step 2: Validating test results...');
    const validation = new ValidationSystem();
    const validationResult = await validation.validateTestRun(results);

    console.log(`Validation Score: ${validationResult.score}/100`);
    console.log(`Status: ${validationResult.passed ? '✅ PASSED' : '❌ FAILED'}`);

    if (validationResult.issues.length > 0) {
      console.log('Issues detected:');
      validationResult.issues.forEach(issue => {
        console.log(`  - ${issue.type}: ${issue.message}`);
      });
    }

    if (validationResult.warnings.length > 0) {
      console.log('Warnings:');
      validationResult.warnings.forEach(warning => {
        console.log(`  - ${warning.type}: ${warning.message}`);
      });
    }

    console.log('');

    // 4. Generate comprehensive reports
    console.log('📄 Step 3: Generating reports...');
    const reportGenerator = new ReportGenerator();
    const reportFiles = reportGenerator.generateAllReports(results, config.outputDir, {
      console: false, // We'll show our own console output
      markdown: true,
      html: true,
      csv: true,
      summary: true
    });

    console.log('Generated reports:');
    Object.entries(reportFiles).forEach(([type, file]) => {
      console.log(`  - ${type}: ${file}`);
    });
    console.log('');

    // 5. Create a baseline for future comparisons
    console.log('📊 Step 4: Creating baseline for future comparisons...');
    const baseline = validation.createBaseline(results, 'example-baseline');
    const fs = require('fs');
    const baselinePath = `${config.outputDir}/baseline-example.json`;
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`Baseline saved to: ${baselinePath}\n`);

    // 6. Demonstrate environment comparison
    console.log('🔍 Step 5: Comparing environments...');
    const envNames = Object.keys(results.results);
    if (envNames.length >= 2) {
      const comparisonEngine = new PerformanceComparisonEngine();
      const comparison = comparisonEngine.compareEnvironments(
        results.results[envNames[0]],
        results.results[envNames[1]]
      );

      console.log(`Comparing ${envNames[1]} vs ${envNames[0]}:`);
      console.log(`Overall Impact: ${comparison.summary.overallImpact}`);
      console.log(`Significant Changes: ${comparison.summary.significantChanges.length}`);
      console.log(`Regressions: ${comparison.summary.regressions.length}`);
      console.log(`Improvements: ${comparison.summary.improvements.length}\n`);

      if (comparison.summary.regressions.length > 0) {
        console.log('Performance Regressions Detected:');
        comparison.summary.regressions.forEach(regression => {
          console.log(`  - ${regression}`);
        });
        console.log('');
      }

      if (comparison.summary.improvements.length > 0) {
        console.log('Performance Improvements Detected:');
        comparison.summary.improvements.forEach(improvement => {
          console.log(`  - ${improvement}`);
        });
        console.log('');
      }
    }

    // 7. Show key metrics summary
    console.log('📈 Step 6: Key Performance Metrics Summary:');
    Object.entries(results.results).forEach(([envName, envResult]) => {
      console.log(`\n${envName.toUpperCase()} Environment:`);

      if (envResult.infrastructure) {
        console.log('  Infrastructure:');
        console.log(`    CDN: ${envResult.infrastructure.cdn?.detected ? '✅' : '❌'} ${envResult.infrastructure.cdn?.provider || 'None'}`);
        console.log(`    Compression: ${envResult.infrastructure.compression?.enabled ? '✅' : '❌'} ${envResult.infrastructure.compression?.algorithm || 'None'}`);
        console.log(`    HTTP/2: ${envResult.infrastructure.protocols?.http2Support ? '✅' : '❌'}`);
        console.log(`    Security Score: ${envResult.infrastructure.security?.score || 0}/100`);
      }

      if (envResult.scenarios) {
        console.log('  Performance:');
        Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
          if (scenario.statistics) {
            const mainMetric = Object.entries(scenario.statistics).find(([key, value]) =>
              typeof value === 'object' && value.mean !== undefined
            );

            if (mainMetric) {
              const [metricName, stats] = mainMetric;
              console.log(`    ${scenarioName}: ${stats.mean.toFixed(1)}ms (±${stats.stddev.toFixed(1)}ms, ${(scenario.statistics.successRate || 0).toFixed(1)}% success)`);
            }
          }
        });
      }
    });

    // 8. Performance budget validation example
    console.log('\n💰 Step 7: Performance Budget Validation:');
    const performanceBudget = {
      'performance.timing.total': 3000, // 3 seconds max total time
      'timing.ttfb': 800, // 800ms max TTFB
      'timing.response': 1000 // 1 second max response time
    };

    const comparisonEngine = new PerformanceComparisonEngine();
    Object.entries(results.results).forEach(([envName, envResult]) => {
      const budgetValidation = comparisonEngine.validatePerformanceBudget(envResult, performanceBudget);

      console.log(`${envName} Budget Validation: ${budgetValidation.passed ? '✅ PASSED' : '❌ FAILED'}`);

      if (budgetValidation.violations.length > 0) {
        console.log('  Budget Violations:');
        budgetValidation.violations.forEach(violation => {
          console.log(`    - ${violation.metric}: ${violation.value}ms > ${violation.limit}ms (exceeded by ${violation.exceedBy}ms)`);
        });
      }

      if (budgetValidation.warnings.length > 0) {
        console.log('  Budget Warnings:');
        budgetValidation.warnings.forEach(warning => {
          console.log(`    - ${warning.metric}: ${warning.value}ms approaching limit of ${warning.limit}ms`);
        });
      }
    });

    // 9. Recommendations
    console.log('\n💡 Step 8: Optimization Recommendations:');
    if (validationResult.recommendations.length > 0) {
      validationResult.recommendations.forEach(rec => {
        console.log(`  ${rec.type.toUpperCase()}: ${rec.message}`);
        if (rec.actions) {
          rec.actions.forEach(action => {
            console.log(`    • ${action}`);
          });
        }
      });
    } else {
      console.log('  No specific recommendations at this time.');
    }

    console.log('\n🎉 Comprehensive performance testing example completed successfully!');
    console.log('\nNext Steps:');
    console.log('1. Review generated reports in the example-results directory');
    console.log('2. Use the baseline for future performance comparisons');
    console.log('3. Integrate this testing into your CI/CD pipeline');
    console.log('4. Set up automated performance monitoring');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Utility function to demonstrate usage patterns
function showUsageExamples() {
  console.log(`
🔧 USAGE EXAMPLES:

1. Basic Test Run:
   node example-usage.js

2. CLI Usage:
   node perf-cli.js run --iterations 5 --scenarios cold-start,warm-start

3. Custom Configuration:
   const testSuite = new PerformanceTestSuite({
     environments: { /* your environments */ },
     scenarios: ['cold-start', 'api-endpoints'],
     iterations: 10
   });

4. Compare Results:
   node perf-cli.js compare --baseline baseline.json --comparison latest.json

5. Validate Against Baseline:
   node perf-cli.js validate --file results.json --baseline baseline.json

6. Generate Custom Reports:
   const reportGenerator = new ReportGenerator();
   reportGenerator.generateAllReports(results, './reports', {
     html: true,
     markdown: false
   });

7. CI/CD Integration:
   node perf-cli.js run --baseline production --strict
   # Exit code 1 if performance regressions detected

8. Performance Budget Monitoring:
   const budget = { 'timing.total': 2000 };
   const validation = engine.validatePerformanceBudget(results, budget);
`);
}

// Run the example if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showUsageExamples();
  } else {
    runComprehensiveExample();
  }
}

module.exports = {
  runComprehensiveExample,
  showUsageExamples
};