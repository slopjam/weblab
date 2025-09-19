class ApiEndpointsScenario {
  constructor() {
    this.name = 'api-endpoints';
    this.description = 'Direct API performance testing';
  }

  async run(page, envConfig, metricsCollector) {
    const startTime = Date.now();
    const result = {
      scenario: this.name,
      baseUrl: envConfig.baseUrl,
      phases: {}
    };

    try {
      // Phase 1: Discover API endpoints
      result.phases.discovery = await this.discoverApiEndpoints(page, envConfig);

      // Phase 2: Test direct resource loading
      result.phases.directRequests = await this.testDirectRequests(page, envConfig);

      // Phase 3: Test common API patterns
      result.phases.apiPatterns = await this.testApiPatterns(page, envConfig);

      // Phase 4: Analyze API performance
      result.phases.performance = await this.analyzeApiPerformance(page, result.phases);

      result.success = true;
      result.totalDuration = Date.now() - startTime;

    } catch (error) {
      result.error = error.message;
      result.success = false;
      result.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  async discoverApiEndpoints(page, envConfig) {
    const discoveryStartTime = Date.now();

    try {
      // First, navigate to the main page to discover endpoints
      await page.goto(envConfig.pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Extract API endpoints from network requests
      const networkRequests = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const apiEndpoints = [];

        resources.forEach(resource => {
          const url = new URL(resource.name);

          // Identify potential API endpoints
          if (
            url.pathname.includes('/api/') ||
            url.pathname.includes('/v1/') ||
            url.pathname.includes('/v2/') ||
            url.pathname.includes('.json') ||
            url.pathname.includes('/graphql') ||
            resource.name.includes('api') ||
            resource.name.includes('service')
          ) {
            apiEndpoints.push({
              url: resource.name,
              method: 'GET', // We can only see GET requests from performance API
              timing: {
                duration: resource.duration,
                dns: resource.domainLookupEnd - resource.domainLookupStart,
                connect: resource.connectEnd - resource.connectStart,
                request: resource.responseStart - resource.requestStart,
                response: resource.responseEnd - resource.responseStart
              },
              size: {
                transfer: resource.transferSize,
                encoded: resource.encodedBodySize,
                decoded: resource.decodedBodySize
              },
              protocol: resource.nextHopProtocol
            });
          }
        });

        return apiEndpoints;
      });

      // Add common API endpoints to test
      const commonEndpoints = this.getCommonApiEndpoints(envConfig);

      return {
        discovered: networkRequests,
        common: commonEndpoints,
        total: networkRequests.length + commonEndpoints.length,
        duration: Date.now() - discoveryStartTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        discovered: [],
        common: [],
        total: 0,
        duration: Date.now() - discoveryStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  getCommonApiEndpoints(envConfig) {
    const baseUrl = envConfig.baseUrl;

    return [
      {
        url: envConfig.mainJsUrl,
        type: 'main-js',
        method: 'GET',
        description: 'Main JavaScript bundle'
      },
      {
        url: `${baseUrl}/api/health`,
        type: 'health-check',
        method: 'GET',
        description: 'Health check endpoint'
      },
      {
        url: `${baseUrl}/api/config`,
        type: 'configuration',
        method: 'GET',
        description: 'Configuration endpoint'
      },
      {
        url: `${baseUrl}/api/user`,
        type: 'user-info',
        method: 'GET',
        description: 'User information endpoint'
      }
    ];
  }

  async testDirectRequests(page, envConfig) {
    const testStartTime = Date.now();
    const results = {
      mainJs: [],
      staticAssets: [],
      summary: {}
    };

    try {
      // Test main JS file multiple times
      for (let i = 0; i < 5; i++) {
        const result = await this.performDirectRequest(page, envConfig.mainJsUrl, 'main-js');
        results.mainJs.push(result);
      }

      // Test other static assets
      const staticAssets = [
        `${envConfig.baseUrl}/favicon.ico`,
        `${envConfig.baseUrl}/robots.txt`,
        `${envConfig.baseUrl}/manifest.json`
      ];

      for (const assetUrl of staticAssets) {
        const result = await this.performDirectRequest(page, assetUrl, 'static-asset');
        results.staticAssets.push(result);
      }

      // Calculate summary statistics
      results.summary = {
        mainJs: this.calculateRequestStats(results.mainJs),
        staticAssets: this.calculateRequestStats(results.staticAssets),
        totalRequests: results.mainJs.length + results.staticAssets.length,
        duration: Date.now() - testStartTime
      };

      return {
        ...results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        mainJs: results.mainJs,
        staticAssets: results.staticAssets,
        timestamp: new Date().toISOString()
      };
    }
  }

  async performDirectRequest(page, url, type) {
    const requestStartTime = Date.now();

    try {
      // Create a new page for isolated request
      const requestPage = await page.context().newPage();

      const response = await requestPage.goto(url, {
        timeout: 15000,
        waitUntil: 'domcontentloaded'
      });

      const requestEndTime = Date.now();

      const result = {
        url,
        type,
        success: true,
        httpStatus: response.status(),
        httpStatusText: response.statusText(),
        headers: await response.allHeaders(),
        timing: {
          total: requestEndTime - requestStartTime,
          navigation: requestEndTime - requestStartTime
        },
        size: {
          headers: JSON.stringify(await response.allHeaders()).length
        },
        timestamp: new Date().toISOString()
      };

      // Get performance metrics for the request
      const perfMetrics = await requestPage.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          return {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            connect: navigation.connectEnd - navigation.connectStart,
            ssl: navigation.secureConnectionStart > 0 ?
                 navigation.connectEnd - navigation.secureConnectionStart : 0,
            request: navigation.responseStart - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart,
            total: navigation.responseEnd - navigation.fetchStart,
            transferSize: navigation.transferSize,
            encodedBodySize: navigation.encodedBodySize,
            decodedBodySize: navigation.decodedBodySize,
            protocol: navigation.nextHopProtocol
          };
        }
        return null;
      });

      if (perfMetrics) {
        result.performance = perfMetrics;
        result.timing = { ...result.timing, ...perfMetrics };
        result.size = {
          ...result.size,
          transfer: perfMetrics.transferSize,
          encoded: perfMetrics.encodedBodySize,
          decoded: perfMetrics.decodedBodySize
        };
      }

      await requestPage.close();
      return result;

    } catch (error) {
      return {
        url,
        type,
        success: false,
        error: error.message,
        timing: {
          total: Date.now() - requestStartTime
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async testApiPatterns(page, envConfig) {
    const patternStartTime = Date.now();
    const results = {
      cors: null,
      compression: null,
      caching: null,
      security: null
    };

    try {
      // Test CORS headers
      results.cors = await this.testCorsHeaders(page, envConfig);

      // Test compression
      results.compression = await this.testCompression(page, envConfig);

      // Test caching headers
      results.caching = await this.testCachingHeaders(page, envConfig);

      // Test security headers
      results.security = await this.testSecurityHeaders(page, envConfig);

      return {
        ...results,
        duration: Date.now() - patternStartTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        duration: Date.now() - patternStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async testCorsHeaders(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      return {
        accessControlAllowOrigin: headers['access-control-allow-origin'] || null,
        accessControlAllowMethods: headers['access-control-allow-methods'] || null,
        accessControlAllowHeaders: headers['access-control-allow-headers'] || null,
        accessControlMaxAge: headers['access-control-max-age'] || null,
        corsEnabled: !!(headers['access-control-allow-origin'])
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async testCompression(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      // Get size information from performance API
      const sizeInfo = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? {
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize,
          decodedBodySize: navigation.decodedBodySize
        } : null;
      });

      const compressionRatio = sizeInfo && sizeInfo.decodedBodySize > 0 ?
        (sizeInfo.encodedBodySize / sizeInfo.decodedBodySize) : 1;

      return {
        contentEncoding: headers['content-encoding'] || null,
        transferSize: sizeInfo?.transferSize || null,
        encodedSize: sizeInfo?.encodedBodySize || null,
        decodedSize: sizeInfo?.decodedBodySize || null,
        compressionRatio,
        compressionPercent: ((1 - compressionRatio) * 100).toFixed(2),
        isCompressed: !!(headers['content-encoding'])
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async testCachingHeaders(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      return {
        cacheControl: headers['cache-control'] || null,
        expires: headers['expires'] || null,
        etag: headers['etag'] || null,
        lastModified: headers['last-modified'] || null,
        age: headers['age'] || null,
        hasCacheHeaders: !!(headers['cache-control'] || headers['expires'] || headers['etag'])
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async testSecurityHeaders(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      return {
        strictTransportSecurity: headers['strict-transport-security'] || null,
        contentSecurityPolicy: headers['content-security-policy'] || null,
        xFrameOptions: headers['x-frame-options'] || null,
        xContentTypeOptions: headers['x-content-type-options'] || null,
        xXssProtection: headers['x-xss-protection'] || null,
        referrerPolicy: headers['referrer-policy'] || null,
        securityScore: this.calculateSecurityScore(headers)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  calculateSecurityScore(headers) {
    let score = 0;
    const securityHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'referrer-policy'
    ];

    securityHeaders.forEach(header => {
      if (headers[header]) score += 1;
    });

    return {
      score,
      maxScore: securityHeaders.length,
      percentage: (score / securityHeaders.length) * 100
    };
  }

  calculateRequestStats(requests) {
    const validRequests = requests.filter(r => r.success && r.timing?.total);

    if (validRequests.length === 0) {
      return { error: 'No valid requests' };
    }

    const times = validRequests.map(r => r.timing.total);
    const sizes = validRequests.map(r => r.size?.transfer || 0).filter(s => s > 0);

    const sorted = times.sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const mean = sum / times.length;

    return {
      count: validRequests.length,
      timing: {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: parseFloat(mean.toFixed(2)),
        median: sorted.length % 2 === 0 ?
          (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 :
          sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      },
      size: sizes.length > 0 ? {
        min: Math.min(...sizes),
        max: Math.max(...sizes),
        mean: parseFloat((sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(2))
      } : null,
      successRate: (validRequests.length / requests.length) * 100
    };
  }

  async analyzeApiPerformance(page, phases) {
    try {
      const analysis = {
        summary: {},
        recommendations: [],
        scores: {}
      };

      // Analyze direct request performance
      if (phases.directRequests?.summary?.mainJs) {
        const mainJsStats = phases.directRequests.summary.mainJs;

        analysis.summary.mainJsPerformance = {
          averageTime: mainJsStats.timing.mean,
          reliability: mainJsStats.successRate,
          consistency: this.calculateConsistency(mainJsStats.timing)
        };

        // Generate recommendations
        if (mainJsStats.timing.mean > 1000) {
          analysis.recommendations.push({
            type: 'performance',
            priority: 'high',
            message: 'Main JS bundle loading is slow. Consider code splitting or CDN optimization.',
            metric: mainJsStats.timing.mean
          });
        }
      }

      // Analyze compression effectiveness
      if (phases.apiPatterns?.compression?.compressionRatio) {
        const compressionRatio = phases.apiPatterns.compression.compressionRatio;

        if (compressionRatio > 0.8) {
          analysis.recommendations.push({
            type: 'compression',
            priority: 'medium',
            message: 'Poor compression detected. Enable gzip/brotli compression.',
            ratio: compressionRatio
          });
        }
      }

      // Analyze caching
      if (phases.apiPatterns?.caching && !phases.apiPatterns.caching.hasCacheHeaders) {
        analysis.recommendations.push({
          type: 'caching',
          priority: 'medium',
          message: 'No cache headers detected. Implement proper caching strategy.',
        });
      }

      // Analyze security
      if (phases.apiPatterns?.security?.securityScore) {
        const securityScore = phases.apiPatterns.security.securityScore;
        analysis.scores.security = securityScore.percentage;

        if (securityScore.percentage < 50) {
          analysis.recommendations.push({
            type: 'security',
            priority: 'high',
            message: 'Missing security headers. Implement security best practices.',
            score: securityScore
          });
        }
      }

      return {
        ...analysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  calculateConsistency(timing) {
    const cv = timing.mean > 0 ? ((timing.max - timing.min) / timing.mean) * 100 : 0;

    if (cv < 10) return 'excellent';
    if (cv < 20) return 'good';
    if (cv < 50) return 'fair';
    return 'poor';
  }
}

module.exports = new ApiEndpointsScenario();