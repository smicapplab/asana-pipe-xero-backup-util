const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const apiToken = process.env.WEBFLOW_API_TOKEN
const siteId = process.env.WEBFLOW_SITE_ID

const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'accept-version': '1.0.0',
};

// Function to fetch collections
async function fetchCollections() {
    const collectionsUrl = `https://api.webflow.com/sites/${siteId}/collections`;
    try {
        const response = await axios.get(collectionsUrl, { headers });
        return response.data;
    } catch (error) {
        console.error('Error fetching collections:', error.response ? error.response.data : error.message);
        return [];
    }
}

// Function to fetch items from a collection
async function fetchCollectionItems(collectionId) {
    const itemsUrl = `https://api.webflow.com/collections/${collectionId}/items`;
    try {
        const response = await axios.get(itemsUrl, { headers });
        return response.data.items;
    } catch (error) {
        console.error(`Error fetching items for collection ${collectionId}:`, error.response ? error.response.data : error.message);
        return [];
    }
}

// Function to download assets
async function downloadAsset(url, filepath) {
    try {
        const response = await axios.get(url, { responseType: 'stream' });
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading asset ${url}:`, error.response ? error.response.data : error.message);
    }
}

// Function to extract image URLs from HTML content
function extractImageUrlsFromHtml(html) {
    const dom = new JSDOM(html);
    const images = dom.window.document.querySelectorAll('img');
    return Array.from(images).map(img => img.src);
}

// Function to process the items JSON file
async function processItemsFile(filePath) {
    const itemsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const assetUrls = itemsData.flatMap(item => {
        const urls = [];
        if (item) {
            if (item.image) urls.push(item.image);
            if (item.postImage) urls.push(item.postImage);
            if (item['article-image'] && item['article-image'].url) urls.push(item['article-image'].url);
            if (item['article-header-image'] && item['article-header-image'].url) urls.push(item['article-header-image'].url);
            if (item['post-content']) {
                urls.push(...extractImageUrlsFromHtml(item['post-content']));
            }
        }
        return urls;
    });

    if (assetUrls.length === 0) {
        console.log('No assets found in the provided items.');
    } else {
        for (const assetUrl of assetUrls) {
            const assetName = path.basename(new URL(assetUrl).pathname);
            const assetPath = path.join('assets', assetName);
            fs.mkdirSync('assets', { recursive: true });
            try {
                await downloadAsset(assetUrl, assetPath);
            } catch (error) {
                console.error(`Failed to download asset: ${assetUrl}`);
            }
        }
    }
}

async function BackupWebFlow() {
    try {
        const collections = await fetchCollections();

        for (const collection of collections) {
            const collectionId = collection._id;
            const collectionName = collection.name.replace(/\s+/g, '_');
            const items = await fetchCollectionItems(collectionId);

            // Save items to a JSON file
            fs.writeFileSync(`${collectionName}_items.json`, JSON.stringify(items, null, 4));
            console.log(`Backed up collection: ${collectionName}`);

        }

        await processItemsFile("./Categories_items.json")
        await processItemsFile("./Posts_items.json")
        await processItemsFile("./Team_Members_items.json")
        await processItemsFile("./Tags_items.json")

    } catch (error) {
        console.error('Error backing up Webflow content:', error);
    }
}

module.exports = {BackupWebFlow}