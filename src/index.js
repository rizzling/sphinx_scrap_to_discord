// Import necessary modules
const puppeteer = require('puppeteer'); //headless browser to scrape from website
const fs = require('fs');
const { Client } = require('discord.js'); //common module for discord bot development
require("dotenv").config(); // Load environment variables

// File path for logging posted bounties
const loggingFilePath = 'postedBounties.json';

// Create the logging file if it doesn't exist
if (!fs.existsSync(loggingFilePath)) {
    fs.writeFileSync(loggingFilePath, '[]', 'utf-8');
}

// Create a Discord client
const client = new Client({
    intents: [], // Define Discord client intents if needed (not necessary for this bot)
});

// Event listener for when the bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('Post Bounties', { type: 'WATCHING' });
});

// Log in to Discord using the provided token
client.login(process.env.DISCORD_BOT_TOKEN);

// Function to scrape bounty URLs from the Sphinx Chat website
async function scrapeBountyURLs() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to the Sphinx Chat bounties page
    await page.goto('https://community.sphinx.chat/bounties', { waitUntil: 'domcontentloaded' });

    // Wait for the bounty selector to load
    await page.waitForSelector('#root > div.app > div > div:nth-child(2)');

    console.log('Extracting bounty URLs...');

    const bountyURLs = [];

    // Select all bounty elements on the page
    const bountyElements = await page.$$('#root > div.app > div > div:nth-child(2) > a');

    // Loop through each bounty element
    for (const bountyElement of bountyElements) {
        console.log('Click bounty element');
        await bountyElement.click();

        // Wait for a short duration to ensure the page loads
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Get the URL of the current page (bounty)
        const bountyURL = page.url();
        console.log(bountyURL);

        // Click the back button to go back to the bounty list
        const backButton = '#sphinx-top-level-overlay > div > div > div:nth-child(1) > button';
        await page.click(backButton);

        // Add the bounty URL to the array
        bountyURLs.push(bountyURL);
    }

    // Close the Puppeteer browser
    await browser.close();

    return bountyURLs;
}

// Function to scrape and post bounties to Discord
async function scrapeAndPostBounties() {
    console.log('Scraping and posting bounties...');

    // Scrape the current bounties from the Sphinx Chat website
    const bounties = await scrapeBounties();

    // Read the logging data from the file
    const loggingData = JSON.parse(fs.readFileSync(loggingFilePath, 'utf-8'));

    let newBountiesCount = 0;

    // Extract the URLs of the bounties
    const bountyURLs = await scrapeBountyURLs();

    // Loop through each scraped bounty
    for (let i = 0; i < bounties.length; i++) {
        const bounty = bounties[i];
        const bountyURL = bountyURLs[i];

        // Check if the bounty has already been posted
        const alreadyPosted = loggingData.some(postedBounty => areBountiesEqual(postedBounty, bounty));

        if (!alreadyPosted) {
            console.log(`Post Bounty on Discord: ${bounty.username} - ${bounty.timestamp}`);
            newBountiesCount++;

            // Add the bounty to the logging data
            loggingData.push({
                username: bounty.username,
                timestamp: bounty.timestamp,
                subject: bounty.subject,
                bountyAmount: bounty.bountyAmount,
                status: bounty.status,
                programmingLanguage: bounty.programmingLanguage,
            });

            // Post the bounty to the Discord channel
            await postBountiesToDiscord([bounty], bountyURL);
        } else {
            console.log(`Bounty already posted: ${bounty.username} - ${bounty.timestamp}`);
        }
    }

    // Print messages based on whether new bounties were found
    if (newBountiesCount === 0) {
        console.log('No new bounties found. Waiting for the next scrape...');
    } else {
        console.log(`${newBountiesCount} new bounties found. Updating log file...`);
    }

    // Update the logging file with the new data
    fs.writeFileSync(loggingFilePath, JSON.stringify(loggingData, null, 2), 'utf-8');

    console.log('Posting done.');

    // Schedule the next scrape and post after 24 hours
    const nextScrapeTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log(`Next run scheduled at: ${nextScrapeTime.toLocaleString()}`);
}

// Function to check if two bounties are equal
function areBountiesEqual(bounty1, bounty2) {
    return (
        bounty1.username === bounty2.username &&
        bounty1.subject === bounty2.subject &&
        bounty1.bountyAmount === bounty2.bountyAmount &&
        bounty1.status === bounty2.status &&
        bounty1.programmingLanguage === bounty2.programmingLanguage
    );
}

