class ColdStartScenario {
  constructor() {
    this.name = 'cold-start';
    this.description = 'Fresh browser, cleared cache, new connections';
  }

  async run(page, envConfig, metricsCollector) {
    const startTime = Date.now();
    const result = {
      scenario: this.name,
      url: envConfig.pageUrl,
      phases: {}
    };

    try {
      // Phase 1: Clear all caches and storage
      result.phases.cacheClearing = await this.clearAllCaches(page);

      // Phase 2: Navigate to page and measure
      result.phases.navigation = await this.performNavigation(page, envConfig, startTime);

      // Phase 3: Collect comprehensive metrics
      result.phases.metrics = await metricsCollector.collectAllMetrics(page, envConfig.pageUrl, {
        scenario: this.name,
        cached: false
      });

      // Phase 4: Test specific resource loading
      result.phases.resourceTest = await this.testMainResourceLoading(page, envConfig, metricsCollector);

      result.success = true;
      result.totalDuration = Date.now() - startTime;

    } catch (error) {
      result.error = error.message;
      result.success = false;
      result.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  async clearAllCaches(page) {
    const clearStartTime = Date.now();

    try {
      // Clear browser context caches
      await page.context().clearCookies();
      await page.context().clearPermissions();

      // Clear web storage and caches
      await page.evaluate(() => {
        // Clear localStorage
        try {
          if (window.localStorage) {
            window.localStorage.clear();
          }
        } catch (e) { /* ignore security errors */ }

        // Clear sessionStorage
        try {
          if (window.sessionStorage) {
            window.sessionStorage.clear();
          }
        } catch (e) { /* ignore security errors */ }

        // Clear service worker caches
        try {
          if ('caches' in window) {
            return caches.keys().then(names => {
              return Promise.all(names.map(name => caches.delete(name)));
            });
          }
        } catch (e) { /* ignore cache API errors */ }

        // Clear IndexedDB (basic clearing)
        try {
          if ('indexedDB' in window) {
            // This is a simplified approach - full IDB clearing would need more work
            const databases = ['workbox-precache', 'workbox-runtime'];
            databases.forEach(dbName => {
              try {
                indexedDB.deleteDatabase(dbName);
              } catch (e) { /* ignore */ }
            });
          }
        } catch (e) { /* ignore IndexedDB errors */ }

        return Promise.resolve();
      });

      return {
        success: true,
        duration: Date.now() - clearStartTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - clearStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async performNavigation(page, envConfig, testStartTime) {
    const navStartTime = Date.now();

    try {
      // Navigate with fresh connection
      const response = await page.goto(envConfig.pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for additional resources to load
      await page.waitForTimeout(3000);

      // Wait for network idle (no more than 2 requests in 500ms)
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (e) {
        // Network idle timeout is acceptable
      }

      const navEndTime = Date.now();

      return {
        success: true,
        httpStatus: response.status(),
        httpStatusText: response.statusText(),
        url: response.url(),
        headers: await response.allHeaders(),
        timing: {
          navigation: navEndTime - navStartTime,
          fromTestStart: navEndTime - testStartTime
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timing: {
          navigation: Date.now() - navStartTime,
          fromTestStart: Date.now() - testStartTime
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async testMainResourceLoading(page, envConfig, metricsCollector) {
    try {
      // Get specific metrics for the main JS resource
      const mainResourceMetrics = await metricsCollector.collectResourceSpecificMetrics(page, envConfig.mainJsUrl);

      // If not found by exact URL, search for main.js pattern
      let searchMetrics = null;
      if (!mainResourceMetrics) {
        searchMetrics = await page.evaluate((baseUrl) => {
          const resources = performance.getEntriesByType('resource');

          // Look for main.js or similar patterns
          const candidates = resources.filter(r => {
            const name = r.name.toLowerCase();
            return (name.includes('main') && name.includes('.js')) ||
                   name.includes('main-') ||
                   name.includes('bundle') ||
                   name.includes('app.js');
          });

          if (candidates.length > 0) {
            // Sort by transfer size (largest first) to get the main bundle
            candidates.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0));
            const main = candidates[0];

            return {
              name: main.name,
              duration: main.duration,
              transferSize: main.transferSize,
              encodedBodySize: main.encodedBodySize,
              decodedBodySize: main.decodedBodySize,
              timing: {
                dns: main.domainLookupEnd - main.domainLookupStart,
                connect: main.connectEnd - main.connectStart,
                ssl: main.secureConnectionStart > 0 ?
                     main.connectEnd - main.secureConnectionStart : 0,
                request: main.responseStart - main.requestStart,
                response: main.responseEnd - main.responseStart,
                total: main.responseEnd - main.startTime
              },
              protocol: main.nextHopProtocol
            };
          }

          return null;
        }, envConfig.baseUrl);
      }

      return {
        mainResource: mainResourceMetrics || searchMetrics,
        found: !!(mainResourceMetrics || searchMetrics),
        searchPerformed: !mainResourceMetrics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        found: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Additional validation method
  async validateColdStart(page) {
    return await page.evaluate(() => {
      const validation = {
        localStorage: true,
        sessionStorage: true,
        cookies: true,
        cacheStorage: true
      };

      // Check localStorage
      try {
        validation.localStorage = !window.localStorage || window.localStorage.length === 0;
      } catch (e) {
        validation.localStorage = true; // If we can't access it, assume it's cleared
      }

      // Check sessionStorage
      try {
        validation.sessionStorage = !window.sessionStorage || window.sessionStorage.length === 0;
      } catch (e) {
        validation.sessionStorage = true;
      }

      // Check cookies
      validation.cookies = document.cookie.length === 0;

      // Check cache storage
      if ('caches' in window) {
        return caches.keys().then(keys => {
          validation.cacheStorage = keys.length === 0;
          return validation;
        });
      }

      return Promise.resolve(validation);
    });
  }
}

module.exports = new ColdStartScenario();