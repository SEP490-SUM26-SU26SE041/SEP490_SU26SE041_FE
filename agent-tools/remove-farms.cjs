const fs = require('fs');
const filePath = 'D:/SEP490-FE/SEP490_SU26SE041_FE/src/components/dashboard/MonitoringDashboard.jsx';
let c = fs.readFileSync(filePath, 'utf8');
const lines = c.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes('{/* Farms summary */}'));
const endIdx = lines.findIndex(l => l.includes('{/* IoT Quick Manage Modal */}'));
console.log('Start:', startIdx, 'End:', endIdx);
if (startIdx >= 0 && endIdx > startIdx) {
  const removed = lines.splice(startIdx, endIdx - startIdx);
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
  console.log('Removed', removed.length, 'lines. New total:', lines.length);
} else {
  console.log('Markers not found');
}