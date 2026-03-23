import fs from 'fs';
const content = fs.readFileSync('server/index.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('executeQuery') && !line.includes('await')) {
    console.log(`${index + 1}: ${line}`);
  }
});
