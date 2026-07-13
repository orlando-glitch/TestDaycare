const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const OpenAI = require('openai');
const { glob } = require('glob');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SRC_CONTENT_DIR = path.join(__dirname, '..', 'src', 'content');
const SRC_ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets', 'images');
const PUBLIC_ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets', 'images');
const PROCESSED_LOG_FILE = path.join(__dirname, '.processed-images.json');

console.log('🚀 Starting AI-Powered Image Optimizer for SEO');
console.log('📁 Source content directory:', SRC_CONTENT_DIR);
console.log('🖼️  Image directories:', SRC_ASSETS_DIR, '&', PUBLIC_ASSETS_DIR);

// Initialize OpenAI client
console.log('🔑 Initializing OpenAI client...');
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});
console.log('✅ OpenAI client initialized successfully');

// Track processed images to avoid duplicate processing
const processedImages = new Map();

/**
 * Load processed images log from file
 */
async function loadProcessedLog() {
    try {
        const data = await fs.readFile(PROCESSED_LOG_FILE, 'utf-8');
        const log = JSON.parse(data);
        let count = 0;
        
        // Load into processedImages Map
        for (const [key, value] of Object.entries(log)) {
            processedImages.set(key, value);
            count++;
        }
        
        if (count > 0) {
            console.log(`📋 Loaded ${count} previously processed image(s) from log`);
        }
    } catch (error) {
        // File doesn't exist or is invalid - that's okay for first run
        console.log('📝 No previous log found - starting fresh');
    }
}

/**
 * Save processed images log to file
 */
async function saveProcessedLog() {
    try {
        // Convert Map to plain object for JSON serialization
        const logData = {};
        for (const [key, value] of processedImages) {
            // Only save entries with full data (not just references)
            if (value.oldPath) {
                logData[key] = {
                    oldPath: value.oldPath,
                    newPath: value.newPath,
                    altText: value.altText,
                    processedAt: value.processedAt || new Date().toISOString()
                };
            }
        }
        
        await fs.writeFile(PROCESSED_LOG_FILE, JSON.stringify(logData, null, 2), 'utf-8');
        console.log('💾 Saved processed images log');
    } catch (error) {
        console.error('⚠️  Warning: Could not save log file:', error.message);
    }
}

// Removed extractKeywordsFromDescription - let AI extract keywords directly

/**
 * Extract frontmatter from HTML file
 */
async function extractFrontmatter(filePath) {
    console.log('  📄 Reading file:', path.basename(filePath));
    const content = await fs.readFile(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) return null;
    
    const frontmatter = {};
    const lines = frontmatterMatch[1].split('\n');
    
    for (const line of lines) {
        const match = line.match(/^(\w+):\s*['"]?([^'"]+)['"]?/);
        if (match) {
            frontmatter[match[1]] = match[2].trim();
        }
    }
    
    return frontmatter;
}

/**
 * Get keywords for a page based on its frontmatter
 */
async function getPageKeywords(filePath) {
    const frontmatter = await extractFrontmatter(filePath);
    if (!frontmatter) return 'preschool, puyallup, buttons and bows';
    
    // First, check if keywords attribute exists
    if (frontmatter.keywords) {
        console.log('  Using keywords attribute from frontmatter');
        return frontmatter.keywords;
    }
    
    // Otherwise, use description as-is (let AI extract keywords)
    if (frontmatter.description) {
        console.log('  Using description attribute from frontmatter');
        return frontmatter.description;
    }
    
    return 'preschool, puyallup, buttons and bows';
}

/**
 * Extract all image paths from an HTML file
 */
async function extractImagesFromHTML(filePath) {
    console.log('  🔍 Extracting images from HTML...');
    const content = await fs.readFile(filePath, 'utf-8');
    const images = [];
    
    // Pattern to match image sources in various formats
    const patterns = [
        // Match {% getUrl '/assets/images/...' %}
        /{% getUrl ['"]([^'"]+)['"] /g,
        // Match src="/assets/images/..."
        /src=["']([^"']*\/assets\/images\/[^"']+)["']/g,
        // Match srcset="/assets/images/..."
        /srcset=["']([^"']*\/assets\/images\/[^"']+)["']/g,
    ];
    
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const imagePath = match[1];
            // Skip SVG files and ignore decorative images
            if (!imagePath.includes('.svg') && !imagePath.includes('logo')) {
                // Normalize path
                const normalizedPath = imagePath.replace(/^\//, '');
                if (!images.includes(normalizedPath)) {
                    images.push(normalizedPath);
                }
            }
        }
    });
    
    return images;
}