// Function to scrape the bounties from the Sphinx Chat website
async function scrapeBounties() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to the Sphinx Chat bounties page
    await page.goto('https://community.sphinx.chat/bounties', { waitUntil: 'domcontentloaded' });

    // Open the filter box
    const filterButtonSelector = '#root > div.app > div > div:nth-child(1) > div > div:nth-child(1) > div:nth-child(2) > div > div';
    console.log('Open filterbox');
    await page.waitForSelector(filterButtonSelector);
    await page.click(filterButtonSelector);

    // Wait for the filter selector to load
    const filterWindowSelector = '.CheckboxOuter input#Open';
    console.log('Wait for selector');
    await page.waitForSelector(filterWindowSelector);

    // Deactivate the filter
    console.log('Deactivate filter');
    await page.click(filterWindowSelector);

    // Wait for a short duration after deactivating the filter
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Close the filter box
    console.log('Close filterbox');
    await page.keyboard.press('Escape');

    // Wait for a short duration after closing the filter box
    await new Promise(resolve => setTimeout(resolve, 500));

    // Wait for the bounty selector to load
    console.log('Loading bounty selector');
    await page.waitForSelector('#root > div.app > div > div:nth-child(2)');

    console.log('Extracting...');
    
    // Extract the bounties from the page using JavaScript in the browser context
    const bounties = await page.evaluate(() => {
        const bountiesData = [];

        document.querySelectorAll('#root > div.app > div > div:nth-child(2) > a').forEach($bounty => {
            // Extracting bounty details using querySelectors
            const usernameSelector = 'div > div > div > div:nth-child(1) > div > div:nth-child(2)';
            const username = $bounty.querySelector(usernameSelector)?.textContent.trim() || '';

            const timestampSelector = 'div > div > div > div:nth-child(1) > div > div:nth-child(4)';
            const timestamp = $bounty.querySelector(timestampSelector)?.textContent.trim() || '';

            const subjectSelector = 'div > div > div > .sc-fzoyAV';
            const subjectElement = $bounty.querySelector(subjectSelector);
            const subject = subjectElement ? subjectElement.textContent.trim() : '';

            const profileImageSelector = '[src^="https://memes.sphinx.chat/public/"]';
            const profileImageElement = $bounty.querySelector(profileImageSelector);
            const profileImageUrl = profileImageElement ? profileImageElement.getAttribute('src') : '';

            const bountyAmountSelector = 'div > div > div > div:nth-child(6) > div > span:nth-child(1)';
            const bountyAmountElement = $bounty.querySelector(bountyAmountSelector);
            const bountyAmount = bountyAmountElement ? bountyAmountElement.textContent.trim() : '';

            const statusSelector = 'div > div > div > div:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div';
            const statusElement = $bounty.querySelector(statusSelector);
            const status = statusElement ? statusElement.textContent.trim() : '';

            const programmingLanguageSelector = 'div > div > div > div:nth-child(5)';
            const programmingLanguageElement = $bounty.querySelector(programmingLanguageSelector);
            const programmingLanguage = programmingLanguageElement ? programmingLanguageElement.textContent.trim() : '';

            // Create a bounty object and push it to the data array
            const bounty = {
                username,
                timestamp,
                subject,
                profileImageUrl,
                bountyAmount,
                status,
                programmingLanguage,
            };

            bountiesData.push(bounty);
        });

        return bountiesData;
    });

    // Close the Puppeteer browser
    await browser.close();

    return bounties;
}

// Function to post bounties to Discord
async function postBountiesToDiscord(bounties, bountyURL) {
    const channelID = process.env.DISCORD_CHANNEL_ID;

    // Fetch the Discord channel
    const channel = await client.channels.fetch(channelID);

    // Loop through each bounty and post it to Discord
    for (const bounty of bounties) {
        // Determine the color of the Discord embed based on the bounty status
        let color;

        switch (bounty.status.toLowerCase()) {
            case 'open':
                color = 0xFFD700; // yellow
                break;
            case 'assigned':
                color = 0x2ECC71; // green
                break;
            case 'complete':
                color = 0x618AFF; // sphinx blue
                break;
            default:
                color = 0x618AFF; // sphinx blue
        }

        // Check if programmingLanguage is empty and set it to 'other/not specified' if true
        const programmingLanguageValue = bounty.programmingLanguage || 'other/not specified';

        // Create the Discord embed object
        const embed = {
            type: 'rich',
            title: bounty.subject,
            description: '',
            color: color,
            fields: [
                {
                    name: 'Bounty',
                    value: bounty.bountyAmount + ' Sats',
                    inline: true,
                },
                {
                    name: 'Language(s)',
                    value: programmingLanguageValue,
                    inline: true,
                },
                {
                    name: 'Active at',
                    value: bounty.timestamp,
                    inline: true,
                }
            ],
            thumbnail: {
                url: 'https://play-lh.googleusercontent.com/0VUcv65NyZrSoXTAEIaVy8xJjZEYaFMWv1-elvSkIMHz368iReMyx3SXRenzBjijzcs=w240-h480-rw',
                height: 0,
                width: 0,
            },
            author: {
                name: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
            },
            footer: {
                text: 'from '+ bounty.username,
                icon_url: bounty.profileImageUrl,
            },
            url: bountyURL,
        };

        // Send the embed to the Discord channel
        await channel.send({ content: 'New bounty activity:', embeds: [embed] });
    }
}

// Function to get a status emoji based on the bounty status
function getStatusEmoji(status) {
    switch (status.toLowerCase()) {
        case 'open':
            return '🟡'; // yellow
        case 'assigned':
            return '🟢'; // green
        case 'complete':
            return '🔵'; // blue
        default:
            return '🔵'; // blue
    }
}

// Set an interval to run the scrapeAndPostBounties function every 24 hours
setInterval(scrapeAndPostBounties, 24 * 60 * 60 * 1000); // 24 hours (hr * min * sec * milisec)

// Run the initial scrape and post
scrapeAndPostBounties();
