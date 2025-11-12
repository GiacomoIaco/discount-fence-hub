const XLSX = require('xlsx');

const filePath = process.argv[2];
const workbook = XLSX.readFile(filePath);

console.log('=== SHEETS ===');
console.log(workbook.SheetNames.join(', '));
console.log('\n');

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=== SHEET: ${sheetName} ===\n`);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Print as a table
  data.forEach((row, idx) => {
    console.log(`Row ${idx + 1}: ${JSON.stringify(row)}`);
  });
});
