const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '..', 'Data_For_AI.xlsx'));
const out = { sheets: wb.SheetNames };
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  out[name] = { rows: data.length, headers: data[0] || [], sampleRow: data[1] || [] };
});
fs.writeFileSync(path.join(__dirname, '..', 'excel-sample.json'), JSON.stringify(out, null, 2));
console.log('Written excel-sample.json');
