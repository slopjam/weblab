# Comprehensive Performance Testing Framework

A robust, automated performance testing suite for web applications that provides reliable comparison of performance across infrastructure changes, deployments, and environments. Built with statistical analysis, infrastructure detection, and comprehensive reporting capabilities.

## 🚀 Features

### Core Capabilities
- **Multi-Environment Testing**: Compare performance between development, staging, and production
- **Statistical Analysis**: Detect 5% performance changes with 95% confidence using proper statistical tests
- **Infrastructure Detection**: Analyze CDN, compression, HTTP protocols, and security configurations
- **Comprehensive Metrics**: Connection timing, resource loading, Web Vitals, and custom metrics
- **Edge Case Handling**: Robust error handling, retry logic, and network failure recovery
- **Detailed Reporting**: HTML dashboards, Markdown reports, CSV exports, and CLI output

### Testing Scenarios
- **Cold Start**: Fresh browser, cleared cache, new connections
- **Warm Start**: Primed cache, existing connections
- **Critical Path**: Above-the-fold content and critical rendering path analysis
- **API Endpoints**: Direct API performance testing and analysis

### Validation & Quality Assurance
- **Statistical Validation**: Coefficient of variation < 10% for stable measurements
- **Regression Detection**: Automatic detection of performance regressions
- **Performance Budgets**: Validate against predefined performance thresholds
- **Data Quality Checks**: Outlier detection, null value handling, success rate monitoring

## 📦 Installation

```bash
# Install dependencies
npm install

# Make CLI executable (optional)
chmod +x perf-cli.js
```

## 🏃‍♂️ Quick Start

### Configuration

Before running tests, you need to configure your environments. Create a `perf-config.json` file:

```json
{
  "environments": {
    "staging": {
      "name": "staging",
      "pageUrl": "https://staging.example.com/app",
      "mainJsUrl": "https://staging.example.com/assets/main.js",
      "baseUrl": "https://staging.example.com"
    },
    "production": {
      "name": "production",
      "pageUrl": "https://www.example.com/app",
      "mainJsUrl": "https://www.example.com/assets/main-abc123.js",
      "baseUrl": "https://www.example.com"
    }
  },
  "scenarios": ["cold-start", "warm-start", "critical-path", "api-endpoints"],
  "iterations": 10,
  "timeout": 30000,
  "retryAttempts": 3,
  "outputDir": "./results"
}
```

Alternatively, configure in your `package.json`:

```json
{
  "performanceTest": {
    "environments": {
      "staging": {
        "name": "staging",
        "pageUrl": "https://staging.example.com/app",
        "mainJsUrl": "https://staging.example.com/assets/main.js",
        "baseUrl": "https://staging.example.com"
      }
    },
    "scenarios": ["cold-start", "warm-start"],
    "iterations": 10
  }
}
```

### Basic Usage

```bash
# Run full test suite (requires configuration)
node perf-cli.js run

# Run with custom config file
node perf-cli.js run --config my-config.json

# Run specific scenarios
node perf-cli.js run --scenarios cold-start,warm-start --iterations 5

# Quick test (3 iterations, 2 scenarios)
npm test
```

### Programmatic Usage

```javascript
const PerformanceTestSuite = require('./perf-suite.js');

const testSuite = new PerformanceTestSuite({
  environments: {
    development: {
      name: 'development',
      pageUrl: 'https://dev.example.com',
      mainJsUrl: 'https://dev.example.com/main.js',
      baseUrl: 'https://dev.example.com'
    }
  },
  scenarios: ['cold-start', 'warm-start'],
  iterations: 10
});

const results = await testSuite.runTestSuite();
```

## 📊 CLI Commands

### Run Tests
```bash
# Full test suite with default settings
node perf-cli.js run

# Custom configuration
node perf-cli.js run --iterations 10 --timeout 30000 --output ./results

# Create baseline for future comparisons
node perf-cli.js run --baseline v1.0.0

# Strict mode (exit with error on validation failure)
node perf-cli.js run --strict
```

### Compare Results
```bash
# Compare two test results
node perf-cli.js compare --baseline baseline-v1.0.0.json --comparison results-latest.json

# Strict comparison (exit with error on regressions)
node perf-cli.js compare --baseline old.json --comparison new.json --strict
```

