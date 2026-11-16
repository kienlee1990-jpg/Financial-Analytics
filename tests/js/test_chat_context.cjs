// Exercise the real dashboard renderer and chat transport with a lightweight DOM.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
class Element {
    constructor() { this.listeners = {}; this.hidden = false; this.checked = false; this.value = ''; this.children = []; this.style = {}; this.textContent = ''; this.innerHTML = 'welcome'; this.attrs = {}; this.dataset = {}; this.classList = { add() {}, remove() {}, contains: () => false }; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(k, v) { this.attrs[k] = v; }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); }
    querySelectorAll() { return []; }
    focus() {} remove() { this.removed = true; }
    trigger(name, event = {}) { return this.listeners[name]?.({ preventDefault() {}, stopPropagation() {}, ...event }); }
}
const elements = new Map(), listeners = new Map(), calls = [];
function el(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }
const document = { getElementById: el, createElement: () => new Element(), addEventListener() {}, body: { dataset: { theme: 'light' } } };
const window = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
};
const context = { console, window, document, Intl, AbortController, setTimeout, clearTimeout, CustomEvent: class { constructor(type) { this.type = type; } }, fetch: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => url.includes('status') ? { configured: true, provider: 'Gemini', model: 'test' } : { reply: 'TP2 của kịch bản vừa xem là 94.000 VND.' } };
} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('app/static/dashboard.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('app/static/chatbot.js', 'utf8'), context);
vm.runInContext("renderPredictionChart = () => {}; currentPriceScale = 1000; currentPriceUnit = 'VND'; currentDataFile = 'memory://gone/vnstock_FPT_1h.csv';", context);
el('instrument-symbol').textContent = 'FPT';
const fixture = {
    chart: JSON.stringify({ data: [{ type: 'candlestick', name: 'Dữ liệu lịch sử', close: Array(100).fill(100) }] }),
    prediction_type: 'Dự báo 2 nến tiếp theo', reference_data: { close: 100, timestamp: '2026-11-16T10:00:00Z' },
    prediction_results: [{ open: 100, high: 101, low: 94, close: 95, timestamp: '2026-11-16T11:00:00Z' }, { open: 95, high: 96, low: 88, close: 90, timestamp: '2026-11-16T12:00:00Z' }],
    futures_scenario: { bias: 'short', reference_close: 100, atr14: 2, atr14_pct: 2, forecast_change_pct: -10, direction_threshold_pct: 0.5, entry_zone: [99, 101], stop_loss: 103, take_profit_1: 97, take_profit_2: 94, tp1_within_forecast: true, tp2_within_forecast: true },
    forecast_horizon: { bars: 2, interval_minutes: 60, duration_hours: 2, start: '2026-11-16T11:00:00Z', end: '2026-11-16T12:00:00Z', style: 'Ngắn hạn' },
    context_analysis: { recent_mean_change_pct: -2, recent_range_pct: 2, comparison_candles: 20 }, has_comparison: false,
};
context.fixture = fixture;
const flush = () => new Promise(resolve => setImmediate(resolve));
async function ask(text) { el('chat-input').value = text; el('chat-form').trigger('submit'); await flush(); }
(async () => {
    vm.runInContext('displayPredictionResult(fixture)', context);
    assert.equal(calls.length, 0, 'Rendering a forecast must not call an AI API');
    assert(el('chat-use-context').checked, 'New displayed result attaches for follow-up questions');
    const snapshot = window.getFinancialChatContext().analysis;
    assert.equal(snapshot.forecast_summary.final_close, 90000);
    assert.equal(snapshot.futures_scenario.take_profit_2, 94000);
    assert.equal(snapshot.futures_scenario.stop_loss, 103000);
    assert(snapshot.displayed_analysis.scenario_bias.includes('SHORT'));
    assert(snapshot.displayed_analysis.calculation.includes('ATR'));
    assert(snapshot.displayed_analysis.projected_move.includes('giảm'));
    assert(snapshot.direction_estimate.percent > 0);
    const id = snapshot.analysis_id;
    snapshot.futures_scenario.stop_loss = 0;
    assert.equal(window.getFinancialChatContext().analysis.futures_scenario.stop_loss, 103000, 'Snapshot consumers cannot mutate the displayed result');
    await ask('Vì sao hướng này?');
    await ask('Vậy TP2 thì sao?');
    const requests = calls.filter(call => call.url === '/api/chat').map(call => JSON.parse(call.options.body));
    assert.equal(requests[0].analysis.analysis_id, id);
    assert(!requests[0].file_path, 'Follow-up context must not rely on loading the CSV');
    assert.equal(requests[1].analysis.futures_scenario.take_profit_2, 94000);
    assert.equal(requests[1].history.length, 2, 'Conversation continues for the same analysis');
    vm.runInContext('displayPredictionResult(fixture)', context);
    await ask('Kết quả mới ra sao?');
    const latest = JSON.parse(calls[calls.length - 1].options.body);
    assert.notEqual(latest.analysis.analysis_id, id);
    assert.equal(latest.history.length, 0, 'A new result must not inherit the previous analysis conversation');
    vm.runInContext('clearAnalysisForChat()', context);
    assert(!el('chat-use-context').checked);
    await ask('MA là gì?');
    const general = JSON.parse(calls[calls.length - 1].options.body);
    assert(!general.include_context && !general.analysis);
    console.log('PASS: rendered scenario, price scaling, follow-up history, snapshot isolation, switching results and no CSV dependency.');
})().catch(error => { console.error(error); process.exitCode = 1; });
