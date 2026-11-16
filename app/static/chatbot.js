/* Ephemeral chat UI. Never keep an API key or conversation in browser storage. */
(() => {
    const el = id => document.getElementById(id);
    const panel = el('financial-chat'), launcher = el('chat-launcher'), input = el('chat-input');
    const log = el('chat-messages'), send = el('chat-send'), error = el('chat-error');
    const welcome = log.innerHTML;
    let history = [], busy = false, controller = null, generation = 0;

    function updateContext() {
        const context = window.getFinancialChatContext?.() || {};
        el('chat-context-label').textContent = context.dataset_label || 'Chưa chọn dữ liệu';
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
        const payload = { message, history: history.slice(-12), include_context: el('chat-use-context').checked };
        if (payload.include_context) Object.assign(payload, updateContext());
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
