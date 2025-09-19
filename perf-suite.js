const { chromium } = require('playwright');
const MetricsCollector = require('./metrics-collector.js');
const InfraAnalyzer = require('./infra-analyzer.js');
const fs = require('fs');
const path = require('path');

class PerformanceTestSuite {
  constructor(config = {}) {
    this.config = {
      environments: config.environments || this.getDefaultEnvironments(),
      scenarios: config.scenarios || ['cold-start', 'warm-start'],
      iterations: config.iterations || 10,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      outputDir: config.outputDir || './results',
      enableLogging: config.enableLogging !== false,
      ...config
    };

    this.metricsCollector = new MetricsCollector();
    this.infraAnalyzer = new InfraAnalyzer();
    this.results = {};
    this.startTime = null;
  }

  getDefaultEnvironments() {
    return {};
  }

  log(level, message, data = null) {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }

  async runTestSuite() {
    this.startTime = Date.now();
    this.log('info', 'Starting Performance Test Suite', {
      environments: Object.keys(this.config.environments),
      scenarios: this.config.scenarios,
      iterations: this.config.iterations
    });

    try {
      // Ensure output directory exists
      this.ensureOutputDir();

      // Run tests for each environment
      for (const [envName, envConfig] of Object.entries(this.config.environments)) {
        this.log('info', `Testing environment: ${envName}`);
        this.results[envName] = await this.runEnvironmentTests(envConfig);
      }

      // Generate final report
      const finalResults = await this.generateFinalReport();

      const totalTime = Date.now() - this.startTime;
      this.log('info', `Test suite completed in ${totalTime}ms`);

      return finalResults;

    } catch (error) {
      this.log('error', 'Test suite failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async runEnvironmentTests(envConfig) {
    const envResults = {
      environment: envConfig,
      scenarios: {},
      infrastructure: null,
      summary: {}
    };

    try {
      // Analyze infrastructure first
      this.log('info', `Analyzing infrastructure for ${envConfig.name}`);
      envResults.infrastructure = await this.infraAnalyzer.analyze(envConfig);

      // Run each test scenario
      for (const scenarioName of this.config.scenarios) {
        this.log('info', `Running scenario: ${scenarioName} for ${envConfig.name}`);
        envResults.scenarios[scenarioName] = await this.runScenario(scenarioName, envConfig);
      }

      // Generate environment summary
      envResults.summary = this.generateEnvironmentSummary(envResults);

    } catch (error) {
      this.log('error', `Environment tests failed for ${envConfig.name}`, { error: error.message });
      envResults.error = error.message;
    }

    return envResults;
  }

  async runScenario(scenarioName, envConfig) {
    const scenarioResults = {
      scenario: scenarioName,
      iterations: [],
      statistics: {},
      errors: []
    };

    for (let i = 0; i < this.config.iterations; i++) {
      this.log('debug', `Running ${scenarioName} iteration ${i + 1}/${this.config.iterations}`);

      const iterationResult = await this.runIterationWithRetry(scenarioName, envConfig, i + 1);
      scenarioResults.iterations.push(iterationResult);
    }

    // Calculate statistics for this scenario
    scenarioResults.statistics = this.calculateScenarioStatistics(scenarioResults.iterations);

    return scenarioResults;
  }

  async runIterationWithRetry(scenarioName, envConfig, iterationNumber) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.runSingleIteration(scenarioName, envConfig, iterationNumber, attempt);
      } catch (error) {
        lastError = error;
        this.log('warn', `Iteration ${iterationNumber} attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All attempts failed
    return {
      iteration: iterationNumber,
      error: lastError.message,
      failed: true,
      timestamp: new Date().toISOString()
    };
  }

  async runSingleIteration(scenarioName, envConfig, iterationNumber, attempt) {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Performance Test Suite'
      });

      const page = await context.newPage();

      // Load and run the specific scenario
      const scenario = await this.loadScenario(scenarioName);
      const result = await scenario.run(page, envConfig, this.metricsCollector);

      return {
        iteration: iterationNumber,
        attempt,
        timestamp: new Date().toISOString(),
        ...result
      };

    } finally {
      await browser.close();
    }
  }

  async loadScenario(scenarioName) {
    const scenarioPath = path.join(__dirname, 'scenarios', `${scenarioName}.js`);

    if (!fs.existsSync(scenarioPath)) {
      throw new Error(`Scenario not found: ${scenarioPath}`);
    }

    return require(scenarioPath);
  }

  calculateScenarioStatistics(iterations) {
    const validIterations = iterations.filter(iter => !iter.failed && !iter.error);

    if (validIterations.length === 0) {
      return { error: 'No valid iterations', totalRuns: iterations.length };
    }

    const stats = {};

    // Extract all numeric metrics from iterations
    const metrics = this.extractMetrics(validIterations);

    for (const [metricName, values] of Object.entries(metrics)) {
      stats[metricName] = this.calculateStatistics(values);
    }

    stats.validRuns = validIterations.length;
    stats.totalRuns = iterations.length;
    stats.successRate = (validIterations.length / iterations.length) * 100;

    return stats;
  }

  extractMetrics(iterations) {
    const metrics = {};

    iterations.forEach(iteration => {
      this.flattenObject(iteration, metrics, '');
    });

    // Filter to only numeric arrays
    const numericMetrics = {};
    for (const [key, values] of Object.entries(metrics)) {
      if (Array.isArray(values) && values.every(v => typeof v === 'number' && !isNaN(v))) {
        numericMetrics[key] = values;
      }
    }

    return numericMetrics;
  }

  flattenObject(obj, metrics, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'number' && !isNaN(value)) {
        if (!metrics[fullKey]) metrics[fullKey] = [];
        metrics[fullKey].push(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.flattenObject(value, metrics, fullKey);
      }
    }
  }

  calculateStatistics(values) {
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / len;
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / len;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? (stddev / mean) * 100 : 0; // Coefficient of variation

    return {
      count: len,
      min: sorted[0],
      max: sorted[len - 1],
      mean: parseFloat(mean.toFixed(2)),
      median: len % 2 === 0 ? (sorted[len/2 - 1] + sorted[len/2]) / 2 : sorted[Math.floor(len/2)],
      stddev: parseFloat(stddev.toFixed(2)),
      cv: parseFloat(cv.toFixed(2)),
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.90)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  generateEnvironmentSummary(envResults) {
    const summary = {
      totalScenarios: Object.keys(envResults.scenarios).length,
      successfulScenarios: 0,
      totalIterations: 0,
      successfulIterations: 0,
      averageSuccessRate: 0
    };

    let totalSuccessRate = 0;
    let scenarioCount = 0;

    for (const [scenarioName, scenarioResult] of Object.entries(envResults.scenarios)) {
      if (!scenarioResult.error) {
        summary.successfulScenarios++;
        totalSuccessRate += scenarioResult.statistics.successRate || 0;
        scenarioCount++;
      }

      summary.totalIterations += scenarioResult.statistics?.totalRuns || 0;
      summary.successfulIterations += scenarioResult.statistics?.validRuns || 0;
    }

    summary.averageSuccessRate = scenarioCount > 0 ? totalSuccessRate / scenarioCount : 0;

    return summary;
  }

  async generateFinalReport() {
    const timestamp = new Date().toISOString();
    const reportData = {
      metadata: {
        timestamp,
        duration: Date.now() - this.startTime,
        config: this.config,
        version: '1.0.0'
      },
      results: this.results
    };

    // Save detailed results
    const resultsPath = path.join(this.config.outputDir, `results-${timestamp.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(reportData, null, 2));
    this.log('info', `Detailed results saved to ${resultsPath}`);

    // Save summary
    const summary = this.generateSummaryReport(reportData);
    const summaryPath = path.join(this.config.outputDir, `summary-${timestamp.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    this.log('info', `Summary saved to ${summaryPath}`);

    return reportData;
  }

  generateSummaryReport(reportData) {
    const summary = {
      timestamp: reportData.metadata.timestamp,
      duration: reportData.metadata.duration,
      environments: {}
    };

    for (const [envName, envResult] of Object.entries(reportData.results)) {
      summary.environments[envName] = {
        infrastructure: envResult.infrastructure,
        summary: envResult.summary,
        keyMetrics: this.extractKeyMetrics(envResult)
      };
    }

    return summary;
  }

  extractKeyMetrics(envResult) {
    const keyMetrics = {};

    for (const [scenarioName, scenarioResult] of Object.entries(envResult.scenarios)) {
      if (scenarioResult.statistics && !scenarioResult.error) {
        keyMetrics[scenarioName] = {
          successRate: scenarioResult.statistics.successRate,
          // Extract common performance metrics
          ...(scenarioResult.statistics['timing.total'] && {
            totalTime: scenarioResult.statistics['timing.total']
          }),
          ...(scenarioResult.statistics['timing.response'] && {
            responseTime: scenarioResult.statistics['timing.response']
          }),
          ...(scenarioResult.statistics['size.transfer'] && {
            transferSize: scenarioResult.statistics['size.transfer']
          })
        };
      }
    }

    return keyMetrics;
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PerformanceTestSuite;