class MetricsCollector {
  constructor() {
    this.enabledMetrics = {
      connection: true,
      timing: true,
      resources: true,
      webVitals: true,
      network: true,
      performance: true
    };
  }

  async collectAllMetrics(page, url, config = {}) {
    const startTime = Date.now();
    const metrics = {
      timestamp: new Date().toISOString(),
      url,
      config
    };

    try {
      // Collect browser performance metrics
      if (this.enabledMetrics.performance) {
        metrics.performance = await this.collectPerformanceMetrics(page);
      }

      // Collect resource timing
      if (this.enabledMetrics.resources) {
        metrics.resources = await this.collectResourceMetrics(page, url);
      }

      // Collect connection timing
      if (this.enabledMetrics.connection) {
        metrics.connection = await this.collectConnectionMetrics(page, url);
      }

      // Collect Web Vitals
      if (this.enabledMetrics.webVitals) {
        metrics.webVitals = await this.collectWebVitals(page);
      }

      // Collect network information
      if (this.enabledMetrics.network) {
        metrics.network = await this.collectNetworkInfo(page);
      }

      // Calculate derived metrics
      metrics.derived = this.calculateDerivedMetrics(metrics);

      metrics.collectionTime = Date.now() - startTime;

    } catch (error) {
      metrics.error = error.message;
      metrics.collectionTime = Date.now() - startTime;
    }

    return metrics;
  }