### Validate Results
```bash
# Validate test results
node perf-cli.js validate --file results.json

# Validate against baseline
node perf-cli.js validate --file results.json --baseline baseline.json --strict
```

### Generate Reports
```bash
# Generate all report types
node perf-cli.js report --file results.json

# Generate specific reports
node perf-cli.js report --file results.json --no-csv --no-html --output ./custom-reports
```

## ⚙️ Configuration

Create a `perf-config.json` file in your project root:

```json
{
  "environments": {
    "staging": {
      "name": "staging",
      "pageUrl": "https://staging.example.com/page",
      "mainJsUrl": "https://staging.example.com/main.js",
      "baseUrl": "https://staging.example.com"
    },
    "production": {
      "name": "production",
      "pageUrl": "https://production.example.com/page",
      "mainJsUrl": "https://production.example.com/main.js",
      "baseUrl": "https://production.example.com"
    }
  },
  "scenarios": ["cold-start", "warm-start", "critical-path", "api-endpoints"],
  "iterations": 10,
  "timeout": 30000,
  "retryAttempts": 3,
  "outputDir": "./results"
}
```

### Environment Variables in package.json

```json
{
  "performanceTest": {
    "environments": { /* your environments */ },
    "scenarios": ["cold-start", "warm-start"],
    "iterations": 10
  }
}
```

## 📈 Understanding Results

### Console Output
```
🚀 PERFORMANCE TEST RESULTS

DEVELOPMENT ENVIRONMENT
─────────────────────────────────
Infrastructure:
  CDN: ✓ Cloudflare
  Compression: 🟢 Brotli (excellent)
  HTTP/2: ✓
  Security Score: 🟢 85/100

Scenario Results:
  cold-start:
    timing.total: 1250ms (±150ms, CV: 12.0%)
    timing.ttfb: 320ms (±45ms, CV: 14.1%)
    Success Rate: 100.0%
```

### Statistical Analysis
- **Coefficient of Variation (CV)**: < 10% indicates excellent consistency
- **Confidence Intervals**: 95% confidence level for all statistical tests
- **P-values**: Statistical significance testing for comparisons
- **Regression Detection**: Automatic flagging of 5%+ performance changes

### Infrastructure Analysis
- **CDN Detection**: Provider identification and POP location
- **Compression Analysis**: Algorithm detection and effectiveness measurement
- **Protocol Support**: HTTP/2, HTTP/3 detection and analysis
- **Security Assessment**: Security header analysis and scoring

## 🔍 Validation Features

### Quality Metrics
- **Data Quality**: Success rate monitoring, outlier detection
- **Statistical Reliability**: CV thresholds, sample size validation
- **Execution Reliability**: Error rate monitoring, timeout handling
- **Infrastructure Consistency**: Cross-environment configuration validation

### Performance Budgets
```javascript
const budget = {
  'timing.total': 3000,      // 3 seconds max total time
  'timing.ttfb': 800,        // 800ms max TTFB
  'webVitals.lcp': 2500      // 2.5s max LCP
};

const validation = engine.validatePerformanceBudget(results, budget);
```

## 📊 Reporting Options

### Available Formats
- **Console**: Colored CLI output with real-time results
- **HTML**: Interactive dashboard with charts and detailed analysis
- **Markdown**: Documentation-friendly reports
- **CSV**: Spreadsheet-compatible data export
- **JSON**: Machine-readable detailed results

### Report Generation
```bash
# Generate all report types
node perf-cli.js report --file results.json

# Custom report selection
node perf-cli.js report --file results.json --no-csv --output ./reports
```

## 🛠️ CI/CD Integration

### GitHub Actions Example
```yaml
name: Performance Testing
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm install

      - name: Run performance tests
        run: node perf-cli.js run --baseline production --strict

      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: results/
```

### Jenkins Pipeline
```groovy
pipeline {
  agent any
  stages {
    stage('Performance Testing') {
      steps {
        sh 'npm install'
        sh 'node perf-cli.js run --baseline production --strict'
        publishHTML([
          allowMissing: false,
          alwaysLinkToLastBuild: true,
          keepAll: true,
          reportDir: 'results',
          reportFiles: '*.html',
          reportName: 'Performance Report'
        ])
      }
    }
  }
  post {
    always {
      archiveArtifacts artifacts: 'results/**/*', fingerprint: true
    }
  }
}
```

## 🎯 Example Use Cases

