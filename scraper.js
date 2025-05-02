const { chromium } = require('playwright');
const fs = require('fs').promises;

// Helper function for random delay
function randomDelay(min = 500, max = 2000) { // 0.5 to 2 seconds default
  return Math.random() * (max - min) + min;
}

async function scrapeClimbingList() {
  console.log('Starting scraper...');
  // Keep headless: false for now if you still want to see it
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }); 
  const page = await browser.newPage();
  const allRestaurants = []; // Array to hold restaurants from all pages
  let currentPage = 1;
  const maxPagesToScrape = 6; // REINSTATED: Limit to 6 pages total (initial + 5 clicks)
  // Removed maxPagesToScrape limit

  try {
    console.log('Navigating to initial page...');
    await page.goto('https://resy.com/cities/new-york-ny/list/climbing?seats=2', { waitUntil: 'networkidle' });
    
    console.log(`Starting pagination loop (max ${maxPagesToScrape} pages)...`);

    while (currentPage <= maxPagesToScrape) { // REINSTATED: Loop with page limit
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

      // --- Check if we reached max pages --- REINSTATED
      if (currentPage === maxPagesToScrape) {
          console.log(`Reached max pages limit (${maxPagesToScrape}). Stopping pagination.`);
          break;
      }

      // --- Pagination ---
      const nextButtonSelector = 'a[rel="next"]'; 
      const nextButton = page.locator(nextButtonSelector);

      if (await nextButton.isVisible()) { 
        /* // COMMENTED OUT: Dynamic check for last page
        // Explicitly check if the button is disabled via aria-disabled attribute
        const isDisabled = await nextButton.getAttribute('aria-disabled');
        if (isDisabled === 'true') {
            console.log('Next button is disabled. Reached the last page.');
            break; // Exit loop
        }
        */
        
        console.log('Next button found, preparing to click...'); // Assumes enabled for now
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
    
    // REINSTATED: Use page range in filename for test runs
    // const filename = `data/climbing_data_${timestamp.split('T')[0]}_page1-${currentPage-1}.json`; 
    // Simplified filename to just the date
    const filename = `data/${timestamp.split('T')[0]}.json`;
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    
    console.log(`All data saved to ${filename}`);
    return allRestaurants;
    
  } catch (error) {
    console.error('Scraping error:', error);
    process.exit(1);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

// Run it
scrapeClimbingList()
  .then(restaurants => {
    console.log('Scraping completed successfully.');
  })
  .catch(error => {
    console.error('Scraping failed.');
    process.exit(1);
  });