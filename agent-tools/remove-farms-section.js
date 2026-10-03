const fs = require('fs');
const filePath = 'D:/SEP490-FE/SEP490_SU26SE041_FE/src/components/dashboard/MonitoringDashboard.jsx';
let c = fs.readFileSync(filePath, 'utf8');
const lines = c.split(/\r?\n/);
// Xóa lines 743-797 (1-indexed) trong file gốc
// Mapping: file gốc hiển thị 810 lines. Phần "Nông Trại Đang Giám Sát" bắt đầu sau dòng 742, kéo dài đến dòng 797 (end của </div> đóng div)
// Cụ thể: từ "      {/* Farms summary */}" đến "      </div>" (closing div trước IoT Quick Manage Modal)
// Tôi tìm anchor chính xác
const startIdx = lines.findIndex(l => l.includes('{/* Farms summary */}'));
const endMarker = '{/* IoT Quick Manage Modal */}';
const endIdx = lines.findIndex(l => l.includes(endMarker));
console.log('Start:', startIdx, 'End:', endIdx);
console.log('Before-start:', lines[startIdx-1]);
console.log('Start:', lines[startIdx]);
console.log('End-2:', lines[endIdx-1]);
console.log('End-1:', lines[endIdx]);
// Xóa từ startIdx đến endIdx-1 (không xóa {IoT Quick Manage Modal})
if (startIdx >= 0 && endIdx > startIdx) {
  const removed = lines.splice(startIdx, endIdx - startIdx);
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
  console.log('Removed', removed.length, 'lines');
}