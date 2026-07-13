const htmlValidator = require('html-validator');
const fs = require('fs');
const path = require('path');

function log(message, isError) {
  const logLabel = "11ty-plugin-html-validator: ";

  if (isError) {
    console.error(logLabel + message);
  } else {
    console.log(logLabel + message);
  }
}

async function validateHTMLFiles() {
  const buildOutputDirectory = path.resolve(__dirname, '../public'); // Adjust the path if needed
  const htmlFilePaths = [];

  function findHTMLFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        findHTMLFiles(filePath);
      } else if (filePath.endsWith('.html')) {
        htmlFilePaths.push(filePath);
      }
    });
  }

  findHTMLFiles(buildOutputDirectory);

  let everythingPassed = true;

  for (const [i, filePath] of htmlFilePaths.entries()) {
    if (fs.existsSync(filePath)) {
      try {
        let htmlContent = fs.readFileSync(filePath, 'utf8');

        // Remove <style> tags and their contents
        htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        const options = {
          format: 'text',
          data: htmlContent
        };

        const result = await htmlValidator(options);
        const pass = result.includes("The document validates according to the specified schema(s).");

        if (!pass) {
          everythingPassed = false;
          log(filePath + ' ❌', true);
          log(result);
        }
      } catch (error) {
        log(error, true);
      }
    }

    if (htmlFilePaths.length - 1 === i && everythingPassed) {
      log('All your HTML passed validation! 🎉');
    }
  }
}

validateHTMLFiles();
