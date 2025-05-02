const fs = require('fs');
const path = require('path');

/**
 * Generates mock restaurant data for visualization
 */
async function generateMockData() {
  console.log('Starting mock data generation...');
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync('data')) {
      console.log('Creating data directory...');
      fs.mkdirSync('data', { recursive: true });
    }
    
    // Generate today's date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // Create a list of 20 restaurants with random positions
    const restaurantNames = [
      "Delicious Bites", "Tasty Corner", "Savory Dish", "Flavor Haven", 
      "Culinary Delight", "Gourmet Express", "Fine Dining", "Spice Fusion",
      "Urban Taste", "Coastal Kitchen", "Downtown Diner", "Garden Grill",
      "Fresh Plate", "Sunset Cafe", "Terrace Table", "Street Food Spot",
      "Chef's Special", "Bistro Central", "Healthy Harvest", "Daily Feast"
    ];
    
    // Shuffle the positions to create some movement each day
    const randomlyOrdered = [...restaurantNames]
      .map(name => ({ name, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((item, index) => ({
        name: item.name,
        position: index + 1
      }));
    
    // Create the data structure
    const mockData = {
      timestamp: new Date().toISOString(),
      total_restaurants: randomlyOrdered.length,
      restaurants: randomlyOrdered
    };
    
    // Write data to file
    const filePath = path.join('data', `${dateStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    
    console.log(`Successfully generated mock data at ${filePath}`);
    console.log(`Generated ${mockData.total_restaurants} restaurants`);
    
    // Create files for the past 7 days as well to have some history
    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      const pastDateStr = pastDate.toISOString().split('T')[0];
      
      // Shuffle differently for past dates
      const pastRandomlyOrdered = [...restaurantNames]
        .map(name => ({ name, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((item, index) => ({
          name: item.name,
          position: index + 1
        }));
      
      const pastMockData = {
        timestamp: pastDate.toISOString(),
        total_restaurants: pastRandomlyOrdered.length,
        restaurants: pastRandomlyOrdered
      };
      
      const pastFilePath = path.join('data', `${pastDateStr}.json`);
      if (!fs.existsSync(pastFilePath)) {
        fs.writeFileSync(pastFilePath, JSON.stringify(pastMockData, null, 2));
        console.log(`Generated historic data for ${pastDateStr}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error generating mock data:', error);
    return false;
  }
}

// Execute the function
generateMockData()
  .then(success => {
    if (success) {
      console.log('Mock data generation completed successfully.');
      process.exit(0);
    } else {
      console.error('Mock data generation failed.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during mock data generation:', err);
    process.exit(1);
  }); 