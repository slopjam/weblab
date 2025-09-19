class CriticalPathScenario {
  constructor() {
    this.name = 'critical-path';
    this.description = 'Focus on above-the-fold content and critical rendering path';
  }

  async run(page, envConfig, metricsCollector) {
    const startTime = Date.now();
    const result = {
      scenario: this.name,
      url: envConfig.pageUrl,
      phases: {}
    };

    try {
      // Phase 1: Setup viewport and clear cache
      result.phases.setup = await this.setupCriticalPathTest(page);

      // Phase 2: Navigate and measure critical path
      result.phases.criticalPath = await this.measureCriticalPath(page, envConfig);

      // Phase 3: Analyze above-the-fold content
      result.phases.aboveFold = await this.analyzeAboveFoldContent(page);

      // Phase 4: Collect rendering metrics
      result.phases.rendering = await this.collectRenderingMetrics(page, metricsCollector);

      // Phase 5: Analyze critical resources
      result.phases.criticalResources = await this.analyzeCriticalResources(page, envConfig);

      result.success = true;
      result.totalDuration = Date.now() - startTime;

    } catch (error) {
      result.error = error.message;
      result.success = false;
      result.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  async setupCriticalPathTest(page) {
    const setupStartTime = Date.now();

    try {
      // Set standard desktop viewport for critical path analysis
      await page.setViewportSize({ width: 1366, height: 768 });

      // Clear caches for accurate measurement
      await page.context().clearCookies();
      await page.evaluate(() => {
        try {
          if (window.localStorage) window.localStorage.clear();
          if (window.sessionStorage) window.sessionStorage.clear();
        } catch (e) { /* ignore */ }
      });

      return {
        success: true,
        viewport: await page.viewportSize(),
        duration: Date.now() - setupStartTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - setupStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async measureCriticalPath(page, envConfig) {
    const measureStartTime = Date.now();

    try {
      // Start navigation and track critical milestones
      const navigationStartTime = Date.now();

      const response = await page.goto(envConfig.pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const domContentLoadedTime = Date.now();

      // Wait for first paint
      await page.waitForFunction(() => {
        return performance.getEntriesByType('paint').length > 0;
      }, { timeout: 10000 });

      const firstPaintTime = Date.now();

      // Wait for largest contentful paint or timeout
      let lcpTime = null;
      try {
        await page.waitForFunction(() => {
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          return lcpEntries.length > 0;
        }, { timeout: 8000 });
        lcpTime = Date.now();
      } catch (e) {
        // LCP timeout is acceptable
      }

      return {
        success: true,
        httpStatus: response.status(),
        timing: {
          navigation: domContentLoadedTime - navigationStartTime,
          firstPaint: firstPaintTime - navigationStartTime,
          largestContentfulPaint: lcpTime ? lcpTime - navigationStartTime : null,
          domContentLoaded: domContentLoadedTime - navigationStartTime
        },
        milestones: {
          navigationStart: navigationStartTime,
          domContentLoaded: domContentLoadedTime,
          firstPaint: firstPaintTime,
          largestContentfulPaint: lcpTime
        },
        duration: Date.now() - measureStartTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - measureStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async analyzeAboveFoldContent(page) {
    try {
      const aboveFoldAnalysis = await page.evaluate(() => {
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };

        const analysis = {
          viewport,
          elements: [],
          images: [],
          text: [],
          totalElements: 0,
          visibleElements: 0,
          coverage: 0
        };

        // Get all elements in the viewport
        const allElements = document.querySelectorAll('*');

        allElements.forEach(element => {
          const rect = element.getBoundingClientRect();
          const isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.top < viewport.height &&
            rect.left < viewport.width &&
            rect.width > 0 &&
            rect.height > 0
          );

          analysis.totalElements++;

          if (isVisible) {
            analysis.visibleElements++;

            const elementInfo = {
              tag: element.tagName.toLowerCase(),
              id: element.id,
              classes: Array.from(element.classList),
              rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              },
              area: rect.width * rect.height
            };

            // Categorize by element type
            if (element.tagName === 'IMG') {
              analysis.images.push({
                ...elementInfo,
                src: element.src,
                alt: element.alt,
                loading: element.loading,
                naturalWidth: element.naturalWidth,
                naturalHeight: element.naturalHeight
              });
            } else if (element.textContent && element.textContent.trim().length > 0) {
              analysis.text.push({
                ...elementInfo,
                textLength: element.textContent.trim().length,
                fontSize: window.getComputedStyle(element).fontSize
              });
            }

            analysis.elements.push(elementInfo);
          }
        });

        // Calculate viewport coverage
        const totalViewportArea = viewport.width * viewport.height;
        const coveredArea = analysis.elements.reduce((total, el) => total + el.area, 0);
        analysis.coverage = totalViewportArea > 0 ? (coveredArea / totalViewportArea) * 100 : 0;

        // Sort by area (largest first)
        analysis.elements.sort((a, b) => b.area - a.area);
        analysis.images.sort((a, b) => b.area - a.area);

        return analysis;
      });

      return {
        ...aboveFoldAnalysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async collectRenderingMetrics(page, metricsCollector) {
    try {
      // Get standard metrics
      const standardMetrics = await metricsCollector.collectAllMetrics(page, page.url());

      // Get additional rendering-specific metrics
      const renderingMetrics = await page.evaluate(() => {
        const metrics = {
          paint: {},
          layout: {},
          rendering: {}
        };

        // Paint timing
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach(entry => {
          metrics.paint[entry.name] = entry.startTime;
        });

        // Layout shift
        const layoutShiftEntries = performance.getEntriesByType('layout-shift');
        let cumulativeLayoutShift = 0;
        layoutShiftEntries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cumulativeLayoutShift += entry.value;
          }
        });
        metrics.layout.cumulativeLayoutShift = cumulativeLayoutShift;

        // Largest contentful paint
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const lcp = lcpEntries[lcpEntries.length - 1];
          metrics.rendering.largestContentfulPaint = {
            startTime: lcp.startTime,
            renderTime: lcp.renderTime,
            loadTime: lcp.loadTime,
            size: lcp.size,
            id: lcp.id,
            url: lcp.url
          };
        }

        // First input delay would require actual user interaction
        // So we skip it for automated tests

        // Frame metrics if available
        if ('requestIdleCallback' in window) {
          metrics.rendering.idleCallbackSupported = true;
        }

        return metrics;
      });

      return {
        standard: standardMetrics,
        rendering: renderingMetrics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async analyzeCriticalResources(page, envConfig) {
    try {
      const criticalAnalysis = await page.evaluate((mainJsUrl) => {
        const resources = performance.getEntriesByType('resource');
        const analysis = {
          blocking: [],
          critical: [],
          deferred: [],
          summary: {
            totalResources: resources.length,
            blockingCount: 0,
            criticalCount: 0,
            deferredCount: 0
          }
        };

        resources.forEach(resource => {
          const resourceInfo = {
            name: resource.name,
            type: this.getResourceType(resource.name),
            duration: resource.duration,
            transferSize: resource.transferSize,
            startTime: resource.startTime,
            timing: {
              dns: resource.domainLookupEnd - resource.domainLookupStart,
              connect: resource.connectEnd - resource.connectStart,
              request: resource.responseStart - resource.requestStart,
              response: resource.responseEnd - resource.responseStart
            }
          };

          // Classify resources
          if (this.isBlockingResource(resource)) {
            analysis.blocking.push(resourceInfo);
            analysis.summary.blockingCount++;
          } else if (this.isCriticalResource(resource, mainJsUrl)) {
            analysis.critical.push(resourceInfo);
            analysis.summary.criticalCount++;
          } else {
            analysis.deferred.push(resourceInfo);
            analysis.summary.deferredCount++;
          }
        });

        // Sort by start time to understand loading order
        analysis.blocking.sort((a, b) => a.startTime - b.startTime);
        analysis.critical.sort((a, b) => a.startTime - b.startTime);

        return analysis;

        function getResourceType(url) {
          if (url.includes('.css')) return 'stylesheet';
          if (url.includes('.js')) return 'script';
          if (url.includes('.woff') || url.includes('.ttf')) return 'font';
          if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.webp')) return 'image';
          return 'other';
        }

        function isBlockingResource(resource) {
          const url = resource.name.toLowerCase();
          return (
            (url.includes('.css') && !url.includes('async')) ||
            (url.includes('.js') && !url.includes('async') && !url.includes('defer')) ||
            url.includes('.woff') || url.includes('.ttf')
          );
        }

        function isCriticalResource(resource, mainJsUrl) {
          const url = resource.name;
          return (
            url === mainJsUrl ||
            url.includes('main') ||
            url.includes('bundle') ||
            url.includes('vendor') ||
            url.includes('critical')
          );
        }
      }, envConfig.mainJsUrl);

      // Calculate critical path metrics
      const criticalPathMetrics = this.calculateCriticalPathMetrics(criticalAnalysis);

      return {
        ...criticalAnalysis,
        criticalPath: criticalPathMetrics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  calculateCriticalPathMetrics(analysis) {
    const metrics = {
      blockingResourceTime: 0,
      criticalResourceTime: 0,
      parallelization: 0,
      bottlenecks: []
    };

    // Calculate total time for blocking resources
    if (analysis.blocking.length > 0) {
      const blockingStart = Math.min(...analysis.blocking.map(r => r.startTime));
      const blockingEnd = Math.max(...analysis.blocking.map(r => r.startTime + r.duration));
      metrics.blockingResourceTime = blockingEnd - blockingStart;
    }

    // Calculate total time for critical resources
    if (analysis.critical.length > 0) {
      const criticalStart = Math.min(...analysis.critical.map(r => r.startTime));
      const criticalEnd = Math.max(...analysis.critical.map(r => r.startTime + r.duration));
      metrics.criticalResourceTime = criticalEnd - criticalStart;
    }

    // Analyze parallelization (how many resources load simultaneously)
    const allCritical = [...analysis.blocking, ...analysis.critical];
    if (allCritical.length > 0) {
      const totalDuration = allCritical.reduce((sum, r) => sum + r.duration, 0);
      const actualTime = Math.max(...allCritical.map(r => r.startTime + r.duration)) -
                        Math.min(...allCritical.map(r => r.startTime));
      metrics.parallelization = actualTime > 0 ? (totalDuration / actualTime) : 1;
    }

    // Identify bottlenecks (resources that take significantly longer than average)
    const avgDuration = allCritical.length > 0 ?
      allCritical.reduce((sum, r) => sum + r.duration, 0) / allCritical.length : 0;

    metrics.bottlenecks = allCritical
      .filter(r => r.duration > avgDuration * 2)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);

    return metrics;
  }

  // Generate critical path optimization recommendations
  generateOptimizationRecommendations(result) {
    const recommendations = [];

    if (result.phases?.criticalResources?.criticalPath) {
      const cp = result.phases.criticalResources.criticalPath;

      // Check parallelization
      if (cp.parallelization < 2) {
        recommendations.push({
          type: 'parallelization',
          priority: 'high',
          message: 'Critical resources are loading sequentially. Consider parallelizing resource loading.',
          metric: cp.parallelization
        });
      }

      // Check for bottlenecks
      if (cp.bottlenecks.length > 0) {
        recommendations.push({
          type: 'bottleneck',
          priority: 'high',
          message: `Slow resources detected: ${cp.bottlenecks.map(b => b.name).join(', ')}`,
          resources: cp.bottlenecks
        });
      }
    }

    // Check above-the-fold coverage
    if (result.phases?.aboveFold?.coverage < 50) {
      recommendations.push({
        type: 'coverage',
        priority: 'medium',
        message: 'Low above-the-fold content coverage. Consider optimizing critical CSS.',
        coverage: result.phases.aboveFold.coverage
      });
    }

    // Check LCP timing
    if (result.phases?.criticalPath?.timing?.largestContentfulPaint > 2500) {
      recommendations.push({
        type: 'lcp',
        priority: 'high',
        message: 'Largest Contentful Paint is slow. Consider optimizing critical images and text.',
        lcp: result.phases.criticalPath.timing.largestContentfulPaint
      });
    }

    return recommendations;
  }
}

module.exports = new CriticalPathScenario();