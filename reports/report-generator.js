const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  generateAllReports(results, outputDir = './reports', options = {}) {
    const reportFiles = {};

    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Generate console report (immediate output)
      if (options.console !== false) {
        this.generateConsoleReport(results);
      }

      // Generate markdown report
      if (options.markdown !== false) {
        const markdownPath = path.join(outputDir, `performance-report-${timestamp}.md`);
        fs.writeFileSync(markdownPath, this.generateMarkdownReport(results));
        reportFiles.markdown = markdownPath;
      }

      // Generate HTML report
      if (options.html !== false) {
        const htmlPath = path.join(outputDir, `performance-report-${timestamp}.html`);
        fs.writeFileSync(htmlPath, this.generateHtmlReport(results));
        reportFiles.html = htmlPath;
      }

      // Generate CSV report
      if (options.csv !== false) {
        const csvPath = path.join(outputDir, `performance-data-${timestamp}.csv`);
        fs.writeFileSync(csvPath, this.generateCsvReport(results));
        reportFiles.csv = csvPath;
      }

      // Generate JSON summary
      if (options.summary !== false) {
        const summaryPath = path.join(outputDir, `performance-summary-${timestamp}.json`);
        fs.writeFileSync(summaryPath, JSON.stringify(this.generateSummary(results), null, 2));
        reportFiles.summary = summaryPath;
      }

      return reportFiles;

    } catch (error) {
      console.error('Error generating reports:', error.message);
      throw error;
    }
  }

  generateConsoleReport(results) {
    const c = this.colors;

    console.log(`\n${c.bright}${c.cyan}════════════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bright}${c.cyan}                           PERFORMANCE TEST RESULTS                             ${c.reset}`);
    console.log(`${c.bright}${c.cyan}════════════════════════════════════════════════════════════════════════════════${c.reset}\n`);

    // Test metadata
    if (results.metadata) {
      console.log(`${c.bright}Test Run Information:${c.reset}`);
      console.log(`  Timestamp: ${results.metadata.timestamp}`);
      console.log(`  Duration: ${results.metadata.duration}ms`);
      console.log(`  Environments: ${Object.keys(results.results).join(', ')}\n`);
    }

    // Environment results
    Object.entries(results.results).forEach(([envName, envResult]) => {
      this.printEnvironmentResults(envName, envResult);
    });

    // Generate comparison if multiple environments
    const envNames = Object.keys(results.results);
    if (envNames.length === 2) {
      this.printComparison(results.results[envNames[0]], results.results[envNames[1]], envNames);
    }

    console.log(`${c.bright}${c.cyan}════════════════════════════════════════════════════════════════════════════════${c.reset}\n`);
  }

  printEnvironmentResults(envName, envResult) {
    const c = this.colors;

    console.log(`${c.bright}${c.yellow}${envName.toUpperCase()} ENVIRONMENT${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);

    // Infrastructure summary
    if (envResult.infrastructure) {
      console.log(`${c.bright}Infrastructure:${c.reset}`);
      this.printInfrastructure(envResult.infrastructure);
    }

    // Scenario results
    if (envResult.scenarios) {
      console.log(`${c.bright}Scenario Results:${c.reset}`);
      Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
        this.printScenarioResults(scenarioName, scenario);
      });
    }

    // Environment summary
    if (envResult.summary) {
      console.log(`${c.bright}Summary:${c.reset}`);
      console.log(`  Total Scenarios: ${envResult.summary.totalScenarios}`);
      console.log(`  Success Rate: ${envResult.summary.averageSuccessRate?.toFixed(1)}%`);
      console.log(`  Total Iterations: ${envResult.summary.totalIterations}`);
      console.log(`  Successful Iterations: ${envResult.summary.successfulIterations}\n`);
    }
  }

  printInfrastructure(infrastructure) {
    const c = this.colors;

    if (infrastructure.cdn) {
      const status = infrastructure.cdn.detected ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`  CDN: ${status} ${infrastructure.cdn.provider || 'Not detected'}`);
    }

    if (infrastructure.compression) {
      const effectiveness = infrastructure.compression.effectiveness;
      const color = effectiveness === 'excellent' ? c.green :
                   effectiveness === 'good' ? c.yellow : c.red;
      console.log(`  Compression: ${color}${infrastructure.compression.algorithm || 'None'}${c.reset} (${effectiveness})`);
    }

    if (infrastructure.protocols) {
      const http2 = infrastructure.protocols.http2Support ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`  HTTP/2: ${http2}`);
    }

    if (infrastructure.security) {
      const score = infrastructure.security.score;
      const color = score > 80 ? c.green : score > 60 ? c.yellow : c.red;
      console.log(`  Security Score: ${color}${score}/100${c.reset}`);
    }

    console.log('');
  }

  printScenarioResults(scenarioName, scenario) {
    const c = this.colors;

    console.log(`  ${c.bright}${scenarioName}:${c.reset}`);

    if (scenario.statistics) {
      Object.entries(scenario.statistics).forEach(([metric, stats]) => {
        if (typeof stats === 'object' && stats.mean !== undefined) {
          const cv = stats.cv || 0;
          const cvColor = cv < 10 ? c.green : cv < 20 ? c.yellow : c.red;

          console.log(`    ${metric}: ${c.cyan}${stats.mean}${c.reset}ms ` +
            `(±${stats.stddev}ms, CV: ${cvColor}${cv.toFixed(1)}%${c.reset})`);
        }
      });

      const successRate = scenario.statistics.successRate || 0;
      const successColor = successRate > 95 ? c.green : successRate > 80 ? c.yellow : c.red;
      console.log(`    Success Rate: ${successColor}${successRate.toFixed(1)}%${c.reset}`);
    }

    console.log('');
  }

  printComparison(baseline, comparison, envNames) {
    const c = this.colors;
    const PerformanceComparisonEngine = require('../compare.js');
    const comparisonEngine = new PerformanceComparisonEngine();

    console.log(`${c.bright}${c.magenta}ENVIRONMENT COMPARISON${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);
    console.log(`Comparing ${envNames[1]} vs ${envNames[0]} (baseline)\n`);

    const comparisonResult = comparisonEngine.compareEnvironments(baseline, comparison);

    // Print significant changes
    if (comparisonResult.summary.significantChanges.length > 0) {
      console.log(`${c.bright}Significant Changes:${c.reset}`);
      comparisonResult.summary.significantChanges.forEach(change => {
        const [metric, percentChange] = change.split(': ');
        const percent = parseFloat(percentChange);
        const color = percent > 0 ? c.red : c.green;
        console.log(`  ${metric}: ${color}${percentChange}${c.reset}`);
      });
      console.log('');
    }

    // Print regressions
    if (comparisonResult.summary.regressions.length > 0) {
      console.log(`${c.bright}${c.red}Performance Regressions:${c.reset}`);
      comparisonResult.summary.regressions.forEach(regression => {
        console.log(`  ${c.red}▼${c.reset} ${regression}`);
      });
      console.log('');
    }

    // Print improvements
    if (comparisonResult.summary.improvements.length > 0) {
      console.log(`${c.bright}${c.green}Performance Improvements:${c.reset}`);
      comparisonResult.summary.improvements.forEach(improvement => {
        console.log(`  ${c.green}▲${c.reset} ${improvement}`);
      });
      console.log('');
    }

    // Overall assessment
    const overallColor = comparisonResult.summary.overallImpact === 'positive' ? c.green :
                        comparisonResult.summary.overallImpact === 'negative' ? c.red : c.yellow;
    console.log(`${c.bright}Overall Impact: ${overallColor}${comparisonResult.summary.overallImpact.toUpperCase()}${c.reset}\n`);
  }

  generateMarkdownReport(results) {
    let markdown = '# Performance Test Report\n\n';

    // Metadata
    if (results.metadata) {
      markdown += '## Test Information\n\n';
      markdown += `- **Timestamp:** ${results.metadata.timestamp}\n`;
      markdown += `- **Duration:** ${results.metadata.duration}ms\n`;
      markdown += `- **Environments:** ${Object.keys(results.results).join(', ')}\n\n`;
    }

    // Environment results
    Object.entries(results.results).forEach(([envName, envResult]) => {
      markdown += `## ${envName.charAt(0).toUpperCase() + envName.slice(1)} Environment\n\n`;

      // Infrastructure
      if (envResult.infrastructure) {
        markdown += '### Infrastructure\n\n';
        markdown += this.generateInfrastructureMarkdown(envResult.infrastructure);
      }

      // Scenarios
      if (envResult.scenarios) {
        markdown += '### Performance Results\n\n';
        markdown += this.generateScenariosMarkdown(envResult.scenarios);
      }

      // Summary
      if (envResult.summary) {
        markdown += '### Summary\n\n';
        markdown += `- **Total Scenarios:** ${envResult.summary.totalScenarios}\n`;
        markdown += `- **Average Success Rate:** ${envResult.summary.averageSuccessRate?.toFixed(1)}%\n`;
        markdown += `- **Total Iterations:** ${envResult.summary.totalIterations}\n`;
        markdown += `- **Successful Iterations:** ${envResult.summary.successfulIterations}\n\n`;
      }
    });

    return markdown;
  }

  generateInfrastructureMarkdown(infrastructure) {
    let markdown = '';

    if (infrastructure.cdn) {
      markdown += `**CDN:** ${infrastructure.cdn.detected ? '✅' : '❌'} ${infrastructure.cdn.provider || 'Not detected'}\n\n`;
    }

    if (infrastructure.compression) {
      const emoji = infrastructure.compression.effectiveness === 'excellent' ? '🟢' :
                   infrastructure.compression.effectiveness === 'good' ? '🟡' : '🔴';
      markdown += `**Compression:** ${emoji} ${infrastructure.compression.algorithm || 'None'} (${infrastructure.compression.effectiveness})\n\n`;
    }

    if (infrastructure.protocols) {
      markdown += `**HTTP/2:** ${infrastructure.protocols.http2Support ? '✅' : '❌'}\n\n`;
    }

    if (infrastructure.security) {
      const emoji = infrastructure.security.score > 80 ? '🟢' :
                   infrastructure.security.score > 60 ? '🟡' : '🔴';
      markdown += `**Security Score:** ${emoji} ${infrastructure.security.score}/100\n\n`;
    }

    return markdown;
  }

  generateScenariosMarkdown(scenarios) {
    let markdown = '';

    Object.entries(scenarios).forEach(([scenarioName, scenario]) => {
      markdown += `#### ${scenarioName}\n\n`;

      if (scenario.statistics) {
        markdown += '| Metric | Mean | Std Dev | CV | P95 |\n';
        markdown += '|--------|------|---------|----|----- |\n';

        Object.entries(scenario.statistics).forEach(([metric, stats]) => {
          if (typeof stats === 'object' && stats.mean !== undefined) {
            markdown += `| ${metric} | ${stats.mean}ms | ${stats.stddev}ms | ${(stats.cv || 0).toFixed(1)}% | ${stats.p95 || 'N/A'}ms |\n`;
          }
        });

        const successRate = scenario.statistics.successRate || 0;
        markdown += `\n**Success Rate:** ${successRate.toFixed(1)}%\n\n`;
      }
    });

    return markdown;
  }

  generateHtmlReport(results) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        .metadata { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .environment { border: 1px solid #bdc3c7; margin: 20px 0; border-radius: 5px; }
        .environment-header { background: #3498db; color: white; padding: 15px; font-weight: bold; }
        .environment-content { padding: 20px; }
        .infrastructure { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .infra-item { background: #f8f9fa; padding: 10px; border-radius: 5px; border-left: 4px solid #3498db; }
        .metric-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .metric-table th, .metric-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .metric-table th { background: #f2f2f2; }
        .status-good { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-error { color: #e74c3c; }
        .success-rate { font-weight: bold; padding: 5px 10px; border-radius: 3px; }
        .success-rate.good { background: #d5edda; color: #155724; }
        .success-rate.warning { background: #fff3cd; color: #856404; }
        .success-rate.poor { background: #f8d7da; color: #721c24; }
        .chart-container { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Performance Test Report</h1>

        ${this.generateHtmlMetadata(results.metadata)}
        ${this.generateHtmlEnvironments(results.results)}
        ${this.generateHtmlComparison(results.results)}
    </div>
</body>
</html>`;

    return html;
  }

  generateHtmlMetadata(metadata) {
    if (!metadata) return '';

    return `
        <div class="metadata">
            <h3>📊 Test Information</h3>
            <p><strong>Timestamp:</strong> ${metadata.timestamp}</p>
            <p><strong>Duration:</strong> ${metadata.duration}ms</p>
            <p><strong>Version:</strong> ${metadata.version || 'N/A'}</p>
        </div>
    `;
  }

  generateHtmlEnvironments(results) {
    let html = '';

    Object.entries(results).forEach(([envName, envResult]) => {
      html += `
        <div class="environment">
            <div class="environment-header">${envName.toUpperCase()} ENVIRONMENT</div>
            <div class="environment-content">
                ${this.generateHtmlInfrastructure(envResult.infrastructure)}
                ${this.generateHtmlScenarios(envResult.scenarios)}
                ${this.generateHtmlSummary(envResult.summary)}
            </div>
        </div>
      `;
    });

    return html;
  }

  generateHtmlInfrastructure(infrastructure) {
    if (!infrastructure) return '';

    let html = '<h3>🏗️ Infrastructure</h3><div class="infrastructure">';

    if (infrastructure.cdn) {
      const status = infrastructure.cdn.detected ? 'status-good' : 'status-error';
      html += `
        <div class="infra-item">
            <strong>CDN</strong><br>
            <span class="${status}">${infrastructure.cdn.provider || 'Not detected'}</span>
        </div>
      `;
    }

    if (infrastructure.compression) {
      const statusClass = infrastructure.compression.effectiveness === 'excellent' ? 'status-good' :
                         infrastructure.compression.effectiveness === 'good' ? 'status-warning' : 'status-error';
      html += `
        <div class="infra-item">
            <strong>Compression</strong><br>
            <span class="${statusClass}">${infrastructure.compression.algorithm || 'None'}</span><br>
            <small>${infrastructure.compression.effectiveness}</small>
        </div>
      `;
    }

    if (infrastructure.protocols) {
      const http2Status = infrastructure.protocols.http2Support ? 'status-good' : 'status-error';
      html += `
        <div class="infra-item">
            <strong>HTTP/2</strong><br>
            <span class="${http2Status}">${infrastructure.protocols.http2Support ? 'Enabled' : 'Disabled'}</span>
        </div>
      `;
    }

    if (infrastructure.security) {
      const score = infrastructure.security.score;
      const statusClass = score > 80 ? 'status-good' : score > 60 ? 'status-warning' : 'status-error';
      html += `
        <div class="infra-item">
            <strong>Security Score</strong><br>
            <span class="${statusClass}">${score}/100</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  generateHtmlScenarios(scenarios) {
    if (!scenarios) return '';

    let html = '<h3>📈 Performance Results</h3>';

    Object.entries(scenarios).forEach(([scenarioName, scenario]) => {
      html += `<h4>${scenarioName}</h4>`;

      if (scenario.statistics) {
        html += `
          <table class="metric-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Mean</th>
                <th>Std Dev</th>
                <th>CV</th>
                <th>P95</th>
                <th>Success Rate</th>
              </tr>
            </thead>
            <tbody>
        `;

        Object.entries(scenario.statistics).forEach(([metric, stats]) => {
          if (typeof stats === 'object' && stats.mean !== undefined) {
            const cv = stats.cv || 0;
            const cvClass = cv < 10 ? 'status-good' : cv < 20 ? 'status-warning' : 'status-error';

            html += `
              <tr>
                <td>${metric}</td>
                <td>${stats.mean}ms</td>
                <td>${stats.stddev}ms</td>
                <td class="${cvClass}">${cv.toFixed(1)}%</td>
                <td>${stats.p95 || 'N/A'}ms</td>
                <td>${this.formatSuccessRate(scenario.statistics.successRate)}</td>
              </tr>
            `;
          }
        });

        html += '</tbody></table>';
      }
    });

    return html;
  }

  generateHtmlSummary(summary) {
    if (!summary) return '';

    return `
      <h3>📋 Summary</h3>
      <ul>
        <li><strong>Total Scenarios:</strong> ${summary.totalScenarios}</li>
        <li><strong>Average Success Rate:</strong> ${this.formatSuccessRate(summary.averageSuccessRate)}</li>
        <li><strong>Total Iterations:</strong> ${summary.totalIterations}</li>
        <li><strong>Successful Iterations:</strong> ${summary.successfulIterations}</li>
      </ul>
    `;
  }

  generateHtmlComparison(results) {
    const envNames = Object.keys(results);
    if (envNames.length !== 2) return '';

    const PerformanceComparisonEngine = require('../compare.js');
    const comparisonEngine = new PerformanceComparisonEngine();
    const comparison = comparisonEngine.compareEnvironments(results[envNames[0]], results[envNames[1]]);

    let html = `
      <div class="environment">
        <div class="environment-header">📊 ENVIRONMENT COMPARISON</div>
        <div class="environment-content">
          <p>Comparing <strong>${envNames[1]}</strong> vs <strong>${envNames[0]}</strong> (baseline)</p>
    `;

    if (comparison.summary.significantChanges.length > 0) {
      html += '<h4>Significant Changes</h4><ul>';
      comparison.summary.significantChanges.forEach(change => {
        html += `<li>${change}</li>`;
      });
      html += '</ul>';
    }

    if (comparison.summary.regressions.length > 0) {
      html += '<h4 class="status-error">Performance Regressions</h4><ul>';
      comparison.summary.regressions.forEach(regression => {
        html += `<li class="status-error">▼ ${regression}</li>`;
      });
      html += '</ul>';
    }

    if (comparison.summary.improvements.length > 0) {
      html += '<h4 class="status-good">Performance Improvements</h4><ul>';
      comparison.summary.improvements.forEach(improvement => {
        html += `<li class="status-good">▲ ${improvement}</li>`;
      });
      html += '</ul>';
    }

    const overallClass = comparison.summary.overallImpact === 'positive' ? 'status-good' :
                        comparison.summary.overallImpact === 'negative' ? 'status-error' : 'status-warning';
    html += `
          <p><strong>Overall Impact:</strong> <span class="${overallClass}">${comparison.summary.overallImpact.toUpperCase()}</span></p>
        </div>
      </div>
    `;

    return html;
  }

  formatSuccessRate(rate) {
    if (rate === undefined || rate === null) return 'N/A';

    const rateClass = rate > 95 ? 'good' : rate > 80 ? 'warning' : 'poor';
    return `<span class="success-rate ${rateClass}">${rate.toFixed(1)}%</span>`;
  }

  generateCsvReport(results) {
    let csv = 'Environment,Scenario,Metric,Mean,StdDev,CV,P95,SuccessRate\n';

    Object.entries(results.results).forEach(([envName, envResult]) => {
      if (envResult.scenarios) {
        Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
          if (scenario.statistics) {
            Object.entries(scenario.statistics).forEach(([metric, stats]) => {
              if (typeof stats === 'object' && stats.mean !== undefined) {
                csv += `${envName},${scenarioName},${metric},${stats.mean},${stats.stddev},${stats.cv || 0},${stats.p95 || ''},${scenario.statistics.successRate || ''}\n`;
              }
            });
          }
        });
      }
    });

    return csv;
  }

  generateSummary(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      environments: {},
      overview: {
        totalEnvironments: Object.keys(results.results).length,
        totalScenarios: 0,
        totalIterations: 0,
        overallSuccessRate: 0
      }
    };

    let totalScenarios = 0;
    let totalIterations = 0;
    let totalSuccessfulIterations = 0;

    Object.entries(results.results).forEach(([envName, envResult]) => {
      summary.environments[envName] = {
        infrastructure: envResult.infrastructure,
        summary: envResult.summary,
        keyMetrics: this.extractKeyMetrics(envResult)
      };

      if (envResult.summary) {
        totalScenarios += envResult.summary.totalScenarios || 0;
        totalIterations += envResult.summary.totalIterations || 0;
        totalSuccessfulIterations += envResult.summary.successfulIterations || 0;
      }
    });

    summary.overview.totalScenarios = totalScenarios;
    summary.overview.totalIterations = totalIterations;
    summary.overview.overallSuccessRate = totalIterations > 0 ?
      (totalSuccessfulIterations / totalIterations) * 100 : 0;

    return summary;
  }

  extractKeyMetrics(envResult) {
    const keyMetrics = {};

    if (envResult.scenarios) {
      Object.entries(envResult.scenarios).forEach(([scenarioName, scenario]) => {
        if (scenario.statistics) {
          keyMetrics[scenarioName] = {
            successRate: scenario.statistics.successRate,
            // Extract common timing metrics
            ...(scenario.statistics['timing.total'] && {
              totalTime: scenario.statistics['timing.total'].mean
            }),
            ...(scenario.statistics['performance.timing.total'] && {
              performanceTotal: scenario.statistics['performance.timing.total'].mean
            })
          };
        }
      });
    }

    return keyMetrics;
  }
}

module.exports = ReportGenerator;