/**
 * Find the actual image file in the filesystem
 */
async function findImageFile(imagePath) {
    // Remove leading slash and normalize
    const normalizedPath = imagePath.replace(/^\//, '');
    console.log('  📂 Looking for image:', normalizedPath);
    
    // Try src/assets/images first
    const srcPath = path.join(__dirname, '..', 'src', normalizedPath);
    try {
        await fs.access(srcPath);
        return srcPath;
    } catch (e) {
        // Try public/assets/images
        const publicPath = path.join(__dirname, '..', 'public', normalizedPath);
        try {
            await fs.access(publicPath);
            return publicPath;
        } catch (e) {
            return null;
        }
    }
}

/**
 * Convert image to base64 for OpenAI API
 */
async function imageToBase64(imagePath) {
    console.log('  🔄 Converting image to Base64...');
    const imageBuffer = await fs.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    console.log('  ✅ Base64 conversion complete');
    
    const ext = path.extname(imagePath).toLowerCase();
    
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.avif') mimeType = 'image/avif';
    
    return `data:${mimeType};base64,${base64}`;
}

/**
 * Call OpenAI Vision API to get image name and alt text
 */
async function analyzeImageWithAI(imagePath, keywords) {
    console.log(`  🤖 Analyzing image with AI: ${path.basename(imagePath)}`);
    console.log('  📝 Using keywords/context:', keywords);
    
    const base64Image = await imageToBase64(imagePath);
    
    const prompt = `Look at the attached image and come up with image file names and alt text that are descriptive and keyword-relevant. 

Context/Keywords for SEO: ${keywords}

(Note: The above may be keywords or a full description - extract the most relevant keywords from it to use in your filename and alt text suggestions.)

Original Image Name: ${path.basename(imagePath)}

Instructions:
- Image Name: Create a descriptive filename that integrates the most relevant keywords from the context above. Keep it under 40–60 characters and use hyphens between words, not underscores or spaces. The filename should be SEO-friendly and accurately describe what's in the image.
- Image Alt-text: Write a concise, accurate description of the image that naturally includes relevant keywords from the context. It should serve both SEO and accessibility purposes. Recommended length: 80–125 characters. Avoid keyword stuffing, and don't start with "image of" or "photo of."

Remember, the filename and alt text should be informative, relevant to the image content, and crafted to enhance SEO. Avoid making them too lengthy or stuffing them with keywords.

Please respond in JSON format:
{
  "originalName": "...",
  "newName": "...",
  "altText": "..."
}`;

    try {
        console.log('  ⏳ Sending request to OpenAI API...');
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64Image
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500
        });
        
        console.log('  ✅ Received response from OpenAI');
        const content = response.choices[0].message.content;
        
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return result;
        }
        
        // Fallback: parse manually
        const nameMatch = content.match(/Image Name[:\s]+([^\n]+)/i);
        const altMatch = content.match(/Alt[-\s]?text[:\s]+([^\n]+)/i);
        
        return {
            originalName: path.basename(imagePath),
            newName: nameMatch ? nameMatch[1].trim() : path.basename(imagePath),
            altText: altMatch ? altMatch[1].trim() : ''
        };
        
    } catch (error) {
        console.error(`  Error analyzing image: ${error.message}`);
        return null;
    }
}

/**
 * Rename the physical image file
 */
