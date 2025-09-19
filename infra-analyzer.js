class InfrastructureAnalyzer {
  constructor() {
    this.cdnProviders = {
      'cloudfront': 'Amazon CloudFront',
      'fastly': 'Fastly',
      'cloudflare': 'Cloudflare',
      'akamai': 'Akamai',
      'maxcdn': 'MaxCDN',
      'keycdn': 'KeyCDN',
      'bunnycdn': 'BunnyCDN',
      'jsdelivr': 'jsDelivr',
      'unpkg': 'UNPKG'
    };

    this.compressionTypes = {
      'gzip': 'Gzip',
      'br': 'Brotli',
      'deflate': 'Deflate',
      'compress': 'Compress'
    };
  }

  async analyze(envConfig) {
    const startTime = Date.now();
    const analysis = {
      environment: envConfig.name,
      baseUrl: envConfig.baseUrl,
      timestamp: new Date().toISOString(),
      infrastructure: {}
    };

    try {
      // Create a browser context for analysis
      const { chromium } = require('playwright');
      const browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Analyze CDN configuration
      analysis.infrastructure.cdn = await this.analyzeCdn(page, envConfig);

      // Analyze compression
      analysis.infrastructure.compression = await this.analyzeCompression(page, envConfig);

      // Analyze HTTP protocols
      analysis.infrastructure.protocols = await this.analyzeProtocols(page, envConfig);

      // Analyze server headers
      analysis.infrastructure.server = await this.analyzeServerHeaders(page, envConfig);

      // Analyze caching strategy
      analysis.infrastructure.caching = await this.analyzeCachingStrategy(page, envConfig);

      // Analyze code splitting and bundling
      analysis.infrastructure.bundling = await this.analyzeBundling(page, envConfig);

      // Analyze security configuration
      analysis.infrastructure.security = await this.analyzeSecurity(page, envConfig);

      // Analyze performance optimizations
      analysis.infrastructure.optimizations = await this.analyzeOptimizations(page, envConfig);

      await browser.close();

      analysis.analysisTime = Date.now() - startTime;
      analysis.success = true;

    } catch (error) {
      analysis.error = error.message;
      analysis.success = false;
      analysis.analysisTime = Date.now() - startTime;
    }

    return analysis;
  }

  async analyzeCdn(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      const cdnAnalysis = {
        detected: false,
        provider: null,
        popLocation: null,
        cacheStatus: null,
        edgeServer: null,
        headers: {}
      };

      // Check for CDN-specific headers
      const cdnHeaders = [
        'cf-ray', 'cf-cache-status', 'cf-pop', // Cloudflare
        'x-amz-cf-id', 'x-amz-cf-pop', // CloudFront
        'fastly-debug-digest', 'x-served-by', 'x-cache', // Fastly
        'x-akamai-request-id', 'x-cache-key', // Akamai
        'server-id', 'x-edge-location' // Generic
      ];

      cdnHeaders.forEach(header => {
        if (headers[header]) {
          cdnAnalysis.headers[header] = headers[header];
          cdnAnalysis.detected = true;
        }
      });

      // Detect CDN provider based on headers and domain
      cdnAnalysis.provider = this.detectCdnProvider(headers, envConfig.mainJsUrl);

      // Extract POP location if available
      cdnAnalysis.popLocation = this.extractPopLocation(headers);

      // Extract cache status
      cdnAnalysis.cacheStatus = this.extractCacheStatus(headers);

      // Get edge server info
      cdnAnalysis.edgeServer = headers['server'] || null;

      // Analyze domain for CDN patterns
      const url = new URL(envConfig.mainJsUrl);
      cdnAnalysis.domain = {
        hostname: url.hostname,
        isSubdomain: url.hostname.split('.').length > 2,
        cdnPattern: this.detectCdnPattern(url.hostname)
      };

      return cdnAnalysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  detectCdnProvider(headers, url) {
    // Check headers first
    if (headers['cf-ray']) return 'Cloudflare';
    if (headers['x-amz-cf-id']) return 'Amazon CloudFront';
    if (headers['fastly-debug-digest'] || headers['x-served-by']) return 'Fastly';
    if (headers['x-akamai-request-id']) return 'Akamai';

    // Check URL patterns
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [pattern, provider] of Object.entries(this.cdnProviders)) {
      if (hostname.includes(pattern)) {
        return provider;
      }
    }

    return null;
  }

  detectCdnPattern(hostname) {
    const patterns = [
      /cdn\./i,
      /static\./i,
      /assets\./i,
      /media\./i,
      /img\./i,
      /js\./i,
      /css\./i,
      /\.amazonaws\.com$/i,
      /\.cloudfront\.net$/i,
      /\.fastly\.com$/i,
      /\.cloudflare\.com$/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(hostname)) {
        return pattern.source;
      }
    }

    return null;
  }

  extractPopLocation(headers) {
    // Cloudflare
    if (headers['cf-pop']) return headers['cf-pop'];

    // CloudFront
    if (headers['x-amz-cf-pop']) return headers['x-amz-cf-pop'];

    // Fastly
    if (headers['x-served-by']) {
      const match = headers['x-served-by'].match(/cache-([a-z]+\d+)/);
      return match ? match[1] : headers['x-served-by'];
    }

    // Generic edge location
    if (headers['x-edge-location']) return headers['x-edge-location'];

    return null;
  }

  extractCacheStatus(headers) {
    // Standard cache headers
    if (headers['x-cache']) return headers['x-cache'];
    if (headers['cf-cache-status']) return headers['cf-cache-status'];
    if (headers['x-cache-status']) return headers['x-cache-status'];

    return null;
  }

  async analyzeCompression(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      // Get size information
      const sizeInfo = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? {
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize,
          decodedBodySize: navigation.decodedBodySize
        } : null;
      });

      const compression = {
        enabled: false,
        algorithm: null,
        ratio: 1,
        savings: 0,
        effectiveness: 'none'
      };

      // Check compression headers
      const contentEncoding = headers['content-encoding'];
      if (contentEncoding) {
        compression.enabled = true;
        compression.algorithm = this.compressionTypes[contentEncoding] || contentEncoding;
      }

      // Calculate compression metrics
      if (sizeInfo && sizeInfo.decodedBodySize > 0 && sizeInfo.encodedBodySize > 0) {
        compression.ratio = sizeInfo.encodedBodySize / sizeInfo.decodedBodySize;
        compression.savings = sizeInfo.decodedBodySize - sizeInfo.encodedBodySize;
        compression.savingsPercent = ((1 - compression.ratio) * 100).toFixed(2);

        // Determine effectiveness
        if (compression.ratio < 0.3) compression.effectiveness = 'excellent';
        else if (compression.ratio < 0.5) compression.effectiveness = 'good';
        else if (compression.ratio < 0.7) compression.effectiveness = 'fair';
        else compression.effectiveness = 'poor';
      }

      compression.sizes = sizeInfo;

      return compression;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeProtocols(page, envConfig) {
    try {
      await page.goto(envConfig.pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const protocolAnalysis = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const navigation = performance.getEntriesByType('navigation')[0];

        const protocols = {
          page: navigation?.nextHopProtocol || 'unknown',
          resources: {},
          http2Support: false,
          http3Support: false,
          summary: {}
        };

        // Analyze all resource protocols
        resources.forEach(resource => {
          const protocol = resource.nextHopProtocol || 'unknown';
          if (!protocols.resources[protocol]) {
            protocols.resources[protocol] = 0;
          }
          protocols.resources[protocol]++;
        });

        // Check for HTTP/2 and HTTP/3 support
        protocols.http2Support = navigation?.nextHopProtocol?.includes('h2') ||
          Object.keys(protocols.resources).some(p => p.includes('h2'));

        protocols.http3Support = navigation?.nextHopProtocol?.includes('h3') ||
          Object.keys(protocols.resources).some(p => p.includes('h3'));

        // Generate summary
        const totalResources = resources.length;
        protocols.summary = {
          totalResources,
          protocolDistribution: {}
        };

        Object.entries(protocols.resources).forEach(([protocol, count]) => {
          protocols.summary.protocolDistribution[protocol] = {
            count,
            percentage: ((count / totalResources) * 100).toFixed(2)
          };
        });

        return protocols;
      });

      return protocolAnalysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeServerHeaders(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      const serverAnalysis = {
        server: headers['server'] || 'unknown',
        poweredBy: headers['x-powered-by'] || null,
        framework: null,
        loadBalancer: null,
        proxyServer: null,
        customHeaders: {}
      };

      // Detect framework/platform
      serverAnalysis.framework = this.detectFramework(headers);

      // Detect load balancer
      serverAnalysis.loadBalancer = this.detectLoadBalancer(headers);

      // Detect proxy server
      serverAnalysis.proxyServer = this.detectProxyServer(headers);

      // Collect custom/interesting headers
      const interestingHeaders = [
        'x-request-id', 'x-trace-id', 'x-correlation-id',
        'x-frame-options', 'x-content-type-options',
        'strict-transport-security', 'content-security-policy',
        'x-served-by', 'x-cache', 'x-backend'
      ];

      interestingHeaders.forEach(header => {
        if (headers[header]) {
          serverAnalysis.customHeaders[header] = headers[header];
        }
      });

      return serverAnalysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  detectFramework(headers) {
    if (headers['x-powered-by']) {
      const poweredBy = headers['x-powered-by'].toLowerCase();
      if (poweredBy.includes('express')) return 'Express.js';
      if (poweredBy.includes('next')) return 'Next.js';
      if (poweredBy.includes('asp.net')) return 'ASP.NET';
      if (poweredBy.includes('php')) return 'PHP';
    }

    if (headers['server']) {
      const server = headers['server'].toLowerCase();
      if (server.includes('nginx')) return 'Nginx';
      if (server.includes('apache')) return 'Apache';
      if (server.includes('iis')) return 'IIS';
      if (server.includes('cloudflare')) return 'Cloudflare';
    }

    return null;
  }

  detectLoadBalancer(headers) {
    const lbHeaders = [
      'x-forwarded-for', 'x-real-ip', 'x-forwarded-proto',
      'x-amzn-trace-id', 'x-azure-requestid'
    ];

    for (const header of lbHeaders) {
      if (headers[header]) {
        return 'detected';
      }
    }

    return null;
  }

  detectProxyServer(headers) {
    if (headers['via']) return headers['via'];
    if (headers['x-forwarded-by']) return headers['x-forwarded-by'];
    if (headers['x-proxy-id']) return headers['x-proxy-id'];

    return null;
  }

  async analyzeCachingStrategy(page, envConfig) {
    try {
      await page.goto(envConfig.pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const cachingAnalysis = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const analysis = {
          strategy: 'unknown',
          resources: {},
          effectiveness: 0,
          patterns: []
        };

        resources.forEach(resource => {
          const resourceType = this.getResourceType(resource.name);
          if (!analysis.resources[resourceType]) {
            analysis.resources[resourceType] = {
              total: 0,
              cached: 0,
              cacheRate: 0
            };
          }

          analysis.resources[resourceType].total++;

          // Estimate if resource was cached (heuristic based on timing)
          const isCached = resource.transferSize === 0 ||
            (resource.transferSize > 0 && resource.duration < 10);

          if (isCached) {
            analysis.resources[resourceType].cached++;
          }
        });

        // Calculate cache rates
        let totalCached = 0;
        let totalResources = 0;

        Object.keys(analysis.resources).forEach(type => {
          const typeData = analysis.resources[type];
          typeData.cacheRate = (typeData.cached / typeData.total) * 100;
          totalCached += typeData.cached;
          totalResources += typeData.total;
        });

        analysis.effectiveness = totalResources > 0 ? (totalCached / totalResources) * 100 : 0;

        return analysis;

        function getResourceType(url) {
          if (url.includes('.js')) return 'javascript';
          if (url.includes('.css')) return 'stylesheet';
          if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.webp')) return 'image';
          if (url.includes('.woff') || url.includes('.ttf')) return 'font';
          return 'other';
        }
      });

      // Get cache headers from main resource
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      cachingAnalysis.headers = {
        cacheControl: headers['cache-control'] || null,
        expires: headers['expires'] || null,
        etag: headers['etag'] || null,
        lastModified: headers['last-modified'] || null,
        age: headers['age'] || null
      };

      // Determine caching strategy
      cachingAnalysis.strategy = this.determineCachingStrategy(cachingAnalysis.headers);

      return cachingAnalysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  determineCachingStrategy(headers) {
    if (headers.cacheControl) {
      const cc = headers.cacheControl.toLowerCase();
      if (cc.includes('no-cache')) return 'no-cache';
      if (cc.includes('max-age')) return 'max-age';
      if (cc.includes('immutable')) return 'immutable';
      if (cc.includes('public')) return 'public';
      if (cc.includes('private')) return 'private';
    }

    if (headers.expires) return 'expires';
    if (headers.etag) return 'etag';
    if (headers.lastModified) return 'last-modified';

    return 'unknown';
  }

  async analyzeBundling(page, envConfig) {
    try {
      await page.goto(envConfig.pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const bundlingAnalysis = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const analysis = {
          jsFiles: [],
          cssFiles: [],
          bundlePattern: 'unknown',
          splitting: false,
          lazyLoading: false,
          totalSize: 0,
          optimization: {}
        };

        resources.forEach(resource => {
          if (resource.name.includes('.js')) {
            analysis.jsFiles.push({
              name: resource.name,
              size: resource.transferSize || 0,
              duration: resource.duration
            });
          } else if (resource.name.includes('.css')) {
            analysis.cssFiles.push({
              name: resource.name,
              size: resource.transferSize || 0,
              duration: resource.duration
            });
          }

          analysis.totalSize += resource.transferSize || 0;
        });

        // Analyze bundling patterns
        analysis.bundlePattern = this.analyzeBundlePattern(analysis.jsFiles);

        // Check for code splitting
        analysis.splitting = analysis.jsFiles.length > 2 &&
          analysis.jsFiles.some(f => f.name.includes('chunk') || f.name.includes('vendor'));

        // Check for lazy loading patterns
        analysis.lazyLoading = analysis.jsFiles.some(f =>
          f.name.includes('lazy') || f.name.includes('async') || f.name.includes('chunk'));

        // Optimization analysis
        analysis.optimization = {
          bundleCount: analysis.jsFiles.length,
          averageBundleSize: analysis.jsFiles.length > 0 ?
            analysis.jsFiles.reduce((sum, f) => sum + f.size, 0) / analysis.jsFiles.length : 0,
          largestBundle: analysis.jsFiles.length > 0 ?
            Math.max(...analysis.jsFiles.map(f => f.size)) : 0,
          smallestBundle: analysis.jsFiles.length > 0 ?
            Math.min(...analysis.jsFiles.map(f => f.size)) : 0
        };

        return analysis;

        function analyzeBundlePattern(jsFiles) {
          if (jsFiles.length === 1) return 'single-bundle';
          if (jsFiles.some(f => f.name.includes('vendor'))) return 'vendor-splitting';
          if (jsFiles.some(f => f.name.includes('chunk'))) return 'code-splitting';
          if (jsFiles.length > 5) return 'micro-bundles';
          return 'multiple-bundles';
        }
      });

      return bundlingAnalysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeSecurity(page, envConfig) {
    try {
      const response = await page.goto(envConfig.mainJsUrl, { timeout: 15000 });
      const headers = await response.allHeaders();

      const securityAnalysis = {
        https: envConfig.mainJsUrl.startsWith('https://'),
        headers: {
          hsts: headers['strict-transport-security'] || null,
          csp: headers['content-security-policy'] || null,
          frameOptions: headers['x-frame-options'] || null,
          contentTypeOptions: headers['x-content-type-options'] || null,
          xssProtection: headers['x-xss-protection'] || null,
          referrerPolicy: headers['referrer-policy'] || null
        },
        score: 0,
        recommendations: []
      };

      // Calculate security score
      let score = 0;
      if (securityAnalysis.https) score += 20;
      if (securityAnalysis.headers.hsts) score += 15;
      if (securityAnalysis.headers.csp) score += 20;
      if (securityAnalysis.headers.frameOptions) score += 10;
      if (securityAnalysis.headers.contentTypeOptions) score += 10;
      if (securityAnalysis.headers.xssProtection) score += 10;
      if (securityAnalysis.headers.referrerPolicy) score += 15;

      securityAnalysis.score = score;

      // Generate recommendations
      if (!securityAnalysis.https) {
        securityAnalysis.recommendations.push('Enable HTTPS');
      }
      if (!securityAnalysis.headers.hsts) {
        securityAnalysis.recommendations.push('Add HSTS header');
      }
      if (!securityAnalysis.headers.csp) {
        securityAnalysis.recommendations.push('Implement Content Security Policy');
      }

      return securityAnalysis;

    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeOptimizations(page, envConfig) {
    try {
      await page.goto(envConfig.pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const optimizations = await page.evaluate(() => {
        const analysis = {
          preload: [],
          prefetch: [],
          modulePreload: [],
          resourceHints: [],
          inlineStyles: 0,
          inlineScripts: 0
        };

        // Check for preload/prefetch hints
        const linkElements = document.querySelectorAll('link');
        linkElements.forEach(link => {
          if (link.rel === 'preload') {
            analysis.preload.push({
              href: link.href,
              as: link.as,
              type: link.type
            });
          } else if (link.rel === 'prefetch') {
            analysis.prefetch.push({
              href: link.href,
              as: link.as
            });
          } else if (link.rel === 'modulepreload') {
            analysis.modulePreload.push({
              href: link.href
            });
          } else if (['dns-prefetch', 'preconnect'].includes(link.rel)) {
            analysis.resourceHints.push({
              rel: link.rel,
              href: link.href
            });
          }
        });

        // Count inline styles and scripts
        analysis.inlineStyles = document.querySelectorAll('style').length;
        analysis.inlineScripts = document.querySelectorAll('script:not([src])').length;

        return analysis;
      });

      // Analyze service worker
      optimizations.serviceWorker = await page.evaluate(() => {
        return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
      });

      return optimizations;

    } catch (error) {
      return { error: error.message };
    }
  }

  // Generate infrastructure recommendations
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.infrastructure) {
      const infra = analysis.infrastructure;

      // CDN recommendations
      if (!infra.cdn?.detected) {
        recommendations.push({
          type: 'cdn',
          priority: 'high',
          message: 'No CDN detected. Consider implementing a CDN for better performance.'
        });
      }

      // Compression recommendations
      if (!infra.compression?.enabled) {
        recommendations.push({
          type: 'compression',
          priority: 'high',
          message: 'No compression detected. Enable gzip or brotli compression.'
        });
      } else if (infra.compression.effectiveness === 'poor') {
        recommendations.push({
          type: 'compression',
          priority: 'medium',
          message: 'Poor compression effectiveness. Consider using brotli or optimizing content.'
        });
      }

      // HTTP/2 recommendations
      if (!infra.protocols?.http2Support) {
        recommendations.push({
          type: 'protocol',
          priority: 'medium',
          message: 'HTTP/2 not detected. Upgrade to HTTP/2 for better performance.'
        });
      }

      // Caching recommendations
      if (infra.caching?.effectiveness < 50) {
        recommendations.push({
          type: 'caching',
          priority: 'medium',
          message: 'Low cache effectiveness. Optimize caching strategy.'
        });
      }

      // Security recommendations
      if (infra.security?.score < 70) {
        recommendations.push({
          type: 'security',
          priority: 'high',
          message: 'Security headers missing. Implement security best practices.',
          suggestions: infra.security.recommendations
        });
      }
    }

    return recommendations;
  }
}

module.exports = InfrastructureAnalyzer;