### 1. Infrastructure Change Validation
```bash
# Before infrastructure change
node perf-cli.js run --baseline before-cdn-change

# After infrastructure change
node perf-cli.js run

# Compare results
node perf-cli.js compare --baseline baseline-before-cdn-change.json --comparison results-latest.json --strict
```

### 2. Deployment Performance Monitoring
```bash
# Continuous monitoring in CI/CD
node perf-cli.js run --baseline production
if [ $? -ne 0 ]; then
  echo "Performance regression detected!"
  exit 1
fi
```

### 3. A/B Testing Performance Analysis
```javascript
const testSuite = new PerformanceTestSuite({
  environments: {
    controlGroup: { /* control configuration */ },
    testGroup: { /* test configuration */ }
  }
});

const results = await testSuite.runTestSuite();
// Statistical comparison automatically provided
```

## 🔧 Advanced Configuration

### Custom Scenarios
Create custom test scenarios in the `scenarios/` directory:

```javascript
// scenarios/custom-scenario.js
class CustomScenario {
  constructor() {
    this.name = 'custom-scenario';
    this.description = 'Custom performance test scenario';
  }

  async run(page, envConfig, metricsCollector) {
    // Your custom test logic
    return {
      scenario: this.name,
      success: true,
      metrics: { /* your metrics */ }
    };
  }
}

module.exports = new CustomScenario();
```

### Custom Metrics Collection
```javascript
const metricsCollector = new MetricsCollector();

// Enable specific metric types
metricsCollector.enableMetrics(['connection', 'webVitals']);

// Disable specific metric types
metricsCollector.disableMetrics(['resources']);

const metrics = await metricsCollector.collectAllMetrics(page, url);
```

## 📋 Best Practices

### Test Environment Setup
1. **Consistent Network**: Use dedicated testing infrastructure
2. **Clean Browser State**: Fresh browser instances for each test
3. **Sufficient Iterations**: Minimum 10 iterations for reliable statistics
4. **Environment Isolation**: Separate test environments from production traffic

### Statistical Reliability
1. **Monitor CV**: Keep coefficient of variation < 10%
2. **Sample Size**: Use enough iterations for statistical significance
3. **Outlier Handling**: Investigate and document unusual results
4. **Baseline Management**: Regularly update baselines with known good states

### Monitoring Strategy
1. **Automated Testing**: Integrate into CI/CD pipelines
2. **Performance Budgets**: Set and monitor performance thresholds
3. **Trend Analysis**: Track performance over time
4. **Alert Configuration**: Set up alerts for regressions

## 🐛 Troubleshooting

### Common Issues

**High Coefficient of Variation (CV > 20%)**
- Check network stability
- Increase number of iterations
- Verify test environment consistency

**Test Timeouts**
- Increase timeout values
- Check target URL accessibility
- Review network connectivity

**Infrastructure Detection Failures**
- Verify target URLs are accessible
- Check for proper HTTPS configuration
- Review CDN and compression settings

**Statistical Test Failures**
- Ensure sufficient sample sizes
- Check for data quality issues
- Review baseline validity

### Debug Mode
```bash
# Enable verbose logging
node perf-cli.js run --verbose

# Check configuration
node perf-cli.js config
```

## 📚 API Reference

### PerformanceTestSuite
Main orchestrator class for running performance tests.

```javascript
const testSuite = new PerformanceTestSuite(config);
const results = await testSuite.runTestSuite();
```

### MetricsCollector
Comprehensive metrics collection from browser performance APIs.

```javascript
const collector = new MetricsCollector();
const metrics = await collector.collectAllMetrics(page, url, config);
```

### PerformanceComparisonEngine
Statistical analysis and comparison of test results.

```javascript
const engine = new PerformanceComparisonEngine();
const comparison = engine.compareEnvironments(baseline, comparison);
```

### ValidationSystem
Result validation and quality assurance.

```javascript
const validator = new ValidationSystem();
const validation = await validator.validateTestRun(results);
```

### ReportGenerator
Multi-format report generation.

```javascript
const reporter = new ReportGenerator();
const reports = reporter.generateAllReports(results, outputDir, options);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- [Documentation](./docs/)
- [Examples](./examples/)
- [Issue Tracker](https://github.com/username/careperf/issues)
- [Changelog](./CHANGELOG.md)

---

Built with ❤️ for reliable performance testing and monitoring.