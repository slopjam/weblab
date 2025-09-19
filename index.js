#!/usr/bin/env node

/**
 * Comprehensive Performance Testing Framework
 *
 * Main entry point - delegates to CLI interface
 */

const PerformanceCLI = require('./perf-cli.js');

// If running as main module, start CLI
if (require.main === module) {
  const cli = new PerformanceCLI();
  cli.run().catch(error => {
    console.error('Performance testing failed:', error.message);
    process.exit(1);
  });
}

// Export main classes for programmatic use
module.exports = {
  PerformanceTestSuite: require('./perf-suite.js'),
  MetricsCollector: require('./metrics-collector.js'),
  InfrastructureAnalyzer: require('./infra-analyzer.js'),
  PerformanceComparisonEngine: require('./compare.js'),
  ValidationSystem: require('./validation.js'),
  ReportGenerator: require('./reports/report-generator.js'),
  PerformanceCLI: require('./perf-cli.js')
};