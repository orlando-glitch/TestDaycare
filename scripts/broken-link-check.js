const { SiteChecker } = require('broken-link-checker');

let linkCheckCount = 0;
let validLinkCheckCount = 0;
let invalidLinkCheckCount = 0;
let brokenLinks = [];

const updateLog = (message) => {
  process.stdout.clearLine();  // clear the current line
  process.stdout.cursorTo(0);  // move the cursor to the beginning of the line
  process.stdout.write(message);
};

const siteChecker = new SiteChecker(
  { excludeInternalLinks: false, excludeExternalLinks: false, followRobotExclusion: false, filterLevel: 3, },
  {
    link: (result) => {
      linkCheckCount++;
      if (result.broken) {
        invalidLinkCheckCount++;
        brokenLinks.push(`Broken link found: ${result.url.original} (Reason: ${result.brokenReason})`);
      } else {
        validLinkCheckCount++;
      }
      const status = `Total links checked: ${linkCheckCount} | Valid links: ${validLinkCheckCount} | Invalid links: ${invalidLinkCheckCount}`;
      updateLog(status);
    },
    end: () => {
      console.log('\nLink check completed!');
      if (brokenLinks.length > 0) {
        console.log('Broken links:');
        brokenLinks.forEach((link) => console.log(link));
      } else {
        console.log('No broken links found.');
      }
    },
  }
);

siteChecker.enqueue('http://localhost:8080');
