/* Ephemeral chat UI. Never keep an API key or conversation in browser storage. */
(() => {
    const el = id => document.getElementById(id);
    const panel = el('financial-chat'), launcher = el('chat-launcher'), input = el('chat-input');
    const log = el('chat-messages'), send = el('chat-send'), error = el('chat-error');
    const welcome = log.innerHTML;
    let history = [], busy = false, controller = null, generation = 0;
    let activeAnalysisId = null;

    function updateContext() {
        const context = window.getFinancialChatContext?.() || {};
        const analysis = context.analysis;
        const id = analysis?.analysis_id || null;
        if (id !== activeAnalysisId) {
            const hadAnalysis = activeAnalysisId !== null;
            ++generation; controller?.abort(); controller = null; history = [];
            activeAnalysisId = id;
            setBusy(false); error.hidden = true;
            // The user asked to continue discussing the latest displayed Kronos result.
            // Nothing is sent to the provider until the user sends a question.
            el('chat-use-context').checked = Boolean(id);
            if (id || hadAnalysis) {
                const notice = document.createElement('div'); notice.className = 'chat-context-change';
                notice.textContent = id ? `Đã gắn kết quả Kronos: ${analysis.symbol || context.dataset_label || 'dự báo mới'}. Các câu hỏi tiếp theo sẽ bám vào kết quả này.` : 'Đã đổi dữ liệu. Chạy dự báo mới để tiếp tục trao đổi về kết quả Kronos.';
                log.appendChild(notice); log.scrollTop = log.scrollHeight;
            }
        }
        el('chat-context-label').textContent = analysis
            ? `${analysis.symbol || context.dataset_label || 'Kronos'} · ${analysis.forecast_summary.bars} nến dự báo · ${analysis.futures_scenario?.bias?.toUpperCase() || 'Kết quả vừa xem'}`
            : 'Chưa có kết quả Kronos. Hãy chạy dự báo trước.';
        return context;
    }
    function openChat(open) {
        panel.hidden = !open;
        launcher.setAttribute('aria-expanded', String(open));
        if (open) { updateContext(); checkConnection(); input.focus({ preventScroll: true }); }
        else launcher.focus({ preventScroll: true });
    }
    function updateProvider(status) {
        const provider = status.provider || 'AI';
        el('chat-provider-label').textContent = provider;
        el('chat-setup-title').textContent = `Chưa kết nối ${provider}`;
        el('chat-key-name').textContent = status.key_name || 'GEMINI_API_KEY';
        el('chat-provider-status').textContent = status.configured ? `${provider} · ${status.model}` : `${provider} · Chưa kết nối`;
    }
    async function checkConnection() {
        try {
            const response = await fetch('/api/chat/status', { cache: 'no-store' });
            if (!response.ok) throw new Error();
            const status = await response.json();
            updateProvider(status);
            el('chat-setup').hidden = status.configured;
        } catch {
            el('chat-provider-status').textContent = 'Chưa kết nối được máy chủ';
        }
    }
    function bubble(role, text) {
        const item = document.createElement('div');
        item.className = `chat-message chat-${role}`;
        const label = document.createElement('span');
        label.className = 'chat-message-label'; label.textContent = role === 'user' ? 'Bạn' : 'Trợ lý AI';
        const content = document.createElement('p'); content.textContent = text;
        item.append(label, content); log.appendChild(item); log.scrollTop = log.scrollHeight;
        return item;
    }
    function setBusy(value) {
        busy = value; send.disabled = value;
        log.setAttribute('aria-busy', String(value));
        panel.querySelectorAll('[data-chat-prompt]').forEach(button => { button.disabled = value; });
    }
    async function ask(message) {
        message = message.trim();
        if (busy || !message) return;
        if (message.length > 2000) { error.textContent = 'Câu hỏi tối đa 2.000 ký tự.'; error.hidden = false; return; }
        error.hidden = true;
        const context = updateContext();
        const payload = { message, history: history.slice(-12), include_context: el('chat-use-context').checked };
        if (payload.include_context) {
            if (!context.analysis) {
                error.textContent = 'Chưa có kết quả phân tích. Hãy chạy dự báo Kronos trước, hoặc bỏ chọn để hỏi kiến thức chung.';
                error.hidden = false; return;
            }
            payload.analysis = context.analysis;
        }
        bubble('user', message); input.value = '';
        const pending = document.createElement('div'); pending.className = 'chat-pending'; pending.textContent = 'Trợ lý đang suy nghĩ…';
        pending.setAttribute('role', 'status'); log.appendChild(pending); log.scrollTop = log.scrollHeight;
        setBusy(true);
        const requestController = new AbortController();
        controller = requestController;
        const current = ++generation;
        const timeout = setTimeout(() => requestController.abort(), 55000);
        try {
            const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: requestController.signal });
            let result;
            try { result = await response.json(); } catch { throw new Error('Máy chủ chưa phản hồi đúng định dạng. Hãy thử lại sau.'); }
            if (current !== generation) return;
            if (!response.ok) {
                if (result.code === 'not_configured') { el('chat-setup').hidden = false; updateProvider(result); }
                throw new Error(result.error || 'Chưa nhận được phản hồi. Bạn thử lại nhé.');
            }
            bubble('assistant', result.reply);
            history.push({ role: 'user', content: message }, { role: 'assistant', content: result.reply.slice(0, 2000) });
            history = history.slice(-12);
        } catch (failure) {
            if (current !== generation) return;
            error.textContent = failure.name === 'AbortError' ? 'Yêu cầu đã quá thời gian chờ. Bạn thử gửi lại nhé.' : failure.message || 'Mất kết nối. Hãy thử lại.';
            error.hidden = false;
            if (!input.value.trim()) input.value = message;
        } finally {
            clearTimeout(timeout); pending.remove();
            if (current === generation) { controller = null; setBusy(false); }
        }
    }
    window.addEventListener('financial-analysis-changed', updateContext);
    el('chat-about-analysis')?.addEventListener('click', () => { openChat(true); el('chat-use-context').checked = true; });
    launcher.addEventListener('click', () => openChat(panel.hidden));
    el('chat-close').addEventListener('click', () => openChat(false));
    el('chat-recheck').addEventListener('click', checkConnection);
    el('chat-use-context').addEventListener('change', updateContext);
    el('chat-form').addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); ask(input.value); }
    });
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); openChat(false); } });
    panel.querySelectorAll('[data-chat-prompt]').forEach(button => button.addEventListener('click', () => ask(button.dataset.chatPrompt)));
    el('chat-clear').addEventListener('click', () => {
        ++generation; controller?.abort(); controller = null; history = [];
        log.innerHTML = welcome; error.hidden = true; setBusy(false); input.value = ''; input.focus(); updateContext();
    });
})();
