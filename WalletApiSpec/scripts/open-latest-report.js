const fs = require('fs');
const path = require('path');
const open = require('open');

const reportDir = path.join(__dirname, '../cypress/reports');

try {
  const files = fs.readdirSync(reportDir)
    .filter(file => file.endsWith('.html'))
    .map(file => ({
      file,
      mtime: fs.statSync(path.join(reportDir, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.log('No HTML reports found.');
    process.exit(0);
  }

  const latestReport = path.join(reportDir, files[0].file);
  console.log(`Opening latest report: ${latestReport}`);
  open(latestReport);

} catch (err) {
  console.error('Error finding or opening latest report:', err);
  process.exit(1);
}
