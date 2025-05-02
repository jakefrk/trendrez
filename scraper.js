const { chromium } = require('playwright');
const fs = require('fs').promises;

// Save diagnostic information immediately
async function saveDiagnostics() {
  try {
    const diagnostics = {
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        env: {
          CI: process.env.CI || 'not set',
          NODE_DEBUG: process.env.NODE_DEBUG || 'not set'
        }
      },
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile('diagnostics.json', JSON.stringify(diagnostics, null, 2));
    console.log('Saved initial diagnostics information');
  } catch (err) {
    console.error('Failed to save diagnostics:', err);
  }
}

// Call this immediately
saveDiagnostics();

// Helper function for random delay
function randomDelay(min = 500, max = 2000) { // 0.5 to 2 seconds default
  return Math.random() * (max - min) + min;
}

async function scrapeClimbingList() {
  console.log('Starting scraper with platform info:');
  console.log('OS:', process.platform);
  console.log('Architecture:', process.arch);
  console.log('Node version:', process.version);
  
  // Create a special text file with timestamp for artifact verification
  await fs.writeFile('scraper-started.txt', `Scraper started at ${new Date().toISOString()}`);

  let browser;
  try {
    // Always use mock data in CI environment to test the workflow
    if (process.env.CI === 'true') {
      console.log('CI environment detected, using mock data');
      // Create mock data for testing
      const mockData = {
        timestamp: new Date().toISOString(),
        total_restaurants: 10,
        restaurants: Array.from({ length: 10 }, (_, i) => ({
          name: `Restaurant ${i+1}`,
          position: i+1
        }))
      };
      
      // Save mock data
      await fs.mkdir('data', { recursive: true });
      const filename = `data/${mockData.timestamp.split('T')[0]}.json`;
      await fs.writeFile(filename, JSON.stringify(mockData, null, 2));
      console.log(`Mock data saved to ${filename}`);
      
      // Also save a successful status file for artifacts
      await fs.writeFile('success.txt', `Mock data generated successfully at ${new Date().toISOString()}`);
      
      return mockData.restaurants;
    }
    
    console.log('Launching browser with enhanced logging...');
    // Log browser executable info
    try {
      const { executablePath } = chromium;
      console.log('Chromium executable path:', executablePath());
    } catch (pathError) {
      console.error('Could not get executable path:', pathError);
    }
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      // Show browser console logs in our Node output
      logger: {
        isEnabled: (name) => true,
        log: (name, severity, message) => console.log(`Browser log [${severity}]: ${message}`)
      }
    }); 
    
    console.log('Browser launched successfully');
    
    // Take a debug screenshot of about:blank
    const testPage = await browser.newPage();
    console.log('Test page created');
    await testPage.goto('about:blank');
    console.log('Navigated to about:blank');
    await testPage.screenshot({ path: 'browser-test.png' });
    console.log('Test screenshot taken');
    await testPage.close();
    console.log('Test page closed');
    
    // Continue with actual scraping
    const page = await browser.newPage();
    console.log('Main scraping page created');
    
    // Begin actual scraping process
    console.log('Starting actual scraping process...');
    
    const allRestaurants = []; 
    let currentPage = 1;
    const maxPagesToScrape = 2; // Reduce for debugging

    // Take screenshot before navigation
    await page.screenshot({ path: 'before-navigation.png' });
    
    // Set a user agent to mimic a real browser
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    });
    
    console.log('Navigating to initial page...');
    // Navigate with more timeout
    await page.goto('https://resy.com/cities/new-york-ny/list/climbing?seats=2', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Take screenshot after navigation
    await page.screenshot({ path: 'after-navigation.png' });
    console.log('Navigation completed');
    
    console.log(`Starting pagination loop (max ${maxPagesToScrape} pages)...`);
    
    while (currentPage <= maxPagesToScrape) {
      console.log(`--- Scraping Page ${currentPage} ---`);
      
      // Wait for restaurant cards
      try {
        await page.waitForSelector('.SearchResult', { timeout: 15000 }); 
      } catch (error) {
        console.log(`No search results found on page ${currentPage}, assuming end.`);
        break; 
      }

      // Extract restaurant data
      const restaurantsOnPage = await page.evaluate(() => {
        const restaurantElements = document.querySelectorAll('.SearchResult'); 
        return Array.from(restaurantElements).map((el, index) => {
          return {
            name: el.querySelector('h3')?.textContent?.trim(), 
          };
        });
      });

      // Add global position 
      restaurantsOnPage.forEach((resto) => { 
          resto.position = allRestaurants.length + 1;
          allRestaurants.push(resto);
      });

      console.log(`Found ${restaurantsOnPage.length} restaurants on page ${currentPage}. Total found: ${allRestaurants.length}`);

      // --- Check if we reached max pages ---
      if (currentPage === maxPagesToScrape) {
          console.log(`Reached max pages limit (${maxPagesToScrape}). Stopping pagination.`);
          break;
      }

      // --- Pagination ---
      const nextButtonSelector = 'a[rel="next"]'; 
      const nextButton = page.locator(nextButtonSelector);

      if (await nextButton.isVisible()) { 
        console.log('Next button found, preparing to click...'); 
        const delay = randomDelay(5000, 10000); 
        console.log(`Waiting for ${Math.round(delay / 1000)} seconds before clicking next...`); 
        await page.waitForTimeout(delay); 
        
        try {
          await nextButton.click();
          console.log('Clicked next page. Waiting for navigation...');
          await page.waitForLoadState('networkidle', { timeout: 15000 }); 
          currentPage++;
        } catch (clickError) {
           console.error('Error clicking next button or waiting for next page load:', clickError.message);
           break; 
        }
      } else {
        console.log('Next button is not visible. Assuming end of pagination.');
        break; 
      }
    } // End while loop

    console.log(`Scraping finished. Total restaurants scraped: ${allRestaurants.length}`);

    // --- Save all results ---
    const timestamp = new Date().toISOString();
    const data = {
      timestamp,
      total_restaurants: allRestaurants.length,
      restaurants: allRestaurants 
    };
    
    const filename = `data/${timestamp.split('T')[0]}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    
    console.log(`All data saved to ${filename}`);
    return allRestaurants;
    
  } catch (error) {
    console.error('Critical scraper error:', error);
    // Save error details to file for debugging
    try {
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        time: new Date().toISOString()
      };
      await fs.writeFile('scraper-error.json', JSON.stringify(errorDetails, null, 2));
      console.log('Error details saved to scraper-error.json');
    } catch (fileError) {
      console.error('Failed to save error details:', fileError);
    }
    process.exit(1);
  } finally {
    console.log('In finally block, ensuring browser is closed...');
    try {
      await fs.writeFile('scraper-completed.txt', `Scraper completed at ${new Date().toISOString()}`);
    } catch (e) {
      console.error('Failed to write completion file:', e);
    }
    
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

// Run it
console.log('Starting scraper process...');
scrapeClimbingList()
  .then(restaurants => {
    console.log('Scraping completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Scraping failed with error:', error.message);
    process.exit(1);
  });