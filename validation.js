class ValidationSystem {
  constructor() {
    this.thresholds = {
      coefficientOfVariation: 10, // 10% CV threshold for stability
      regressionThreshold: 5, // 5% change detection threshold
      successRateThreshold: 95, // 95% success rate threshold
      maxExecutionTime: 30000, // 30 seconds max execution time
      minIterations: 3, // Minimum iterations for valid statistics
      maxIterations: 100 // Maximum iterations to prevent runaway tests
    };

    this.knownVariations = [
      { type: 'dns', threshold: 100, description: 'DNS lookup variations' },
      { type: 'network', threshold: 20, description: 'Network latency variations' },
      { type: 'server', threshold: 50, description: 'Server response variations' },
      { type: 'cache', threshold: 10, description: 'Cache hit/miss variations' }
    ];
  }

  async validateTestRun(results) {
    const validation = {
      timestamp: new Date().toISOString(),
      passed: true,
      score: 100,
      issues: [],
      warnings: [],
      recommendations: [],
      detailed: {}
    };

    try {
      // Validate test execution
      validation.detailed.execution = this.validateExecution(results);

      // Validate statistical reliability
      validation.detailed.statistics = this.validateStatistics(results);

      // Validate data quality
      validation.detailed.dataQuality = this.validateDataQuality(results);

      // Validate infrastructure consistency
      validation.detailed.infrastructure = this.validateInfrastructure(results);

      // Validate test coverage
      validation.detailed.coverage = this.validateCoverage(results);

      // Aggregate validation results
      this.aggregateValidationResults(validation);

    } catch (error) {
      validation.passed = false;
      validation.error = error.message;
      validation.score = 0;
    }

    return validation;
  }

  validateExecution(results) {
    const execution = {
      passed: true,
      issues: [],
      warnings: [],
      metrics: {}
    };

    if (results.metadata) {
      // Check execution time
      const duration = results.metadata.duration;
      if (duration > this.thresholds.maxExecutionTime * 10) { // 5 minutes total
        execution.issues.push({
          type: 'execution_time',
          severity: 'error',
          message: `Test execution took too long: ${duration}ms`,
          threshold: this.thresholds.maxExecutionTime * 10
        });
        execution.passed = false;
      } else if (duration > this.thresholds.maxExecutionTime * 5) { // 2.5 minutes warning
        execution.warnings.push({
          type: 'execution_time',
          severity: 'warning',
          message: `Test execution time is high: ${duration}ms`,
          threshold: this.thresholds.maxExecutionTime * 5
        });
      }

      execution.metrics.duration = duration;
    }

    // Validate environment execution
    if (results.results) {
      Object.entries(results.results).forEach(([envName, envResult]) => {
        if (envResult.error) {
          execution.issues.push({
            type: 'environment_error',
            severity: 'error',
            environment: envName,
            message: `Environment test failed: ${envResult.error}`
          });
          execution.passed = false;
        }

        // Check scenario execution
        if (envResult.scenarios) {
          Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
            if (scenario.error) {
              execution.issues.push({
                type: 'scenario_error',
                severity: 'error',
                environment: envName,
                scenario: scenarioName,
                message: `Scenario failed: ${scenario.error}`
              });
              execution.passed = false;
            }

            // Check iteration count
            const iterationCount = scenario.iterations?.length || 0;
            if (iterationCount < this.thresholds.minIterations) {
              execution.issues.push({
                type: 'insufficient_iterations',
                severity: 'error',
                environment: envName,
                scenario: scenarioName,
                message: `Too few iterations: ${iterationCount} < ${this.thresholds.minIterations}`
              });
              execution.passed = false;
            } else if (iterationCount > this.thresholds.maxIterations) {
              execution.warnings.push({
                type: 'excessive_iterations',
                severity: 'warning',
                environment: envName,
                scenario: scenarioName,
                message: `Many iterations: ${iterationCount} > ${this.thresholds.maxIterations}`
              });
            }
          });
        }
      });
    }

    return execution;
  }

  validateStatistics(results) {
    const statistics = {
      passed: true,
      issues: [],
      warnings: [],
      metrics: {}
    };

    if (!results.results) return statistics;

    let totalMetrics = 0;
    let unstableMetrics = 0;
    let reliableMetrics = 0;

    Object.entries(results.results).forEach(([envName, envResult]) => {
      if (envResult.scenarios) {
        Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
          if (scenario.statistics) {
            Object.entries(scenario.statistics).forEach(([metricName, stats]) => {
              if (typeof stats === 'object' && stats.mean !== undefined && stats.cv !== undefined) {
                totalMetrics++;
                const cv = stats.cv;

                if (cv > this.thresholds.coefficientOfVariation * 2) { // 20% CV is very unstable
                  statistics.issues.push({
                    type: 'high_variability',
                    severity: 'error',
                    environment: envName,
                    scenario: scenarioName,
                    metric: metricName,
                    message: `High coefficient of variation: ${cv.toFixed(1)}%`,
                    value: cv,
                    threshold: this.thresholds.coefficientOfVariation * 2
                  });
                  unstableMetrics++;
                  statistics.passed = false;
                } else if (cv > this.thresholds.coefficientOfVariation) { // 10% CV is warning
                  statistics.warnings.push({
                    type: 'moderate_variability',
                    severity: 'warning',
                    environment: envName,
                    scenario: scenarioName,
                    metric: metricName,
                    message: `Moderate coefficient of variation: ${cv.toFixed(1)}%`,
                    value: cv,
                    threshold: this.thresholds.coefficientOfVariation
                  });
                } else {
                  reliableMetrics++;
                }

                // Check for insufficient sample size
                if (stats.count < 5) {
                  statistics.warnings.push({
                    type: 'small_sample_size',
                    severity: 'warning',
                    environment: envName,
                    scenario: scenarioName,
                    metric: metricName,
                    message: `Small sample size: ${stats.count}`,
                    value: stats.count
                  });
                }
              }
            });

            // Check success rate
            const successRate = scenario.statistics.successRate;
            if (successRate !== undefined && successRate < this.thresholds.successRateThreshold) {
              statistics.issues.push({
                type: 'low_success_rate',
                severity: successRate < 80 ? 'error' : 'warning',
                environment: envName,
                scenario: scenarioName,
                message: `Low success rate: ${successRate.toFixed(1)}%`,
                value: successRate,
                threshold: this.thresholds.successRateThreshold
              });

              if (successRate < 80) {
                statistics.passed = false;
              }
            }
          }
        });
      }
    });

    statistics.metrics = {
      total: totalMetrics,
      reliable: reliableMetrics,
      unstable: unstableMetrics,
      reliabilityRate: totalMetrics > 0 ? (reliableMetrics / totalMetrics) * 100 : 0
    };

    return statistics;
  }

  validateDataQuality(results) {
    const dataQuality = {
      passed: true,
      issues: [],
      warnings: [],
      metrics: {}
    };

    if (!results.results) return dataQuality;

    let totalIterations = 0;
    let validIterations = 0;
    let nullMetrics = 0;
    let outliers = 0;

    Object.entries(results.results).forEach(([envName, envResult]) => {
      if (envResult.scenarios) {
        Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
          if (scenario.iterations) {
            scenario.iterations.forEach((iteration, index) => {
              totalIterations++;

              if (iteration.error || iteration.failed) {
                dataQuality.warnings.push({
                  type: 'failed_iteration',
                  severity: 'warning',
                  environment: envName,
                  scenario: scenarioName,
                  iteration: index + 1,
                  message: iteration.error || 'Iteration failed'
                });
              } else {
                validIterations++;

                // Check for null/missing metrics
                const metrics = this.extractIterationMetrics(iteration);
                metrics.forEach(metric => {
                  if (metric.value === null || metric.value === undefined) {
                    nullMetrics++;
                    dataQuality.warnings.push({
                      type: 'null_metric',
                      severity: 'warning',
                      environment: envName,
                      scenario: scenarioName,
                      iteration: index + 1,
                      metric: metric.name,
                      message: 'Null or undefined metric value'
                    });
                  }
                });

                // Check for outliers (basic check)
                if (this.isOutlier(iteration, scenario.statistics)) {
                  outliers++;
                  dataQuality.warnings.push({
                    type: 'outlier',
                    severity: 'warning',
                    environment: envName,
                    scenario: scenarioName,
                    iteration: index + 1,
                    message: 'Potential outlier detected'
                  });
                }
              }
            });
          }
        });
      }
    });

    const validDataRate = totalIterations > 0 ? (validIterations / totalIterations) * 100 : 0;

    if (validDataRate < 80) {
      dataQuality.issues.push({
        type: 'low_data_quality',
        severity: 'error',
        message: `Low valid data rate: ${validDataRate.toFixed(1)}%`,
        value: validDataRate,
        threshold: 80
      });
      dataQuality.passed = false;
    } else if (validDataRate < 90) {
      dataQuality.warnings.push({
        type: 'moderate_data_quality',
        severity: 'warning',
        message: `Moderate valid data rate: ${validDataRate.toFixed(1)}%`,
        value: validDataRate,
        threshold: 90
      });
    }

    dataQuality.metrics = {
      totalIterations,
      validIterations,
      validDataRate,
      nullMetrics,
      outliers
    };

    return dataQuality;
  }

  validateInfrastructure(results) {
    const infrastructure = {
      passed: true,
      issues: [],
      warnings: [],
      metrics: {}
    };

    if (!results.results) return infrastructure;

    const environments = Object.keys(results.results);
    const infraConfigs = {};

    // Collect infrastructure configurations
    environments.forEach(envName => {
      const envResult = results.results[envName];
      if (envResult.infrastructure) {
        infraConfigs[envName] = envResult.infrastructure;
      }
    });

    // Check for infrastructure inconsistencies
    if (environments.length > 1) {
      this.detectInfrastructureInconsistencies(infraConfigs, infrastructure);
    }

    // Validate individual infrastructure elements
    Object.entries(infraConfigs).forEach(([envName, infra]) => {
      this.validateEnvironmentInfrastructure(envName, infra, infrastructure);
    });

    return infrastructure;
  }

  detectInfrastructureInconsistencies(infraConfigs, infrastructure) {
    const envNames = Object.keys(infraConfigs);

    // Compare CDN configurations
    const cdnProviders = envNames.map(env => infraConfigs[env].cdn?.provider).filter(p => p);
    if (new Set(cdnProviders).size > 1) {
      infrastructure.warnings.push({
        type: 'cdn_inconsistency',
        severity: 'warning',
        message: `Different CDN providers detected: ${cdnProviders.join(', ')}`,
        environments: envNames
      });
    }

    // Compare compression settings
    const compressionAlgorithms = envNames.map(env => infraConfigs[env].compression?.algorithm).filter(a => a);
    if (new Set(compressionAlgorithms).size > 1) {
      infrastructure.warnings.push({
        type: 'compression_inconsistency',
        severity: 'warning',
        message: `Different compression algorithms: ${compressionAlgorithms.join(', ')}`,
        environments: envNames
      });
    }

    // Compare HTTP protocol support
    const http2Support = envNames.map(env => infraConfigs[env].protocols?.http2Support);
    if (new Set(http2Support).size > 1) {
      infrastructure.warnings.push({
        type: 'protocol_inconsistency',
        severity: 'warning',
        message: 'Inconsistent HTTP/2 support across environments',
        environments: envNames
      });
    }
  }

  validateEnvironmentInfrastructure(envName, infra, infrastructure) {
    // Check for missing CDN
    if (!infra.cdn?.detected) {
      infrastructure.warnings.push({
        type: 'no_cdn',
        severity: 'warning',
        environment: envName,
        message: 'No CDN detected - consider implementing CDN for better performance'
      });
    }

    // Check compression
    if (!infra.compression?.enabled) {
      infrastructure.issues.push({
        type: 'no_compression',
        severity: 'error',
        environment: envName,
        message: 'No compression detected - enable gzip/brotli compression'
      });
      infrastructure.passed = false;
    } else if (infra.compression.effectiveness === 'poor') {
      infrastructure.warnings.push({
        type: 'poor_compression',
        severity: 'warning',
        environment: envName,
        message: 'Poor compression effectiveness detected'
      });
    }

    // Check HTTP/2 support
    if (!infra.protocols?.http2Support) {
      infrastructure.warnings.push({
        type: 'no_http2',
        severity: 'warning',
        environment: envName,
        message: 'HTTP/2 not detected - consider upgrading for better performance'
      });
    }

    // Check security score
    if (infra.security?.score !== undefined && infra.security.score < 70) {
      infrastructure.issues.push({
        type: 'low_security_score',
        severity: 'error',
        environment: envName,
        message: `Low security score: ${infra.security.score}/100`,
        value: infra.security.score,
        threshold: 70
      });
      infrastructure.passed = false;
    }
  }

  validateCoverage(results) {
    const coverage = {
      passed: true,
      issues: [],
      warnings: [],
      metrics: {}
    };

    if (!results.results) return coverage;

    const expectedScenarios = ['cold-start', 'warm-start', 'critical-path', 'api-endpoints'];
    const foundScenarios = new Set();

    Object.values(results.results).forEach(envResult => {
      if (envResult.scenarios) {
        Object.keys(envResult.scenarios).forEach(scenario => {
          foundScenarios.add(scenario);
        });
      }
    });

    // Check for missing scenarios
    const missingScenarios = expectedScenarios.filter(scenario => !foundScenarios.has(scenario));
    if (missingScenarios.length > 0) {
      coverage.warnings.push({
        type: 'missing_scenarios',
        severity: 'warning',
        message: `Missing test scenarios: ${missingScenarios.join(', ')}`,
        missing: missingScenarios
      });
    }

    coverage.metrics = {
      expectedScenarios: expectedScenarios.length,
      foundScenarios: foundScenarios.size,
      coverageRate: (foundScenarios.size / expectedScenarios.length) * 100,
      missingScenarios: missingScenarios.length
    };

    return coverage;
  }

  extractIterationMetrics(iteration) {
    const metrics = [];

    const extractFromObject = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'number') {
          metrics.push({ name: fullKey, value });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractFromObject(value, fullKey);
        }
      });
    };

    extractFromObject(iteration);
    return metrics;
  }

  isOutlier(iteration, statistics) {
    // Simple outlier detection using timing metrics
    if (!statistics || !iteration.phases) return false;

    // Check if any timing metric is beyond 3 standard deviations
    Object.entries(statistics).forEach(([metric, stats]) => {
      if (typeof stats === 'object' && stats.mean !== undefined && stats.stddev !== undefined) {
        const metricValue = this.extractMetricValue(iteration, metric);
        if (metricValue !== null) {
          const zScore = Math.abs((metricValue - stats.mean) / stats.stddev);
          if (zScore > 3) {
            return true;
          }
        }
      }
    });

    return false;
  }

  extractMetricValue(iteration, metricPath) {
    const parts = metricPath.split('.');
    let current = iteration;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return typeof current === 'number' ? current : null;
  }

  aggregateValidationResults(validation) {
    let score = 100;
    let totalIssues = 0;
    let totalWarnings = 0;

    // Collect all issues and warnings
    Object.values(validation.detailed).forEach(section => {
      if (section.issues) {
        totalIssues += section.issues.length;
        validation.issues.push(...section.issues);
      }
      if (section.warnings) {
        totalWarnings += section.warnings.length;
        validation.warnings.push(...section.warnings);
      }
      if (!section.passed) {
        validation.passed = false;
      }
    });

    // Calculate score based on issues
    score -= totalIssues * 10; // 10 points per error
    score -= totalWarnings * 5; // 5 points per warning
    score = Math.max(0, score);

    validation.score = score;

    // Generate recommendations
    validation.recommendations = this.generateValidationRecommendations(validation);
  }

  generateValidationRecommendations(validation) {
    const recommendations = [];

    // Based on execution issues
    const executionIssues = validation.issues.filter(issue => issue.type.includes('execution'));
    if (executionIssues.length > 0) {
      recommendations.push({
        type: 'execution',
        priority: 'high',
        message: 'Address test execution failures',
        actions: [
          'Check browser and network stability',
          'Verify target URLs are accessible',
          'Review test timeouts and retry logic'
        ]
      });
    }

    // Based on statistical issues
    const variabilityIssues = validation.issues.filter(issue => issue.type.includes('variability'));
    if (variabilityIssues.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'medium',
        message: 'Improve test measurement reliability',
        actions: [
          'Increase number of test iterations',
          'Ensure consistent test environment',
          'Check for external factors affecting performance'
        ]
      });
    }

    // Based on data quality issues
    const dataQualityIssues = validation.issues.filter(issue => issue.type.includes('data'));
    if (dataQualityIssues.length > 0) {
      recommendations.push({
        type: 'data-quality',
        priority: 'medium',
        message: 'Improve data collection quality',
        actions: [
          'Review metrics collection implementation',
          'Handle edge cases in data collection',
          'Implement better error handling'
        ]
      });
    }

    // Based on infrastructure issues
    const infraIssues = validation.issues.filter(issue => issue.type.includes('compression') || issue.type.includes('security'));
    if (infraIssues.length > 0) {
      recommendations.push({
        type: 'infrastructure',
        priority: 'high',
        message: 'Address infrastructure configuration issues',
        actions: [
          'Enable compression (gzip/brotli)',
          'Implement security headers',
          'Consider CDN implementation'
        ]
      });
    }

    return recommendations;
  }

  // Method to create a known good baseline for comparison
  createBaseline(results, baselineName = 'baseline') {
    const baseline = {
      name: baselineName,
      timestamp: new Date().toISOString(),
      validation: this.validateTestRun(results),
      statistics: this.extractBaselineStatistics(results),
      infrastructure: this.extractBaselineInfrastructure(results)
    };

    return baseline;
  }

  extractBaselineStatistics(results) {
    const statistics = {};

    Object.entries(results.results).forEach(([envName, envResult]) => {
      if (envResult.scenarios) {
        statistics[envName] = {};
        Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
          if (scenario.statistics) {
            statistics[envName][scenarioName] = scenario.statistics;
          }
        });
      }
    });

    return statistics;
  }

  extractBaselineInfrastructure(results) {
    const infrastructure = {};

    Object.entries(results.results).forEach(([envName, envResult]) => {
      if (envResult.infrastructure) {
        infrastructure[envName] = envResult.infrastructure;
      }
    });

    return infrastructure;
  }

  // Method to validate against a known baseline
  validateAgainstBaseline(currentResults, baseline) {
    const validation = {
      passed: true,
      regressions: [],
      improvements: [],
      changes: [],
      score: 100
    };

    if (!baseline.statistics) return validation;

    const PerformanceComparisonEngine = require('./compare.js');
    const comparisonEngine = new PerformanceComparisonEngine();

    Object.entries(currentResults.results).forEach(([envName, envResult]) => {
      if (baseline.statistics[envName] && envResult.scenarios) {
        Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
          if (baseline.statistics[envName][scenarioName] && scenario.statistics) {
            const baselineStats = baseline.statistics[envName][scenarioName];
            const currentStats = scenario.statistics;

            // Compare key metrics
            Object.entries(currentStats).forEach(([metric, stats]) => {
              if (typeof stats === 'object' && stats.mean !== undefined &&
                  baselineStats[metric] && typeof baselineStats[metric] === 'object' &&
                  baselineStats[metric].mean !== undefined) {

                const comparison = comparisonEngine.performStatisticalTest(baselineStats[metric], stats);

                if (comparison.significance.isSignificant) {
                  const change = {
                    environment: envName,
                    scenario: scenarioName,
                    metric,
                    changePercent: comparison.change.percent,
                    significance: comparison.significance
                  };

                  if (comparison.change.percent > 5) { // 5% regression threshold
                    validation.regressions.push(change);
                    validation.passed = false;
                    validation.score -= 15;
                  } else if (comparison.change.percent < -5) { // 5% improvement
                    validation.improvements.push(change);
                    validation.score += 5;
                  } else {
                    validation.changes.push(change);
                  }
                }
              }
            });
          }
        });
      }
    });

    validation.score = Math.max(0, Math.min(100, validation.score));

    return validation;
  }
}

module.exports = ValidationSystem;