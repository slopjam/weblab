class PerformanceComparisonEngine {
  constructor() {
    this.confidenceLevel = 0.95;
    this.significanceThreshold = 0.05;
    this.regressionThreshold = 0.05; // 5% change threshold
  }

  compareEnvironments(baseline, comparison, options = {}) {
    const comparisonResult = {
      timestamp: new Date().toISOString(),
      baseline: baseline.environment?.name || 'baseline',
      comparison: comparison.environment?.name || 'comparison',
      options,
      analysis: {},
      summary: {},
      recommendations: []
    };

    try {
      // Compare infrastructure
      if (baseline.infrastructure && comparison.infrastructure) {
        comparisonResult.analysis.infrastructure = this.compareInfrastructure(baseline.infrastructure, comparison.infrastructure);
      }

      // Compare scenarios
      if (baseline.scenarios && comparison.scenarios) {
        comparisonResult.analysis.scenarios = this.compareScenarios(baseline.scenarios, comparison.scenarios);
      }

      // Generate overall summary
      comparisonResult.summary = this.generateSummary(comparisonResult.analysis);

      // Generate recommendations
      comparisonResult.recommendations = this.generateRecommendations(comparisonResult);

    } catch (error) {
      comparisonResult.error = error.message;
    }

    return comparisonResult;
  }

  compareInfrastructure(baseline, comparison) {
    const infraComparison = {
      cdn: this.compareCdn(baseline.cdn, comparison.cdn),
      compression: this.compareCompression(baseline.compression, comparison.compression),
      protocols: this.compareProtocols(baseline.protocols, comparison.protocols),
      security: this.compareSecurity(baseline.security, comparison.security),
      caching: this.compareCaching(baseline.caching, comparison.caching)
    };

    return infraComparison;
  }

  compareCdn(baseline, comparison) {
    if (!baseline || !comparison) return { error: 'Missing CDN data' };

    return {
      providerChange: baseline.provider !== comparison.provider,
      baseline: {
        provider: baseline.provider,
        detected: baseline.detected,
        popLocation: baseline.popLocation
      },
      comparison: {
        provider: comparison.provider,
        detected: comparison.detected,
        popLocation: comparison.popLocation
      },
      impact: this.assessCdnImpact(baseline, comparison)
    };
  }

  assessCdnImpact(baseline, comparison) {
    let impact = 'neutral';

    if (!baseline.detected && comparison.detected) {
      impact = 'positive';
    } else if (baseline.detected && !comparison.detected) {
      impact = 'negative';
    } else if (baseline.provider !== comparison.provider) {
      impact = 'change';
    }

    return impact;
  }

  compareCompression(baseline, comparison) {
    if (!baseline || !comparison) return { error: 'Missing compression data' };

    const improvement = baseline.ratio > 0 && comparison.ratio > 0 ?
      ((baseline.ratio - comparison.ratio) / baseline.ratio) * 100 : 0;

    return {
      algorithmChange: baseline.algorithm !== comparison.algorithm,
      compressionImprovement: improvement,
      ratioChange: {
        baseline: baseline.ratio,
        comparison: comparison.ratio,
        improvement: improvement > 0
      },
      impact: this.assessCompressionImpact(improvement)
    };
  }

  assessCompressionImpact(improvement) {
    if (improvement > 10) return 'significant-positive';
    if (improvement > 5) return 'positive';
    if (improvement < -10) return 'significant-negative';
    if (improvement < -5) return 'negative';
    return 'neutral';
  }

  compareProtocols(baseline, comparison) {
    if (!baseline || !comparison) return { error: 'Missing protocol data' };

    return {
      pageProtocolChange: baseline.page !== comparison.page,
      http2Change: baseline.http2Support !== comparison.http2Support,
      http3Change: baseline.http3Support !== comparison.http3Support,
      protocolDistribution: this.compareProtocolDistribution(
        baseline.summary?.protocolDistribution,
        comparison.summary?.protocolDistribution
      ),
      impact: this.assessProtocolImpact(baseline, comparison)
    };
  }

  compareProtocolDistribution(baseline, comparison) {
    if (!baseline || !comparison) return null;

    const changes = {};
    const allProtocols = new Set([...Object.keys(baseline), ...Object.keys(comparison)]);

    allProtocols.forEach(protocol => {
      const baselinePercent = baseline[protocol]?.percentage || 0;
      const comparisonPercent = comparison[protocol]?.percentage || 0;
      const change = comparisonPercent - baselinePercent;

      changes[protocol] = {
        baseline: baselinePercent,
        comparison: comparisonPercent,
        change: parseFloat(change.toFixed(2))
      };
    });

    return changes;
  }

  assessProtocolImpact(baseline, comparison) {
    if (!baseline.http2Support && comparison.http2Support) return 'positive';
    if (baseline.http2Support && !comparison.http2Support) return 'negative';
    if (!baseline.http3Support && comparison.http3Support) return 'positive';
    return 'neutral';
  }

  compareSecurity(baseline, comparison) {
    if (!baseline || !comparison) return { error: 'Missing security data' };

    const scoreChange = comparison.score - baseline.score;

    return {
      scoreImprovement: scoreChange,
      headerChanges: this.compareSecurityHeaders(baseline.headers, comparison.headers),
      impact: scoreChange > 10 ? 'positive' : scoreChange < -10 ? 'negative' : 'neutral'
    };
  }

  compareSecurityHeaders(baseline, comparison) {
    const changes = {};
    const allHeaders = new Set([...Object.keys(baseline), ...Object.keys(comparison)]);

    allHeaders.forEach(header => {
      const baselineValue = baseline[header];
      const comparisonValue = comparison[header];

      if (baselineValue !== comparisonValue) {
        changes[header] = {
          baseline: baselineValue,
          comparison: comparisonValue,
          status: !baselineValue && comparisonValue ? 'added' :
                  baselineValue && !comparisonValue ? 'removed' : 'changed'
        };
      }
    });

    return changes;
  }

  compareCaching(baseline, comparison) {
    if (!baseline || !comparison) return { error: 'Missing caching data' };

    const effectivenessChange = comparison.effectiveness - baseline.effectiveness;

    return {
      strategyChange: baseline.strategy !== comparison.strategy,
      effectivenessChange,
      headerChanges: this.compareCacheHeaders(baseline.headers, comparison.headers),
      impact: effectivenessChange > 10 ? 'positive' : effectivenessChange < -10 ? 'negative' : 'neutral'
    };
  }

  compareCacheHeaders(baseline, comparison) {
    if (!baseline || !comparison) return null;

    const changes = {};
    const allHeaders = new Set([...Object.keys(baseline), ...Object.keys(comparison)]);

    allHeaders.forEach(header => {
      if (baseline[header] !== comparison[header]) {
        changes[header] = {
          baseline: baseline[header],
          comparison: comparison[header]
        };
      }
    });

    return changes;
  }

  compareScenarios(baseline, comparison) {
    const scenarioComparisons = {};

    // Get all scenario names from both environments
    const allScenarios = new Set([
      ...Object.keys(baseline),
      ...Object.keys(comparison)
    ]);

    allScenarios.forEach(scenarioName => {
      const baselineScenario = baseline[scenarioName];
      const comparisonScenario = comparison[scenarioName];

      if (baselineScenario && comparisonScenario) {
        scenarioComparisons[scenarioName] = this.compareScenario(baselineScenario, comparisonScenario);
      }
    });

    return scenarioComparisons;
  }

  compareScenario(baseline, comparison) {
    const scenarioComparison = {
      scenario: baseline.scenario,
      statistical: {},
      performance: {},
      reliability: {}
    };

    // Compare statistics for each metric
    if (baseline.statistics && comparison.statistics) {
      scenarioComparison.statistical = this.compareStatistics(baseline.statistics, comparison.statistics);
    }

    // Compare performance improvements/regressions
    scenarioComparison.performance = this.analyzePerformanceChanges(baseline, comparison);

    // Compare reliability
    scenarioComparison.reliability = this.compareReliability(baseline, comparison);

    return scenarioComparison;
  }

  compareStatistics(baseline, comparison) {
    const statisticalComparison = {};

    // Get all metrics that exist in both datasets
    const baselineMetrics = Object.keys(baseline).filter(key => typeof baseline[key] === 'object' && baseline[key]?.mean !== undefined);
    const comparisonMetrics = Object.keys(comparison).filter(key => typeof comparison[key] === 'object' && comparison[key]?.mean !== undefined);
    const commonMetrics = baselineMetrics.filter(metric => comparisonMetrics.includes(metric));

    commonMetrics.forEach(metric => {
      const baselineStats = baseline[metric];
      const comparisonStats = comparison[metric];

      if (baselineStats && comparisonStats) {
        statisticalComparison[metric] = this.performStatisticalTest(baselineStats, comparisonStats);
      }
    });

    return statisticalComparison;
  }

  performStatisticalTest(baseline, comparison) {
    const result = {
      baseline: {
        mean: baseline.mean,
        stddev: baseline.stddev,
        count: baseline.count,
        cv: baseline.cv
      },
      comparison: {
        mean: comparison.mean,
        stddev: comparison.stddev,
        count: comparison.count,
        cv: comparison.cv
      },
      change: {},
      significance: {},
      interpretation: {}
    };

    // Calculate changes
    const meanChange = comparison.mean - baseline.mean;
    const meanChangePercent = baseline.mean > 0 ? (meanChange / baseline.mean) * 100 : 0;

    result.change = {
      absolute: parseFloat(meanChange.toFixed(2)),
      percent: parseFloat(meanChangePercent.toFixed(2)),
      direction: meanChange > 0 ? 'increase' : meanChange < 0 ? 'decrease' : 'no-change'
    };

    // Perform t-test (Welch's t-test for unequal variances)
    const tTest = this.welchTTest(baseline, comparison);
    result.significance = {
      tStatistic: tTest.tStatistic,
      pValue: tTest.pValue,
      isSignificant: tTest.pValue < this.significanceThreshold,
      confidenceLevel: this.confidenceLevel
    };

    // Interpret results
    result.interpretation = this.interpretStatisticalResult(result);

    return result;
  }

  welchTTest(baseline, comparison) {
    // Welch's t-test for unequal variances
    const n1 = baseline.count;
    const n2 = comparison.count;
    const mean1 = baseline.mean;
    const mean2 = comparison.mean;
    const var1 = baseline.stddev * baseline.stddev;
    const var2 = comparison.stddev * comparison.stddev;

    // Calculate t-statistic
    const tStatistic = (mean1 - mean2) / Math.sqrt((var1 / n1) + (var2 / n2));

    // Calculate degrees of freedom (Welch-Satterthwaite equation)
    const numerator = Math.pow((var1 / n1) + (var2 / n2), 2);
    const denominator = (Math.pow(var1 / n1, 2) / (n1 - 1)) + (Math.pow(var2 / n2, 2) / (n2 - 1));
    const df = numerator / denominator;

    // Approximate p-value using t-distribution
    const pValue = this.calculatePValue(Math.abs(tStatistic), df);

    return {
      tStatistic: parseFloat(tStatistic.toFixed(4)),
      degreesOfFreedom: parseFloat(df.toFixed(2)),
      pValue: parseFloat(pValue.toFixed(4))
    };
  }

  calculatePValue(tStat, df) {
    // Simplified p-value calculation using approximation
    // For a more accurate calculation, you would use a proper t-distribution CDF

    if (df <= 0) return 1;

    // Rough approximation for two-tailed test
    if (tStat < 1) return 0.5;
    if (tStat < 2) return 0.1;
    if (tStat < 3) return 0.01;
    if (tStat < 4) return 0.001;
    return 0.0001;
  }

  interpretStatisticalResult(result) {
    const interpretation = {
      summary: '',
      significance: '',
      magnitude: '',
      recommendation: ''
    };

    const change = result.change;
    const significance = result.significance;

    // Determine significance
    if (significance.isSignificant) {
      interpretation.significance = 'statistically significant';
    } else {
      interpretation.significance = 'not statistically significant';
    }

    // Determine magnitude
    const absPercent = Math.abs(change.percent);
    if (absPercent < 5) interpretation.magnitude = 'small';
    else if (absPercent < 15) interpretation.magnitude = 'medium';
    else interpretation.magnitude = 'large';

    // Determine if this is a regression or improvement
    const isRegression = change.percent > this.regressionThreshold * 100; // 5% worse
    const isImprovement = change.percent < -this.regressionThreshold * 100; // 5% better

    // Generate summary
    if (significance.isSignificant) {
      if (isRegression) {
        interpretation.summary = `Significant performance regression detected (${change.percent}% worse)`;
        interpretation.recommendation = 'Investigate and address performance regression';
      } else if (isImprovement) {
        interpretation.summary = `Significant performance improvement detected (${Math.abs(change.percent)}% better)`;
        interpretation.recommendation = 'Performance improvement confirmed';
      } else {
        interpretation.summary = `Statistically significant change but within acceptable range (${change.percent}%)`;
        interpretation.recommendation = 'Monitor for consistency';
      }
    } else {
      interpretation.summary = `No significant performance change detected (${change.percent}%)`;
      interpretation.recommendation = 'Performance appears stable';
    }

    return interpretation;
  }

  analyzePerformanceChanges(baseline, comparison) {
    const changes = {
      timing: {},
      size: {},
      reliability: {},
      overall: {}
    };

    // Extract timing changes from scenarios
    if (baseline.iterations && comparison.iterations) {
      changes.timing = this.extractTimingChanges(baseline.iterations, comparison.iterations);
    }

    // Extract size changes
    if (baseline.iterations && comparison.iterations) {
      changes.size = this.extractSizeChanges(baseline.iterations, comparison.iterations);
    }

    return changes;
  }

  extractTimingChanges(baselineIterations, comparisonIterations) {
    // Extract common timing metrics from iterations
    const timingMetrics = {};

    // Helper function to extract timing data from iterations
    const extractTimings = (iterations) => {
      const timings = {};
      iterations.forEach(iteration => {
        this.flattenObject(iteration, timings, '');
      });
      return timings;
    };

    const baselineTimings = extractTimings(baselineIterations);
    const comparisonTimings = extractTimings(comparisonIterations);

    // Find common timing metrics
    const commonTimings = Object.keys(baselineTimings).filter(key =>
      comparisonTimings[key] &&
      Array.isArray(baselineTimings[key]) &&
      baselineTimings[key].every(v => typeof v === 'number')
    );

    commonTimings.forEach(timing => {
      const baselineValues = baselineTimings[timing];
      const comparisonValues = comparisonTimings[timing];

      if (baselineValues.length > 0 && comparisonValues.length > 0) {
        const baselineMean = baselineValues.reduce((a, b) => a + b) / baselineValues.length;
        const comparisonMean = comparisonValues.reduce((a, b) => a + b) / comparisonValues.length;
        const change = ((comparisonMean - baselineMean) / baselineMean) * 100;

        timingMetrics[timing] = {
          baseline: baselineMean,
          comparison: comparisonMean,
          changePercent: parseFloat(change.toFixed(2))
        };
      }
    });

    return timingMetrics;
  }

  extractSizeChanges(baselineIterations, comparisonIterations) {
    // Similar to timing changes but for size metrics
    const sizeMetrics = {};

    // This would extract size-related metrics like transferSize, encodedBodySize, etc.
    // Implementation similar to extractTimingChanges but focused on size metrics

    return sizeMetrics;
  }

  flattenObject(obj, result, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'number' && !isNaN(value)) {
        if (!result[fullKey]) result[fullKey] = [];
        result[fullKey].push(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.flattenObject(value, result, fullKey);
      }
    }
  }

  compareReliability(baseline, comparison) {
    const reliability = {};

    if (baseline.statistics && comparison.statistics) {
      reliability.successRate = {
        baseline: baseline.statistics.successRate || 0,
        comparison: comparison.statistics.successRate || 0,
        change: (comparison.statistics.successRate || 0) - (baseline.statistics.successRate || 0)
      };

      reliability.consistency = {
        baseline: this.assessConsistency(baseline.statistics),
        comparison: this.assessConsistency(comparison.statistics)
      };
    }

    return reliability;
  }

  assessConsistency(statistics) {
    // Assess consistency based on coefficient of variation
    const metrics = Object.values(statistics).filter(stat =>
      typeof stat === 'object' && stat.cv !== undefined
    );

    if (metrics.length === 0) return 'unknown';

    const avgCV = metrics.reduce((sum, stat) => sum + stat.cv, 0) / metrics.length;

    if (avgCV < 10) return 'excellent';
    if (avgCV < 20) return 'good';
    if (avgCV < 30) return 'fair';
    return 'poor';
  }

  generateSummary(analysis) {
    const summary = {
      overallImpact: 'neutral',
      significantChanges: [],
      regressions: [],
      improvements: [],
      stability: 'stable'
    };

    // Analyze infrastructure impact
    if (analysis.infrastructure) {
      Object.entries(analysis.infrastructure).forEach(([category, categoryAnalysis]) => {
        if (categoryAnalysis.impact === 'positive' || categoryAnalysis.impact === 'significant-positive') {
          summary.improvements.push(`${category}: ${categoryAnalysis.impact}`);
        } else if (categoryAnalysis.impact === 'negative' || categoryAnalysis.impact === 'significant-negative') {
          summary.regressions.push(`${category}: ${categoryAnalysis.impact}`);
        }
      });
    }

    // Analyze scenario impact
    if (analysis.scenarios) {
      Object.entries(analysis.scenarios).forEach(([scenarioName, scenarioAnalysis]) => {
        if (scenarioAnalysis.statistical) {
          Object.entries(scenarioAnalysis.statistical).forEach(([metric, result]) => {
            if (result.significance?.isSignificant) {
              summary.significantChanges.push(`${scenarioName}.${metric}: ${result.change.percent}%`);

              if (Math.abs(result.change.percent) > 5) {
                if (result.change.percent > 0) {
                  summary.regressions.push(`${scenarioName}.${metric}: +${result.change.percent}%`);
                } else {
                  summary.improvements.push(`${scenarioName}.${metric}: ${result.change.percent}%`);
                }
              }
            }
          });
        }
      });
    }

    // Determine overall impact
    if (summary.regressions.length > summary.improvements.length) {
      summary.overallImpact = 'negative';
    } else if (summary.improvements.length > summary.regressions.length) {
      summary.overallImpact = 'positive';
    }

    // Determine stability
    if (summary.significantChanges.length > 5) {
      summary.stability = 'unstable';
    } else if (summary.significantChanges.length > 2) {
      summary.stability = 'changing';
    }

    return summary;
  }

  generateRecommendations(comparisonResult) {
    const recommendations = [];

    // Infrastructure recommendations
    if (comparisonResult.analysis.infrastructure) {
      const infra = comparisonResult.analysis.infrastructure;

      // CDN recommendations
      if (infra.cdn?.impact === 'negative') {
        recommendations.push({
          type: 'infrastructure',
          category: 'cdn',
          priority: 'high',
          message: 'CDN configuration change has negative impact',
          action: 'Review CDN settings and consider reverting changes'
        });
      }

      // Compression recommendations
      if (infra.compression?.impact === 'negative') {
        recommendations.push({
          type: 'infrastructure',
          category: 'compression',
          priority: 'medium',
          message: 'Compression effectiveness decreased',
          action: 'Review compression settings and algorithms'
        });
      }
    }

    // Performance regression recommendations
    if (comparisonResult.summary.regressions.length > 0) {
      recommendations.push({
        type: 'performance',
        category: 'regression',
        priority: 'high',
        message: `Performance regressions detected: ${comparisonResult.summary.regressions.length} metrics affected`,
        action: 'Investigate and address performance regressions',
        details: comparisonResult.summary.regressions
      });
    }

    // Stability recommendations
    if (comparisonResult.summary.stability === 'unstable') {
      recommendations.push({
        type: 'reliability',
        category: 'stability',
        priority: 'medium',
        message: 'Performance appears unstable with many significant changes',
        action: 'Review testing methodology and environment consistency'
      });
    }

    return recommendations;
  }

  // Utility method to generate performance budget validation
  validatePerformanceBudget(results, budget) {
    const validation = {
      passed: true,
      violations: [],
      warnings: []
    };

    if (budget && results.scenarios) {
      Object.entries(budget).forEach(([metric, limit]) => {
        Object.entries(results.scenarios).forEach(([scenarioName, scenario]) => {
          if (scenario.statistics && scenario.statistics[metric]) {
            const value = scenario.statistics[metric].mean;
            if (value > limit) {
              validation.passed = false;
              validation.violations.push({
                scenario: scenarioName,
                metric,
                value,
                limit,
                exceedBy: value - limit
              });
            } else if (value > limit * 0.9) {
              validation.warnings.push({
                scenario: scenarioName,
                metric,
                value,
                limit,
                warningThreshold: limit * 0.9
              });
            }
          }
        });
      });
    }

    return validation;
  }
}

module.exports = PerformanceComparisonEngine;