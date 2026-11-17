// Price/time readouts use plot-local pixels, including separate volume axes.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const context = { console, Intl, document: { addEventListener() {} }, window: { addEventListener() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync('app/static/dashboard.js', 'utf8'), context);
const layout = {
    xaxis: { _offset: 60, _length: 800, p2d: pixel => `2026-11-17 10:${String(Math.round(pixel / 20)).padStart(2, '0')}:00` },
    yaxis: { _offset: 40, _length: 300, p2d: pixel => 70000 - pixel * 100 },
    yaxis2: { _offset: 380, _length: 100, p2d: pixel => 1000000 - pixel * 10000 },
};
context.layout = layout;
let result = vm.runInContext('chartCursorReadout(layout, 260, 140)', context);
assert.equal(result.value, 60000);
assert.equal(result.time, '2026-11-17 10:10:00');
assert.equal(result.activity, false);
assert.equal(result.top, 40);
assert.equal(result.bottom, 480);
result = vm.runInContext('chartCursorReadout(layout, 260, 430)', context);
assert.equal(result.value, 500000);
assert.equal(result.activity, true);
assert.equal(vm.runInContext('chartCursorReadout(layout, 59, 140)', context), null);
assert.equal(vm.runInContext('chartCursorReadout(layout, 861, 140)', context), null);
assert.equal(vm.runInContext('chartCursorReadout(layout, 260, 360)', context), null);
assert.equal(vm.runInContext('chartCursorReadout(undefined, 260, 140)', context), null);
assert.equal(vm.runInContext("formatChartCursorTime('2026-11-17 09:15:00.123')", context), '17/11/2026 09:15');
assert.equal(vm.runInContext("formatChartCursorTime('2026-11-17')", context), '17/11/2026');
console.log('PASS: cursor axis offsets, price and volume conversion, bounds, gaps and local time labels.');