  async collectPerformanceMetrics(page) {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (!navigation) return null;

      return {
        // Navigation timing
        navigationStart: navigation.startTime,
        unloadEventStart: navigation.unloadEventStart,
        unloadEventEnd: navigation.unloadEventEnd,
        redirectStart: navigation.redirectStart,
        redirectEnd: navigation.redirectEnd,
        fetchStart: navigation.fetchStart,
        domainLookupStart: navigation.domainLookupStart,
        domainLookupEnd: navigation.domainLookupEnd,
        connectStart: navigation.connectStart,
        connectEnd: navigation.connectEnd,
        secureConnectionStart: navigation.secureConnectionStart,
        requestStart: navigation.requestStart,
        responseStart: navigation.responseStart,
        responseEnd: navigation.responseEnd,
        domLoading: navigation.domLoading,
        domInteractive: navigation.domInteractive,
        domContentLoadedEventStart: navigation.domContentLoadedEventStart,
        domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
        domComplete: navigation.domComplete,
        loadEventStart: navigation.loadEventStart,
        loadEventEnd: navigation.loadEventEnd,

        // Calculated timing metrics
        timing: {
          redirect: navigation.redirectEnd - navigation.redirectStart,
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          connect: navigation.connectEnd - navigation.connectStart,
          ssl: navigation.secureConnectionStart > 0 ?
               navigation.connectEnd - navigation.secureConnectionStart : 0,
          ttfb: navigation.responseStart - navigation.requestStart,
          download: navigation.responseEnd - navigation.responseStart,
          domProcessing: navigation.domComplete - navigation.domLoading,
          total: navigation.loadEventEnd - navigation.fetchStart
        },

        // Transfer size information
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
        decodedBodySize: navigation.decodedBodySize,

        // Connection info
        nextHopProtocol: navigation.nextHopProtocol,
        type: navigation.type
      };
    });
  }

  async collectResourceMetrics(page, targetUrl) {
    return await page.evaluate((url) => {
      const resources = performance.getEntriesByType('resource');
      const resourceMetrics = {
        total: resources.length,
        byType: {},
        mainResource: null,
        largestResources: [],
        slowestResources: []
      };

      // Find main resource (main.js or similar)
      const mainResource = resources.find(r =>
        r.name.includes('main') && r.name.includes('.js') ||
        r.name === url
      );

      if (mainResource) {
        resourceMetrics.mainResource = {
          name: mainResource.name,
          duration: mainResource.duration,
          transferSize: mainResource.transferSize,
          encodedBodySize: mainResource.encodedBodySize,
          decodedBodySize: mainResource.decodedBodySize,
          timing: {
            dns: mainResource.domainLookupEnd - mainResource.domainLookupStart,
            connect: mainResource.connectEnd - mainResource.connectStart,
            ssl: mainResource.secureConnectionStart > 0 ?
                 mainResource.connectEnd - mainResource.secureConnectionStart : 0,
            ttfb: mainResource.responseStart - mainResource.requestStart,
            download: mainResource.responseEnd - mainResource.responseStart
          },
          nextHopProtocol: mainResource.nextHopProtocol
        };
      }

      // Group by resource type
      resources.forEach(resource => {
        const type = this.getResourceType(resource.name);
        if (!resourceMetrics.byType[type]) {
          resourceMetrics.byType[type] = {
            count: 0,
            totalSize: 0,
            totalDuration: 0,
            avgSize: 0,
            avgDuration: 0
          };
        }

        resourceMetrics.byType[type].count++;
        resourceMetrics.byType[type].totalSize += resource.transferSize || 0;
        resourceMetrics.byType[type].totalDuration += resource.duration || 0;
      });

      // Calculate averages
      Object.keys(resourceMetrics.byType).forEach(type => {
        const typeData = resourceMetrics.byType[type];
        typeData.avgSize = typeData.totalSize / typeData.count;
        typeData.avgDuration = typeData.totalDuration / typeData.count;
      });

      // Find largest and slowest resources
      const resourcesWithMetrics = resources.map(r => ({
        name: r.name,
        size: r.transferSize || 0,
        duration: r.duration || 0
      }));

      resourceMetrics.largestResources = resourcesWithMetrics
        .sort((a, b) => b.size - a.size)
        .slice(0, 5);

      resourceMetrics.slowestResources = resourcesWithMetrics
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);

      return resourceMetrics;

      function getResourceType(url) {
        if (url.includes('.js')) return 'javascript';
        if (url.includes('.css')) return 'stylesheet';
        if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.webp')) return 'image';
        if (url.includes('.woff') || url.includes('.ttf')) return 'font';
        if (url.includes('.json')) return 'json';
        if (url.includes('.xml')) return 'xml';
        return 'other';
      }
    }, targetUrl);
  }

  async collectConnectionMetrics(page, url) {
    return await page.evaluate((targetUrl) => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (!navigation) return null;

      // Get connection info for main document
      const connectionInfo = {
        protocol: navigation.nextHopProtocol,
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
        decodedBodySize: navigation.decodedBodySize,
        compressionRatio: navigation.encodedBodySize > 0 ?
          (navigation.decodedBodySize / navigation.encodedBodySize) : 1,

        timing: {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ssl: navigation.secureConnectionStart > 0 ?
               navigation.connectEnd - navigation.secureConnectionStart : 0,
          request: navigation.responseStart - navigation.requestStart,
          response: navigation.responseEnd - navigation.responseStart,
          processing: navigation.domComplete - navigation.responseEnd
        }
      };

      // Add network connection info if available
      if (navigator.connection) {
        connectionInfo.networkInfo = {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
          saveData: navigator.connection.saveData
        };
      }

      return connectionInfo;
    }, url);
  }

  async collectWebVitals(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          lcp: null,
          fid: null,
          cls: null,
          ttfb: null,
          fcp: null
        };

        // Get TTFB from navigation timing
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          vitals.ttfb = navigation.responseStart - navigation.requestStart;
        }

        // LCP - Largest Contentful Paint
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.length > 0) {
                vitals.lcp = entries[entries.length - 1].startTime;
              }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            // FCP - First Contentful Paint
            const fcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.length > 0) {
                vitals.fcp = entries[0].startTime;
              }
            });
            fcpObserver.observe({ entryTypes: ['paint'] });

            // CLS - Cumulative Layout Shift
            let clsScore = 0;
            const clsObserver = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  clsScore += entry.value;
                }
              }
              vitals.cls = clsScore;
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });

            // FID would need user interaction, so we'll skip it for automated tests

            // Give observers time to collect data
            setTimeout(() => {
              resolve(vitals);
            }, 1000);
          } catch (error) {
            resolve(vitals);
          }
        } else {
          resolve(vitals);
        }
      });
    });
  }

  async collectNetworkInfo(page) {
    return await page.evaluate(() => {
      const networkInfo = {};

      // User agent
      networkInfo.userAgent = navigator.userAgent;

      // Connection information
      if (navigator.connection) {
        networkInfo.connection = {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
          saveData: navigator.connection.saveData
        };
      }

      // Memory information
      if (performance.memory) {
        networkInfo.memory = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }

      // Device information
      networkInfo.device = {
        deviceMemory: navigator.deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      };

      // Screen information
      networkInfo.screen = {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      };

      return networkInfo;
    });
  }

  calculateDerivedMetrics(metrics) {
    const derived = {};

    if (metrics.performance && metrics.performance.timing) {
      const timing = metrics.performance.timing;

      // Calculate efficiency metrics
      derived.efficiency = {
        bytesPerMs: metrics.performance.transferSize > 0 && timing.total > 0 ?
          metrics.performance.transferSize / timing.total : 0,

        compressionEfficiency: metrics.performance.encodedBodySize > 0 &&
          metrics.performance.decodedBodySize > 0 ?
          (1 - (metrics.performance.encodedBodySize / metrics.performance.decodedBodySize)) * 100 : 0,

        cacheEfficiency: metrics.resources && metrics.resources.total > 0 ?
          ((metrics.resources.total - (metrics.resources.byType?.image?.count || 0)) / metrics.resources.total) * 100 : 0
      };

      // Calculate performance scores
      derived.scores = {
        dnsScore: this.scoreMetric(timing.dns, [0, 50, 100, 200]),
        connectScore: this.scoreMetric(timing.connect, [0, 100, 300, 500]),
        ttfbScore: this.scoreMetric(timing.ttfb, [0, 200, 500, 1000]),
        downloadScore: this.scoreMetric(timing.download, [0, 100, 300, 600]),
        totalScore: this.scoreMetric(timing.total, [0, 1000, 3000, 5000])
      };

      // Overall performance grade
      const avgScore = Object.values(derived.scores).reduce((a, b) => a + b, 0) / Object.values(derived.scores).length;
      derived.overallGrade = this.getGrade(avgScore);
    }

    // Web Vitals scores
    if (metrics.webVitals) {
      derived.webVitalsScores = {
        lcpScore: metrics.webVitals.lcp ? this.scoreMetric(metrics.webVitals.lcp, [0, 2500, 4000, 6000]) : null,
        fcpScore: metrics.webVitals.fcp ? this.scoreMetric(metrics.webVitals.fcp, [0, 1800, 3000, 4500]) : null,
        clsScore: metrics.webVitals.cls ? this.scoreMetric(metrics.webVitals.cls, [0, 0.1, 0.25, 0.4], true) : null,
        ttfbScore: metrics.webVitals.ttfb ? this.scoreMetric(metrics.webVitals.ttfb, [0, 800, 1800, 3000]) : null
      };
    }

    return derived;
  }

  scoreMetric(value, thresholds, lowerIsBetter = false) {
    if (value === null || value === undefined) return 0;

    const [excellent, good, needsImprovement, poor] = thresholds;

    if (lowerIsBetter) {
      if (value <= excellent) return 100;
      if (value <= good) return 90;
      if (value <= needsImprovement) return 70;
      if (value <= poor) return 50;
      return 25;
    } else {
      if (value <= excellent) return 100;
      if (value <= good) return 90;
      if (value <= needsImprovement) return 70;
      if (value <= poor) return 50;
      return 25;
    }
  }

  getGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  // Method to collect metrics for a specific resource
  async collectResourceSpecificMetrics(page, resourceUrl) {
    return await page.evaluate((url) => {
      const entries = performance.getEntriesByName(url);
      if (entries.length === 0) return null;

      const entry = entries[0];
      return {
        name: entry.name,
        entryType: entry.entryType,
        startTime: entry.startTime,
        duration: entry.duration,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
        nextHopProtocol: entry.nextHopProtocol,
        timing: {
          dns: entry.domainLookupEnd - entry.domainLookupStart,
          connect: entry.connectEnd - entry.connectStart,
          ssl: entry.secureConnectionStart > 0 ?
               entry.connectEnd - entry.secureConnectionStart : 0,
          request: entry.responseStart - entry.requestStart,
          response: entry.responseEnd - entry.responseStart,
          total: entry.responseEnd - entry.startTime
        }
      };
    }, resourceUrl);
  }

  // Enable/disable specific metric collections
  enableMetrics(metricTypes) {
    if (Array.isArray(metricTypes)) {
      metricTypes.forEach(type => {
        if (this.enabledMetrics.hasOwnProperty(type)) {
          this.enabledMetrics[type] = true;
        }
      });
    }
  }

  disableMetrics(metricTypes) {
    if (Array.isArray(metricTypes)) {
      metricTypes.forEach(type => {
        if (this.enabledMetrics.hasOwnProperty(type)) {
          this.enabledMetrics[type] = false;
        }
      });
    }
  }
}

module.exports = MetricsCollector;