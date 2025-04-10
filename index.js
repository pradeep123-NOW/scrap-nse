
import express from 'express';  
import puppeteer from 'puppeteer-extra';  // Puppeteer for web scraping
import StealthPlugin from 'puppeteer-extra-plugin-stealth';  // Plugin to evade bot detection
import cors from 'cors';  

// Enable stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;  // Define the server port

// Middleware setup
app.use(cors());  
app.use(express.json());  // Enable JSON parsing in request bodies

// Define NSE website URLs
const NSE_URL = 'https://www.nseindia.com';  // NSE homepage URL
const NSE_API_URL = 'https://www.nseindia.com/api/corporates-pit';  // API endpoint for corporate actions

// Cookies required for authentication while scraping NSE
const cookies = [
    { name: "_ga", value: "GA1.1.120280068.1743424152", domain: ".nseindia.com" },
    { name: "_ga_E0LYHCLJY3", value: "GS1.1.1743493020.2.1.1743493061.0.0.0", domain: ".nseindia.com" },
    { name: "nsit", value: "afaezsotGc1MCJ2tzHRKJYQc", domain: ".nseindia.com" },
    { name: "nseappid", value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkubnNlIiwiYXVkIjoiYXBpLm5zZSIsImlhdCI6MTc0MzUxMzA2MSwiZXhwIjoxNzQzNTIwMjYxfQ.tp5bCF6IwNRpObZ0YFxPEvr9JZHud6LIfb-KBHB1iqE", domain: ".nseindia.com" },
    { name: "_ga_87M7PJ3R97", value: "GS1.1.1743510793.8.1.1743513062.54.0.0", domain: ".nseindia.com" },
    { name: "_ga_WM2NSQKJEK", value: "GS1.1.1743510793.8.1.1743513062.0.0.0", domain: ".nseindia.com" }
];

// Function to scrape NSE data
async function fetchNseData() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    const page = await browser.newPage();  // Open a new browser page

    try {
        await page.setCookie(...cookies);  // Set authentication cookies

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',  // Set request headers
            'Referer': NSE_URL
        });

        await page.goto(NSE_URL, { waitUntil: 'domcontentloaded' });  // Navigate to NSE website and wait for DOM to load

        await new Promise(resolve => setTimeout(resolve, 5000));  // Wait for 5 seconds to ensure the page loads completely

        const response = await page.goto(NSE_API_URL);  // Fetch data from NSE API
        const json = await response.json();  // Parse response as JSON

        // Check if data exists and map it to structured format
        if (json.data && Array.isArray(json.data)) {
            let result = json.data.map(item => ({
                symbol: item.symbol || "N/A",  
                companyName: item.company || "N/A",  
                regulation: item.anex || "N/A",  
                acquirer: item.acqName || "N/A",  
                securityType: item.secType || "N/A",  
                noOfSecurities: item.secAcq || "N/A",  
                acquisitionDisposal: item.tdpTransactionType || "N/A", 
                date: item.intimDt || "N/A",  
            }));
            return result;
        } else {
            return { error: "No data found or unexpected API response" };  // Return error if no data is found
        }
    } catch (error) {
        console.error("Error scraping NSE:", error);  // Log scraping errors
        return { error: "Failed to fetch data" };  // Return error message
    } finally {
        await browser.close();  // Close the browser instance
    }
}

// Define an API endpoint to get NSE data
app.get('/api/nse', async (req, res) => {
    const data = await fetchNseData();  // Call function to fetch data
    console.log("data---->",data)
    return res.status(200).send({  // Send response to client
        success: true,
        message: "Data scrapped successfully",
        total: data.length,
        scrapeData: data
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);  // Log server startup
});