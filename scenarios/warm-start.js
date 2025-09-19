class WarmStartScenario {
  constructor() {
    this.name = 'warm-start';
    this.description = 'Primed cache, existing connections';
  }

  async run(page, envConfig, metricsCollector) {
    const startTime = Date.now();
    const result = {
      scenario: this.name,
      url: envConfig.pageUrl,
      phases: {}
    };

    try {
      // Phase 1: Prime the cache with initial visit
      result.phases.cacheWarming = await this.warmupCache(page, envConfig);

      // Phase 2: Measure warm start performance
      result.phases.warmNavigation = await this.performWarmNavigation(page, envConfig);

      // Phase 3: Collect comprehensive metrics
      result.phases.metrics = await metricsCollector.collectAllMetrics(page, envConfig.pageUrl, {
        scenario: this.name,
        cached: true
      });

      // Phase 4: Analyze cache effectiveness
      result.phases.cacheAnalysis = await this.analyzeCacheEffectiveness(page, envConfig);

      result.success = true;
      result.totalDuration = Date.now() - startTime;

    } catch (error) {
      result.error = error.message;
      result.success = false;
      result.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  async warmupCache(page, envConfig) {
    const warmupStartTime = Date.now();

    try {
      // First visit to populate cache
      await page.goto(envConfig.pageUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for all resources to load and cache
      await page.waitForTimeout(2000);

      // Navigate to ensure assets are cached
      await page.goto('about:blank');
      await page.waitForTimeout(500);

      return {
        success: true,
        duration: Date.now() - warmupStartTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - warmupStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async performWarmNavigation(page, envConfig) {
    const navStartTime = Date.now();

    try {
      // Navigate back to the cached page
      const response = await page.goto(envConfig.pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Shorter wait since resources should be cached
      await page.waitForTimeout(1500);

      // Check for network idle but with shorter timeout
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch (e) {
        // Network idle timeout is acceptable for warm start
      }

      const navEndTime = Date.now();

      return {
        success: true,
        httpStatus: response.status(),
        httpStatusText: response.statusText(),
        url: response.url(),
        headers: await response.allHeaders(),
        timing: {
          navigation: navEndTime - navStartTime
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timing: {
          navigation: Date.now() - navStartTime
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async analyzeCacheEffectiveness(page, envConfig) {
    try {
      const cacheAnalysis = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const analysis = {
          totalResources: resources.length,
          cachedResources: 0,
          networkResources: 0,
          cacheHitRate: 0,
          resourceTypes: {},
          cacheStatus: []
        };

        resources.forEach(resource => {
          // Determine if resource was cached based on timing
          const isCached = (
            resource.transferSize === 0 ||
            (resource.transferSize > 0 && resource.duration < 10) ||
            resource.transferSize < resource.encodedBodySize
          );

          if (isCached) {
            analysis.cachedResources++;
          } else {
            analysis.networkResources++;
          }

          // Group by resource type
          const type = this.getResourceType(resource.name);
          if (!analysis.resourceTypes[type]) {
            analysis.resourceTypes[type] = {
              total: 0,
              cached: 0,
              network: 0
            };
          }

          analysis.resourceTypes[type].total++;
          if (isCached) {
            analysis.resourceTypes[type].cached++;
          } else {
            analysis.resourceTypes[type].network++;
          }

          analysis.cacheStatus.push({
            name: resource.name,
            type,
            cached: isCached,
            transferSize: resource.transferSize,
            encodedBodySize: resource.encodedBodySize,
            duration: resource.duration
          });
        });

        analysis.cacheHitRate = analysis.totalResources > 0 ?
          (analysis.cachedResources / analysis.totalResources) * 100 : 0;

        // Calculate cache hit rates by type
        Object.keys(analysis.resourceTypes).forEach(type => {
          const typeData = analysis.resourceTypes[type];
          typeData.cacheHitRate = typeData.total > 0 ?
            (typeData.cached / typeData.total) * 100 : 0;
        });

        return analysis;

        function getResourceType(url) {
          if (url.includes('.js')) return 'javascript';
          if (url.includes('.css')) return 'stylesheet';
          if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.webp')) return 'image';
          if (url.includes('.woff') || url.includes('.ttf')) return 'font';
          if (url.includes('.json')) return 'json';
          if (url.includes('.xml')) return 'xml';
          return 'other';
        }
      });

      // Add cache validation
      const cacheValidation = await this.validateCacheStatus(page);

      return {
        ...cacheAnalysis,
        validation: cacheValidation,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async validateCacheStatus(page) {
    return await page.evaluate(() => {
      const validation = {
        localStorage: false,
        sessionStorage: false,
        cookies: false,
        cacheStorage: false,
        serviceWorker: false
      };

      // Check localStorage
      try {
        validation.localStorage = window.localStorage && window.localStorage.length > 0;
      } catch (e) {
        validation.localStorage = false;
      }

      // Check sessionStorage
      try {
        validation.sessionStorage = window.sessionStorage && window.sessionStorage.length > 0;
      } catch (e) {
        validation.sessionStorage = false;
      }

      // Check cookies
      validation.cookies = document.cookie.length > 0;

      // Check service worker
      validation.serviceWorker = 'serviceWorker' in navigator &&
        navigator.serviceWorker.controller !== null;

      // Check cache storage
      if ('caches' in window) {
        return caches.keys().then(keys => {
          validation.cacheStorage = keys.length > 0;
          return validation;
        });
      }

      return Promise.resolve(validation);
    });
  }

  // Compare warm vs cold metrics
  async compareWithColdStart(warmMetrics, coldMetrics) {
    if (!coldMetrics || !warmMetrics) return null;

    const comparison = {
      improvement: {},
      cacheEffectiveness: {},
      summary: {}
    };

    // Compare timing metrics
    if (coldMetrics.phases?.metrics?.performance?.timing && warmMetrics.phases?.metrics?.performance?.timing) {
      const coldTiming = coldMetrics.phases.metrics.performance.timing;
      const warmTiming = warmMetrics.phases.metrics.performance.timing;

      Object.keys(coldTiming).forEach(metric => {
        if (typeof coldTiming[metric] === 'number' && typeof warmTiming[metric] === 'number') {
          const improvement = coldTiming[metric] - warmTiming[metric];
          const improvementPercent = coldTiming[metric] > 0 ?
            (improvement / coldTiming[metric]) * 100 : 0;

          comparison.improvement[metric] = {
            cold: coldTiming[metric],
            warm: warmTiming[metric],
            improvement,
            improvementPercent: parseFloat(improvementPercent.toFixed(2))
          };
        }
      });
    }

    // Analyze cache effectiveness
    if (warmMetrics.phases?.cacheAnalysis) {
      comparison.cacheEffectiveness = {
        hitRate: warmMetrics.phases.cacheAnalysis.cacheHitRate,
        cachedResources: warmMetrics.phases.cacheAnalysis.cachedResources,
        totalResources: warmMetrics.phases.cacheAnalysis.totalResources,
        resourceTypes: warmMetrics.phases.cacheAnalysis.resourceTypes
      };
    }

    // Generate summary
    const avgImprovement = Object.values(comparison.improvement)
      .map(i => i.improvementPercent)
      .reduce((a, b) => a + b, 0) / Object.keys(comparison.improvement).length;

    comparison.summary = {
      averageImprovement: parseFloat(avgImprovement.toFixed(2)),
      significantImprovement: avgImprovement > 20,
      cacheWorking: comparison.cacheEffectiveness.hitRate > 50
    };

    return comparison;
  }
}

module.exports = new WarmStartScenario();