async function renameImageFile(oldPath, newName) {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    
    // Ensure the new name has the correct extension
    let finalName = newName;
    if (!finalName.endsWith(ext)) {
        finalName = finalName.replace(/\.[^.]+$/, '') + ext;
    }
    
    // Sanitize filename
    finalName = finalName
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    let newPath = path.join(dir, finalName);
    
    // Check if file with this name already exists (prevent conflicts)
    let counter = 1;
    while (await fs.access(newPath).then(() => true).catch(() => false)) {
        // If the existing file is the same as oldPath, it's fine
        if (path.resolve(newPath) === path.resolve(oldPath)) {
            break;
        }
        
        // Otherwise, add a number suffix
        const nameWithoutExt = finalName.replace(ext, '');
        const numberedName = `${nameWithoutExt}-${counter}${ext}`;
        newPath = path.join(dir, numberedName);
        counter++;
        console.log(`  ⚠️  File exists, trying: ${numberedName}`);
    }
    
    if (oldPath !== newPath) {
        await fs.rename(oldPath, newPath);
        console.log(`  ✅ Renamed: ${path.basename(oldPath)} → ${path.basename(newPath)}`);
    }
    
    return newPath;
}

/**
 * Update all HTML files that reference an image
 */
async function updateHTMLReferences(oldImagePath, newImagePath, altText) {
    console.log('  🔧 Updating HTML references...');
    const oldBasename = path.basename(oldImagePath);
    const newBasename = path.basename(newImagePath);
    
    if (oldBasename === newBasename && !altText) {
        console.log('  ℹ️  No changes needed');
        return; // No changes needed
    }
    
    // Find all HTML files
    console.log('  🔍 Searching for HTML files to update...');
    const htmlFiles = await glob('**/*.html', {
        cwd: SRC_CONTENT_DIR,
        absolute: true
    });
    
    for (const htmlFile of htmlFiles) {
        let content = await fs.readFile(htmlFile, 'utf-8');
        let modified = false;
        
        // Update filename references
        if (oldBasename !== newBasename) {
            const oldPathPattern = new RegExp(oldBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            if (oldPathPattern.test(content)) {
                content = content.replace(oldPathPattern, newBasename);
                modified = true;
            }
        }
        
        // Update alt text if provided
        if (altText) {
            // Find img tags with this image and update alt text
            const imgPattern = new RegExp(
                `(<img[^>]+src=[^>]*${newBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]+)alt=["']([^"']*)["']`,
                'g'
            );
            
            content = content.replace(imgPattern, (match, before, oldAlt) => {
                // Skip if alt is empty (aria-hidden="true" images)
                if (match.includes('aria-hidden="true"')) {
                    return match;
                }
                modified = true;
                return `${before}alt="${altText}"`;
            });
        }
        
        if (modified) {
            await fs.writeFile(htmlFile, content, 'utf-8');
            console.log(`  Updated: ${path.relative(SRC_CONTENT_DIR, htmlFile)}`);
        }
    }
}

/**
 * Process a single image
 */
async function processImage(imagePath, keywords, htmlFile) {
    // Check if already processed by basename
    const imageKey = path.basename(imagePath).toLowerCase();
    if (processedImages.has(imageKey)) {
        const cached = processedImages.get(imageKey);
        console.log(`  ⏭️  Skipping already processed: ${path.basename(imagePath)}`);
        if (cached.processedAt) {
            console.log(`     (Processed on: ${new Date(cached.processedAt).toLocaleString()})`);
        }
        return cached;
    }
    
    // Find the actual file
    const actualPath = await findImageFile(imagePath);
    if (!actualPath) {
        console.log(`  ⚠️  Image file not found: ${imagePath}`);
        return null;
    }
    
    // Double-check: if the actual file path matches a processed file's newPath, skip it
    for (const [key, value] of processedImages) {
        if (value.newPath && path.resolve(value.newPath) === path.resolve(actualPath)) {
            console.log(`  ⏭️  Skipping already processed: ${path.basename(actualPath)}`);
            console.log(`     (File already renamed, found in log)`);
            // Add current basename to map for future lookups
            processedImages.set(imageKey, value);
            return value;
        }
    }
    
    // Analyze with AI
    const analysis = await analyzeImageWithAI(actualPath, keywords);
    if (!analysis) {
        return null;
    }
    
    console.log(`  Suggested name: ${analysis.newName}`);
    console.log(`  Alt text: ${analysis.altText}`);
    
    // Rename the file
    const newPath = await renameImageFile(actualPath, analysis.newName);
    
    // Update all HTML references
    await updateHTMLReferences(actualPath, newPath, analysis.altText);
    
    // Store in processed map with multiple keys for lookups
    const result = {
        oldPath: path.resolve(actualPath),
        newPath: path.resolve(newPath),
        altText: analysis.altText,
        processedAt: new Date().toISOString()
    };
    
    // Store under original basename
    processedImages.set(path.basename(actualPath).toLowerCase(), result);
    // Store under new basename (in case it appears with new name on other pages)
    processedImages.set(path.basename(newPath).toLowerCase(), result);
    
    // Save log after each successful processing
    await saveProcessedLog();
    
    return result;
}

/**
 * Process a single HTML page
 */
async function processPage(htmlFile) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processing: ${path.relative(SRC_CONTENT_DIR, htmlFile)}`);
    console.log('='.repeat(60));
    
    // Get keywords for this page
    console.log('🔑 Extracting keywords...');
    const keywords = await getPageKeywords(htmlFile);
    console.log(`Keywords: ${keywords}`);
    
    // Extract all images from this page
    const images = await extractImagesFromHTML(htmlFile);
    console.log(`Found ${images.length} image(s)`);
    
    // Process each image
    for (const imagePath of images) {
        await processImage(imagePath, keywords, htmlFile);
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  🚀 AI-Powered Image Optimizer for SEO');
    console.log('='.repeat(60));
    
    if (!OPENAI_API_KEY) {
        console.error('\n❌ Error: OPENAI_API_KEY environment variable is not set');
        console.error('💡 Please set it with: $env:OPENAI_API_KEY="your-api-key-here"');
        console.error('📖 See SETUP-API-KEY.md for detailed instructions\n');
        process.exit(1);
    }
    
    console.log('\n✅ API key found');
    
    // Load previously processed images log
    await loadProcessedLog();
    
    console.log('🏠 Starting with home page...\n');
    
    // Process home page first (index.html)
    const indexPath = path.join(SRC_CONTENT_DIR, 'index.html');
    try {
        await processPage(indexPath);
    } catch (error) {
        console.error(`Error processing home page: ${error.message}`);
    }
    
    // Process all pages in the pages folder
    console.log('\n' + '='.repeat(60));
    console.log('📚 Now processing all pages in pages/ folder...');
    console.log('='.repeat(60));
    
    // Use glob with proper options to find all HTML files in subdirectories
    const pageFiles = await glob('pages/**/*.html', {
        cwd: SRC_CONTENT_DIR,
        absolute: true
    });
    
    console.log(`📋 Found ${pageFiles.length} page(s) to process`);
    if (pageFiles.length > 0) {
        console.log('📂 Pages found:');
        pageFiles.forEach(file => {
            console.log(`   - ${path.relative(SRC_CONTENT_DIR, file)}`);
        });
    }
    console.log();
    
    for (const pageFile of pageFiles) {
        try {
            await processPage(pageFile);
        } catch (error) {
            console.error(`Error processing ${pageFile}: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`  ✅ Complete! Total unique images: ${processedImages.size}`);
    console.log('='.repeat(60) + '\n');
    
    // Count new vs existing
    let newlyProcessed = 0;
    let skipped = 0;
    for (const [key, value] of processedImages) {
        if (value.oldPath) {
            const processedDate = new Date(value.processedAt);
            const isRecent = (Date.now() - processedDate.getTime()) < 60000; // Last minute
            if (isRecent) {
                newlyProcessed++;
            } else {
                skipped++;
            }
        }
    }
    
    console.log(`📊 Session Statistics:`);
    console.log(`   🆕 Newly processed: ${newlyProcessed}`);
    console.log(`   ⏭️  Skipped (from log): ${skipped}`);
    console.log(`   📋 Total in log: ${processedImages.size}\n`);
    
    // Summary
    console.log('Summary of changes:');
    for (const [key, value] of processedImages) {
        if (value.oldPath) {
            console.log(`\n${path.basename(value.oldPath)}`);
            console.log(`  → ${path.basename(value.newPath)}`);
            console.log(`  Alt: ${value.altText}`);
        }
    }
}

// Run the script
main().catch(console.error);
