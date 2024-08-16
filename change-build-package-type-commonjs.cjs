const fs = require('fs');
const path = require('path');

const packageJsonPath = path.resolve(__dirname, './build/package.json');

fs.readFile(packageJsonPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading package.json:', err);
    process.exit(1);
  }

  const packageJson = JSON.parse(data);
  packageJson.type = 'commonjs';

  fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing package.json:', err);
      process.exit(1);
    }

    console.log('build package.json type updated to commonjs');
  });
});
