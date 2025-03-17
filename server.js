

import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Launch browser once when server starts
let browser;
(async () => {
  browser = await puppeteer.launch({ headless: true });
  console.log("Browser launched and ready for requests");
})();

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/scrape", async (req, res) => {
  const url = "https://www.moneycontrol.com/economic-calendar";
  let page;

  try {
    // Create a new page for this request
    page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate with a lighter wait condition and timeout
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("table.eco_tbl", { visible: true, timeout: 10000 });

    // Extract data directly in the browser context
    const scrapedData = await page.evaluate(() => {
      const dayAndDate = (document.querySelector("#eDate")?.textContent || "").trim() || "-";
      const rows = Array.from(document.querySelectorAll("table.eco_tbl tr.tableData"));

      return rows.map((row) => {
        const time = (row.querySelector(".time")?.textContent || "").trim() || "-";

        // Extract country code (like TUR)
        const countryCode = Array.from(row.querySelector(".ctry")?.childNodes || [])
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.nodeValue.trim())
          .find(text => text.length > 0) || "-";

        // Extract country name from the <img> tag
        const countryName = row.querySelector(".ctry img.flag_icon")?.title || "-";

        const eventName = (row.querySelector(".eventName")?.textContent || "").trim() || "-";
        const impactDiv = row.querySelector("td#imapactTD div");
        const impact = impactDiv ? impactDiv.className.split(" ") : ["-"];

        const trights = row.querySelectorAll(".tright");
        const actual = (trights[0]?.querySelector("div.stktodayupdn")?.textContent || "").trim().match(/-?\d+(\.\d+)?%/)?.[0] || "-";
        const previous = (trights[1]?.querySelector("div.stktodayupdn")?.textContent || "").trim().match(/-?\d+(\.\d+)?%/)?.[0] || "-";
        const consensus = (trights[2]?.querySelector("div.stktodayupdn")?.textContent || "").trim().match(/-?\d+(\.\d+)?%/)?.[0] || "-";

        return {
          DayAndDate: dayAndDate,
          time,
          countryCode,
          countryName,
          eventName,
          impact,
          actual,
          previous,
          consensus,
        };
      });
    });

    // Close the page to free resources
    await page.close();

    return res.status(200).send({
      success: true,
      message: "Data retrieved successfully",
      total: scrapedData.length,
      tableData: scrapedData,
    });
  } catch (error) {
    if (page) await page.close(); // Ensure page is closed on error
    console.error("Scraping error:", error);

    res.status(500).send({
      success: false,
      message: "Error retrieving data",
      error: error.message,
    });
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
