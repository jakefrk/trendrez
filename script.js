document.addEventListener('DOMContentLoaded', () => {
    // Get references to new/changed containers
    const listContainer = document.getElementById('restaurant-list-container');
    const numbersContainer = document.getElementById('position-numbers-container'); 
    const nextDayButton = document.getElementById('next-day-button');
    let initialLoadingMessage = document.querySelector('#restaurant-list-container #loading-message'); // More specific selector

    let allDatesData = {};
    let dateStrings = [];
    let playbackIndex = 0;
    let isPlaying = false;
    let boxHeight = 0; // Height of the box itself (padding + content + border)
    const verticalGap = 2; // Explicit vertical gap between boxes
    let effectiveRowHeight = 0; // boxHeight + verticalGap
    let maxItemsAcrossAllDays = 0; // Track max number of items

    // --- Date Helper ---
    function getDateString(daysAgo) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Sleep Helper ---
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // --- Fetch Data for One Date ---
    async function fetchDateData(dateStr) {
        const dataUrl = `data/${dateStr}.json`;
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                 console.warn(`Data file not found for ${dateStr}, skipping.`);
                 return null; // Indicate missing data
            }
            const data = await response.json();
             return data.restaurants || []; 
        } catch (error) {
            console.error(`Error fetching data for ${dateStr}:`, error);
            return null; // Indicate error
        }
    }

    // --- Fetch All Required Data & Calculate Max Items ---
    async function loadAllData() {
        console.log("Loading data for past 8 days...");
        // Generate date strings for the past 7 days plus today (8 days total)
        dateStrings = Array.from({ length: 8 }, (_, i) => getDateString(7 - i)); 
        maxItemsAcrossAllDays = 0; // Reset

        for (const dateStr of dateStrings) {
            const restaurantList = await fetchDateData(dateStr);
            if (restaurantList) {
                allDatesData[dateStr] = restaurantList;
                // Update max items count
                maxItemsAcrossAllDays = Math.max(maxItemsAcrossAllDays, restaurantList.length); 
            }
        }
        console.log("Finished loading available data. Max items on any day:", maxItemsAcrossAllDays);
    }

     // --- Populate Static Position Numbers ---
    function populatePositionNumbers(dateStr) {
        const restaurantList = allDatesData[dateStr];
        numbersContainer.innerHTML = ''; 
        
        if (!restaurantList || restaurantList.length === 0) {
            console.warn("No restaurant data for populating numbers");
            return;
        }
        
        // Find the highest position number
        let maxPosition = 0;
        for (const restaurant of restaurantList) {
            if (restaurant.position > maxPosition) {
                maxPosition = restaurant.position;
            }
        }
        
        // Ensure we have box height measurements
        if (boxHeight <= 0) {
            console.warn("Box height not yet calculated, using default");
            boxHeight = 30; // Default height matching our CSS
            effectiveRowHeight = boxHeight + verticalGap;
        }
        
        // Create position numbers for each position in sequence
        const positions = new Set();
        restaurantList.forEach(restaurant => positions.add(restaurant.position));
        
        // Sort positions in numerical order
        const sortedPositions = Array.from(positions).sort((a, b) => a - b);
        
        // Create position numbers in sequential order
        for (let i = 0; i < sortedPositions.length; i++) {
            const position = sortedPositions[i];
            const numDiv = document.createElement('div');
            numDiv.className = 'position-number';
            numDiv.textContent = `${position}`;
            
            // Position them at the exact same vertical position as the corresponding restaurant boxes
            const yPos = (position - 1) * effectiveRowHeight;
            numDiv.style.position = 'absolute';
            numDiv.style.top = `${yPos}px`;
            
            numbersContainer.appendChild(numDiv);
        }
        
        // Set container height
        const totalHeight = maxPosition * effectiveRowHeight;
        numbersContainer.style.height = `${totalHeight}px`;
        console.log("Set numbers container height:", numbersContainer.style.height);
    }

     // --- Render List of Boxes for a Specific Date ---
    function renderListBoxes(dateStrToRender) {
        listContainer.innerHTML = ''; 
        boxHeight = 0; 
        effectiveRowHeight = 0;

        const restaurantList = allDatesData[dateStrToRender];

        if (!restaurantList || restaurantList.length === 0) {
            // Handle no data case...
            listContainer.innerHTML = `<div id="error-message">No data available for ${dateStrToRender}.</div>`;
            listContainer.style.height = '50px'; 
            populatePositionNumbers(dateStrToRender); // Still try to populate numbers based on max overall
            return;
        }

        restaurantList.sort((a, b) => a.position - b.position);

        // Create boxes first, but don't position yet
        const boxes = restaurantList.map(restaurant => {
            const box = document.createElement('div');
            box.className = 'restaurant-box';
            box.dataset.name = restaurant.name;
            box.dataset.position = restaurant.position; // Store position for easier reference
            box.dataset.date = dateStrToRender; // Store the date this position is for
            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = restaurant.name || 'Name not found';
            box.appendChild(nameSpan);
            return box;
        });

        // Append the first box to measure its height accurately
        if (boxes.length > 0) {
            listContainer.appendChild(boxes[0]);
            // Force browser layout calculation
            boxHeight = boxes[0].offsetHeight; 
            effectiveRowHeight = boxHeight + verticalGap; // Add gap here
            console.log("Calculated box H:", boxHeight, "Effective Row H:", effectiveRowHeight);

            // If height is valid, position the first box and populate numbers
            if (boxHeight > 0) {
                const initialY_first = (restaurantList[0].position - 1) * effectiveRowHeight;
                boxes[0].style.transform = `translateY(${initialY_first}px)`; 
                boxes[0].style.top = '0px'; 
                 
                // Populate static numbers now that height is known
                populatePositionNumbers(dateStrToRender); 
            } else {
                console.error("Box height calculated as 0. Cannot proceed with layout.");
                listContainer.innerHTML = `<div id="error-message">Layout calculation error.</div>`;
                populatePositionNumbers(dateStrToRender); // Attempt to show numbers anyway
                return; // Stop rendering
            }
            
            // Append and position the rest of the boxes
            for(let i = 1; i < boxes.length; i++) {
                const initialY = (restaurantList[i].position - 1) * effectiveRowHeight;
                boxes[i].style.transform = `translateY(${initialY}px)`; 
                boxes[i].style.top = '0px'; 
                listContainer.appendChild(boxes[i]);
            }
        } else {
            // No boxes to render, but still populate numbers
            populatePositionNumbers(dateStrToRender);
        }

        // Set container height based on THIS date's items and calculated height
        if (effectiveRowHeight > 0) {
            // Find the maximum position for *this specific day* to set initial height
            const maxPositionThisDay = restaurantList.reduce((max, r) => Math.max(max, r.position), 0);
            const totalHeight = maxPositionThisDay === 0 ? 50 : maxPositionThisDay * effectiveRowHeight; 
            listContainer.style.height = `${totalHeight}px`;
            console.log("Set initial list container height based on max position:", listContainer.style.height);
        } else {
            listContainer.style.height = '50px'; // Fallback height
        }

        // Update heading with human-readable date format (and no animation indicator)
        updateHeaderDate(dateStrToRender, false);
    }
    
    // --- Animate Boxes --- 
    async function animateToDate(targetDateStr) {
        console.log(`Animating to rankings for ${targetDateStr}...`);
        const targetRankings = allDatesData[targetDateStr];
        
        // Update heading with human-readable date format and show animation indicator
        updateHeaderDate(targetDateStr, true);
        
        // Find the previous date for position comparison
        const currentDateIndex = dateStrings.indexOf(targetDateStr);
        const previousDateStr = currentDateIndex > 0 ? dateStrings[currentDateIndex - 1] : null;
        const previousRankings = previousDateStr ? allDatesData[previousDateStr] : null;
        
        // Check if this is the first day in the sequence - no restaurants should be highlighted
        const isFirstDay = currentDateIndex === 0 || !previousDateStr || !previousRankings;
        
        // Create position lookup map for previous date if available
        const previousPositionMap = new Map();
        if (previousRankings) {
            previousRankings.forEach(r => previousPositionMap.set(r.name, r.position));
            console.log(`Using previous date ${previousDateStr} for position comparison`);
        } else {
            console.log('No previous day data available for comparison, will not highlight any restaurants');
        }
        
        // If no data for the target date, animate existing boxes out
        if (!targetRankings || targetRankings.length === 0) {
            console.warn(`No ranking data to animate for ${targetDateStr}`);
            // Animate existing boxes out / container shrink
            const boxes = listContainer.querySelectorAll('.restaurant-box');
            boxes.forEach(box => gsap.to(box, { y: 50, opacity: 0, duration: 0.5 })); // Move down and fade
            gsap.to(listContainer, {height: '50px', duration: 0.5}); 
            return; 
        }

        // Find max position for the target date
        const maxPositionThisDay = targetRankings.reduce((max, r) => Math.max(max, r.position), 0);
        
        // Map restaurant names to their target positions
        const rankMap = new Map(targetRankings.map(r => [r.name, r.position]));
        const boxes = listContainer.querySelectorAll('.restaurant-box');
        const animationPromises = [];
        let currentMaxAnimatedPosValue = 0; // Track the highest pixel value needed
        
        // Clean up any existing trail elements
        document.querySelectorAll('.trail-element').forEach(el => el.remove());
        document.querySelectorAll('.ghost-trail').forEach(el => el.remove());
        
        // Remove any existing green glow from previous animations
        boxes.forEach(box => {
            if (box.classList.contains('moving-up')) {
                // Immediately remove class to clear any lingering green glow
                box.classList.remove('moving-up');
            }
        });
        
        // Only check for significant position changes if this isn't the first day
        if (isFirstDay) {
            console.log('First day in sequence - skipping green glow highlights');
            // No need for any delay on the first day
        } else {
            // Batch size and delay between batches
            const BATCH_SIZE = 10;
            const BATCH_DELAY = 0.3; // seconds
            
            // Divide existing boxes into batches for staggered animation
            let currentBatch = 0;
            
            // Get restaurants in order by position
            const boxesInOrder = Array.from(boxes).sort((a, b) => {
                const aRank = rankMap.get(a.dataset.name) || 999;
                const bRank = rankMap.get(b.dataset.name) || 999;
                return aRank - bRank;
            });
            
            // First, identify and highlight boxes that will move up significantly
            const boxesMovingUp = [];
            
            boxesInOrder.forEach((box) => {
                const restaurantName = box.dataset.name;
                const targetRank = rankMap.get(restaurantName);
                
                if (targetRank !== undefined) {
                    // Get the previous position of this restaurant (if available)
                    const previousPosition = previousPositionMap.get(restaurantName);
                    
                    // Only consider restaurants that were in the previous day's data
                    if (previousPosition !== undefined) {
                        const targetPosition = targetRank;
                        const positionImprovement = previousPosition - targetPosition;
                        const isMovingUpSignificantly = positionImprovement >= 3;
                        
                        if (isMovingUpSignificantly) {
                            console.log(`🚀 ${restaurantName} will move up significantly from ${previousPosition} to ${targetPosition}!`);
                            boxesMovingUp.push(box);
                        }
                    }
                }
            });
            
            // Apply green glow effect to boxes that will move up, before any movement
            if (boxesMovingUp.length > 0) {
                console.log(`Highlighting ${boxesMovingUp.length} boxes that will move up significantly...`);
                boxesMovingUp.forEach(box => {
                    box.classList.add('moving-up');
                    box.style.zIndex = 10; // Ensure higher z-index
                });
                
                // Wait 3 seconds to let users notice the highlighted boxes before movement starts
                console.log(`Waiting 3 seconds before starting movement animations...`);
                await sleep(3000);
            } else {
                console.log('No restaurants moving up significantly - skipping highlight delay');
                // No need to wait if no boxes are highlighted
            }
        }
        
        // Get restaurants in order by position for the animation phase
        const boxesInOrder = Array.from(boxes).sort((a, b) => {
            const aRank = rankMap.get(a.dataset.name) || 999;
            const bRank = rankMap.get(b.dataset.name) || 999;
            return aRank - bRank;
        });
        
        // Batch size and delay between batches
        const BATCH_SIZE = 10;
        const BATCH_DELAY = 0.3; // seconds
        
        // Now proceed with the actual movement animations
        boxesInOrder.forEach((box, index) => {
            const restaurantName = box.dataset.name;
            const targetRank = rankMap.get(restaurantName);
            let targetY = 0; 
            let finalYForHeightCalc = 0;

            if (targetRank !== undefined && effectiveRowHeight > 0) {
                targetY = (targetRank - 1) * effectiveRowHeight;
                finalYForHeightCalc = targetY + boxHeight; // Bottom edge of this box
                
                // Get the previous position of this restaurant (if available)
                const previousPosition = previousPositionMap.get(restaurantName);
                const currentPosition = parseInt(box.dataset.position) || (previousPosition || targetRank);
                const targetPosition = targetRank;
                
                // Only create trail effects if this isn't the first day
                if (!isFirstDay && previousPosition !== undefined) {
                    const positionImprovement = previousPosition - targetPosition;
                    const isMovingUpSignificantly = positionImprovement >= 3;
                    
                    // Create trail effect for boxes moving up significantly
                    if (isMovingUpSignificantly) {
                        // Calculate which batch this box belongs to
                        const batchNumber = Math.floor(index / BATCH_SIZE);
                        const batchDelay = batchNumber * BATCH_DELAY;
                        
                        // Create trail effect
                        createTrailEffect(box, targetY, batchDelay);
                    }
                }
                
                // Update position data attribute for next animation
                box.dataset.position = targetPosition;
                
            } else {
                // Position unranked items off-screen to hide them
                targetY = -100; // Move offscreen
                gsap.to(box, {opacity: 0, duration: 0.3}); // Fade out
                console.log(`Restaurant ${restaurantName} unranked on ${targetDateStr}. Hiding.`);
                return; // Skip adding to animation promises
            }
            
            // Track the highest bottom edge needed
            currentMaxAnimatedPosValue = Math.max(currentMaxAnimatedPosValue, finalYForHeightCalc);
            
            // Calculate which batch this box belongs to
            const batchNumber = Math.floor(index / BATCH_SIZE);
            const batchDelay = batchNumber * BATCH_DELAY;

            const animation = gsap.to(box, { 
                y: targetY, 
                duration: 1.5, 
                ease: "elastic.out(1, 0.7)", 
                delay: batchDelay + (Math.random() * 0.1), // Add small random offset within batch
                opacity: 1, // Ensure opacity reset if faded previously
                onComplete: () => {
                    // Make glow fade out gradually after animation completes
                    if (box.classList.contains('moving-up')) {
                        console.log(`Fading out green glow for ${box.dataset.name} after 2 seconds`);
                        setTimeout(() => {
                            // Use GSAP to animate the box-shadow and border-color
                            gsap.to(box, {
                                boxShadow: '0 0 0 0 rgba(76, 217, 100, 0)',
                                borderColor: '#eee',
                                backgroundColor: '#fff', // Keep solid white background
                                duration: 0.8,
                                onComplete: () => {
                                    // Only remove the class after the animation completes
                                    box.classList.remove('moving-up');
                                    box.style.zIndex = 1; // Reset z-index to normal
                                }
                            });
                        }, 2000); // Delay - 2 seconds
                    }
                }
            });
            animationPromises.push(animation);
        });

        // Find restaurants that need to be created (not currently visible)
        const existingNames = new Set(Array.from(boxes).map(box => box.dataset.name));
        const newRestaurants = targetRankings.filter(r => !existingNames.has(r.name));
        
        // Sort new restaurants by position
        newRestaurants.sort((a, b) => a.position - b.position);
        
        // Animate new restaurants in batches
        newRestaurants.forEach((restaurant, index) => {
            // Create a new box for this restaurant
            const newBox = document.createElement('div');
            newBox.className = 'restaurant-box';
            newBox.dataset.name = restaurant.name;
            newBox.dataset.position = restaurant.position;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = restaurant.name || 'Name not found';
            newBox.appendChild(nameSpan);
            
            // Initially position it offscreen and invisible
            newBox.style.transform = 'translateY(-100px)';
            newBox.style.opacity = '0';
            newBox.style.top = '0px';
            listContainer.appendChild(newBox);
            
            // Calculate target position
            const targetY = (restaurant.position - 1) * effectiveRowHeight;
            const finalYForHeightCalc = targetY + boxHeight;
            currentMaxAnimatedPosValue = Math.max(currentMaxAnimatedPosValue, finalYForHeightCalc);
            
            // Calculate which batch this new box belongs to
            // Start new boxes after existing boxes
            const batchNumber = Math.floor(index / BATCH_SIZE) + Math.ceil(boxesInOrder.length / BATCH_SIZE);
            const batchDelay = batchNumber * BATCH_DELAY;
            
            // Animate it into view with staggered delay
            const animation = gsap.to(newBox, {
                y: targetY,
                opacity: 1,
                duration: 1.5,
                ease: "elastic.out(1, 0.7)",
                delay: batchDelay + (Math.random() * 0.1) // Add small random offset within batch
            });
            animationPromises.push(animation);
        });

        // Calculate proper container height
        const finalContainerHeight = maxPositionThisDay * effectiveRowHeight; 
        gsap.to(listContainer, {height: finalContainerHeight, duration: 0.5}); 
        console.log("Animating list container height to:", finalContainerHeight);
        
        // Ensure number container matches
        numbersContainer.style.height = `${maxPositionThisDay * effectiveRowHeight - verticalGap}px`;

        await Promise.all(animationPromises);
        console.log(`Animation finished for ${targetDateStr}.`);
        
        // Update header to remove the animation indicator (pulsing dots)
        updateHeaderDate(targetDateStr, false);
    }

    // Function to create trail effect for boxes moving up significantly
    function createTrailEffect(box, targetY, delay) {
        // Get current position
        const currentTransform = window.getComputedStyle(box).transform;
        let currentY = 0;
        
        // Extract current Y transform
        if (currentTransform && currentTransform !== 'none') {
            const matrix = new DOMMatrix(currentTransform);
            currentY = matrix.m42; // Y transform value
        } else if (box.style.transform) {
            // Try to parse from style property if computed style fails
            const match = box.style.transform.match(/translateY\(([^)]+)\)/);
            if (match) {
                currentY = parseFloat(match[1]);
            }
        }
        
        // Only create trail if we're moving up
        if (targetY >= currentY) {
            console.log(`Skipping trail effect as box is not moving up`);
            return;
        }
        
        console.log(`Creating trail effect from ${currentY}px to ${targetY}px for ${box.dataset.name}`);
        
        // First add ghost trails to the DOM before other trail elements
        // so they'll be layered underneath
        
        // Create a continuous ghost trail from start to end position
        const distance = currentY - targetY;
        
        // Create ghost trail that stretches from current position to target position
        const ghostTrail = document.createElement('div');
        ghostTrail.className = 'ghost-trail';
        
        // Position at the target position (top of the trail) + box height
        // This places it at the bottom of the box's final position
        const boxHeight = box.offsetHeight;
        ghostTrail.style.transform = `translateY(${targetY + boxHeight}px)`;
        
        // Set the height to cover the distance minus box height
        ghostTrail.style.height = `${distance - boxHeight}px`;
        
        // Add to container at the beginning to ensure it's behind other elements
        listContainer.insertBefore(ghostTrail, listContainer.firstChild);
        
        // Animate the ghost trail to fade in quickly then slowly fade out
        gsap.fromTo(ghostTrail, 
            { opacity: 0 },
            { 
                opacity: 0.4, // Reduced maximum opacity
                duration: 0.4, 
                delay: delay,
                onComplete: () => {
                    gsap.to(ghostTrail, {
                        opacity: 0,
                        duration: 2.0, // Longer fade out
                        ease: "power2.out", // Smoother easing function
                        delay: 0.5,
                        onComplete: () => ghostTrail.remove()
                    });
                }
            }
        );
        
        // Create trail elements (discrete "echoes" behind the moving box)
        const numTrailElements = 10; // More trail elements for smoother trail
        const trailDuration = 2.0; // Longer duration
        
        // Get the box width and content for proper sizing and appearance
        const boxWidth = box.offsetWidth;
        const boxContent = box.innerHTML;
        
        // Calculate the start and end positions for trail elements
        const trailStartY = targetY + boxHeight; // Bottom of the box in its final position
        const trailEndY = currentY; // Start position of the box
        const trailStep = (trailEndY - trailStartY) / (numTrailElements + 1);
        
        // Create a document fragment to hold all trail elements to minimize DOM operations
        const trailFragment = document.createDocumentFragment();
        
        for (let i = 0; i < numTrailElements; i++) {
            const trailElement = document.createElement('div');
            trailElement.className = 'trail-element';
            
            // Copy the inner content for a true "ghost" appearance
            // But only for a few elements to avoid clutter
            if (i % 3 === 0) {
                trailElement.innerHTML = boxContent;
                // Make text more transparent
                trailElement.style.color = 'rgba(0, 0, 0, 0.1)'; // More subtle text
            }
            
            // Calculate position for this trail element
            const positionY = trailStartY + (trailStep * (i + 1));
            
            // Set initial position along the path
            trailElement.style.transform = `translateY(${positionY}px)`;
            trailElement.style.width = `${boxWidth - 10}px`; // Match box width
            trailElement.style.opacity = `${0.3 - (i * 0.02)}`; // Lower initial opacity, with gradual decrease
            
            // Add to fragment rather than directly to DOM
            trailFragment.appendChild(trailElement);
            
            // Set up fading animation to be applied after adding to DOM
            setTimeout(() => {
                // Fade out the trail elements with staggered timing and longer duration
                const startDelay = delay + (i * 0.08);
                
                gsap.to(trailElement, {
                    opacity: 0,
                    duration: 2.0 - (i * 0.1), // Longer fade out duration
                    ease: "power1.out",
                    delay: startDelay + 0.6, // Slightly longer delay before starting to fade
                    onComplete: () => {
                        trailElement.remove(); // Clean up after animation
                    }
                });
            }, 0);
        }
        
        // Add all trail elements to the DOM in one operation, at the beginning of the container
        // to ensure they're behind other elements
        listContainer.insertBefore(trailFragment, listContainer.firstChild);
    }

    // --- Playback Control --- 
    async function startPlayback() { 
        if (isPlaying) return; 
        isPlaying = true;
        nextDayButton.disabled = true;
        nextDayButton.style.opacity = 0.5;
        console.log("Starting playback...");

        playbackIndex = 0; 
        
        // Flag to track if we're on the very first animation
        let isFirstAnimation = true;

        while(playbackIndex < dateStrings.length - 1) { 
            const currentDate = dateStrings[playbackIndex];
            if (allDatesData[currentDate]) { 
                await animateToDate(currentDate);
                
                // Only pause between dates after the first animation
                if (isFirstAnimation) {
                    isFirstAnimation = false;
                    console.log("First animation complete - continuing immediately to next date");
                } else {
                    console.log(`Pausing for 3 seconds after ${currentDate}...`);
                    await sleep(3000); 
                }
            } else {
                console.log(`Skipping animation for ${currentDate} (no data loaded).`);
            }
            playbackIndex++;
        }
        
        const todayDate = getDateString(0);
        if (allDatesData[todayDate]) {
            console.log("Animating back to today's rankings...");
            await animateToDate(todayDate);
        }

        console.log("Playback finished.");
        isPlaying = false;
        nextDayButton.disabled = false;
        nextDayButton.style.opacity = 1;
    }

    // --- Initialization ---
    async function initialize() {
        await loadAllData(); // Load all data first
        const todayDate = getDateString(0);
        if(initialLoadingMessage) initialLoadingMessage.remove(); 

        if (allDatesData[todayDate]) {
            // Render initial list which calculates boxHeight and populates numbers
            renderListBoxes(todayDate); 
            nextDayButton.addEventListener('click', startPlayback);
            
            // For testing - double click on a box to force the green glow effect
            listContainer.addEventListener('dblclick', (event) => {
                // Find the closest restaurant box
                const box = event.target.closest('.restaurant-box');
                if (box) {
                    console.log("Double-clicked on: " + box.dataset.name);
                    
                    // Add green glow
                    box.classList.add('moving-up');
                    box.style.zIndex = 10; // Add high z-index
                    
                    // Create debug trail effect for testing
                    const currentY = parseFloat(box.style.transform.match(/translateY\(([^)]+)\)/)[1] || 0);
                    createTrailEffect(box, currentY - 150, 0); // Move up 150px
                    
                    // Move the box up temporarily
                    const originalY = box.style.transform;
                    gsap.to(box, {
                        y: currentY - 150,
                        duration: 1.5,
                        ease: "elastic.out(1, 0.7)",
                        onComplete: () => {
                            // Reset position after animation
                            setTimeout(() => {
                                gsap.to(box, {
                                    y: currentY,
                                    duration: 1.5,
                                    ease: "elastic.out(1, 0.7)",
                                    onComplete: () => {
                                        setTimeout(() => {
                                            // Smoothly fade out the glow effect
                                            gsap.to(box, {
                                                boxShadow: '0 0 0 0 rgba(76, 217, 100, 0)',
                                                borderColor: '#eee',
                                                backgroundColor: '#fff', // Keep solid white background
                                                duration: 0.8,
                                                onComplete: () => {
                                                    box.classList.remove('moving-up');
                                                    box.style.zIndex = 1; // Reset z-index
                                                }
                                            });
                                        }, 1000);
                                    }
                                });
                            }, 1500);
                        }
                    });
                }
            });
        } else {
            listContainer.innerHTML = `<div id="error-message">Could not load initial data for today (${todayDate}). Cannot start.</div>`;
            numbersContainer.innerHTML = ''; // Clear numbers too
            nextDayButton.disabled = true;
            nextDayButton.style.opacity = 0.5;
        }
    }

    // --- Format Date Helper ---
    function formatDateHumanReadable(dateStr) {
        // Parse the YYYY-MM-DD format
        const [year, month, day] = dateStr.split('-').map(part => parseInt(part, 10));
        
        // Month names for display
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Format as "April 27 2025"
        return `${monthNames[month - 1]} ${day} ${year}`;
    }

    // --- Update Header Function ---
    function updateHeaderDate(dateStr, isAnimating = false) {
        // Get the separate date display div
        const dateDisplay = document.getElementById('date-display');
        if (!dateDisplay) return;
        
        // Check if it's today's date
        const isToday = dateStr === getDateString(0);
        const displayDate = isToday ? "Today" : formatDateHumanReadable(dateStr);
        
        // Create pulsing dots container if it doesn't exist
        let dotsContainer = document.querySelector('.pulsing-dots');
        if (!dotsContainer) {
            dotsContainer = document.createElement('span');
            dotsContainer.className = 'pulsing-dots';
            dotsContainer.style.opacity = '0';
            
            // Add the three dots with separate animation timings
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('span');
                dot.className = 'dot';
                dot.textContent = '.';
                dotsContainer.appendChild(dot);
            }
            
            dateDisplay.appendChild(dotsContainer);
        }
        
        // Fade out current date
        gsap.to(dateDisplay, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                // Update date text and fade in
                dateDisplay.innerHTML = displayDate;
                // Re-append the dots container which was cleared by innerHTML
                if (!dateDisplay.contains(dotsContainer)) {
                    dateDisplay.appendChild(dotsContainer);
                }
                
                gsap.to(dateDisplay, {
                    opacity: 1,
                    duration: 0.3
                });
                
                // Handle pulsing dots
                if (dotsContainer) {
                    if (isAnimating) {
                        // Show pulsing dots when animations are running
                        gsap.to(dotsContainer, {
                            opacity: 1,
                            duration: 0.3
                        });
                    } else {
                        // Hide dots when animations are done
                        gsap.to(dotsContainer, {
                            opacity: 0,
                            duration: 0.3
                        });
                    }
                }
            }
        });
    }

    initialize(); // Start the process
});
