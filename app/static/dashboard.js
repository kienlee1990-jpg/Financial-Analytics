        // Global variables
        const temporaryDatasetPaths = new Set();
        let latestPredictionForChat = null;
        let latestAnalysisForChat = null;
        let analysisSequence = 0;
        let currentDataFile = null;
        let currentDataInfo = null;
        let currentLookback = 400;
        const predictionHorizon = 120;
        let availableModels = [];
        let modelLoaded = false;
        let rawPredictionChart = null;
        let chartWheelZoomEnabled = false;
        let chartRangeToRestore = null;
        let currentPriceUnit = 'USDT';
        let currentPriceScale = 1;

        function formatPrice(value) {
            const scaledValue = Number(value) * currentPriceScale;
            const digits = currentPriceUnit === 'VND' ? 0 : 4;
            return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(scaledValue)} ${currentPriceUnit}`;
        }

        // Initialize after page loads
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('chart').addEventListener('click', activateChartScrollZoom);
            initializeApp();
        });

        // Initialize application
        async function initializeApp() {
            console.log('🚀 Đang khởi tạo Financial Forecast...');

            setupEventListeners();
            initializeTimeSlider();
            selectMarketTab('coin-tab');

            // Load available models
            await loadAvailableModels();

            // Load data file list
            await loadDataFiles();

            // Load searchable Binance Spot pair suggestions
            await loadBinanceSymbols();

            // Load searchable Vietnamese equity suggestions
            await loadVnstockSymbols();



            console.log('✅ Khởi tạo giao diện hoàn tất');
        }

        // Load available models
        async function loadAvailableModels() {
            try {
                const response = await axios.get('/api/available-models');
                if (response.data.model_available) {
                    availableModels = response.data.models;
                    populateModelSelect();
                    console.log('✅ Available models loaded successfully:', availableModels);
                } else {
                    console.warn('⚠️ Thư viện mô hình dự báo không khả dụng');
                    showStatus('warning', 'Không tải được thư viện mô hình dự báo; hệ thống sẽ dùng dữ liệu mô phỏng.');
                }
            } catch (error) {
                console.error('❌ Lỗi tải danh sách mô hình:', error);
                showStatus('error', 'Không tải được danh sách mô hình.');
            }
        }

        // Populate model selection dropdown
        function populateModelSelect() {
            const modelSelect = document.getElementById('model-select');
            modelSelect.innerHTML = '<option value="">Vui lòng chọn mô hình</option>';

            Object.entries(availableModels).forEach(([key, model]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${model.name} (${model.params}) - ${model.description}`;
                modelSelect.appendChild(option);
            });
        }

        // Load model
        async function loadModel() {
            const modelKey = document.getElementById('model-select').value;
            const device = document.getElementById('device-select').value;

            if (!modelKey) {
                showStatus('error', 'Vui lòng chọn mô hình cần tải.');
                return;
            }

            try {
                showLoading(true);
                document.getElementById('load-model-btn').disabled = true;

                const response = await axios.post('/api/load-model', {
                    model_key: modelKey,
                    device: device
                });

                if (response.data.success) {
                    modelLoaded = true;
                    showStatus('success', response.data.message);
                    updateModelStatus();
                    document.getElementById('predict-btn').disabled = false;
                    console.log('✅ Model loaded successfully:', response.data.model_info);
                } else {
                    showStatus('error', response.data.error);
                }
            } catch (error) {
                console.error('❌ Lỗi tải mô hình:', error);
                showStatus('error', `Tải mô hình thất bại: ${error.response?.data?.error || error.message}`);
            } finally {
                showLoading(false);
                document.getElementById('load-model-btn').disabled = false;
            }
        }

        // Update model status
        async function updateModelStatus() {
            try {
                const response = await axios.get('/api/model-status');
                const status = response.data;

                if (status.loaded) {
                    showStatus('success', `Đã tải mô hình ${status.current_model.name} trên ${status.current_model.device}`);
                } else if (status.available) {
                    showStatus('info', 'Mô hình sẵn sàng nhưng chưa được tải.');
                } else {
                    showStatus('warning', 'Không có thư viện mô hình.');
                }
            } catch (error) {
                console.error('❌ Failed to get model status:', error);
            }
        }

        // Load data file list
        async function loadDataFiles() {
            try {
                const response = await axios.get('/api/data-files');
                const dataFiles = response.data;

                const dataFileSelect = document.getElementById('data-file-select');
                dataFileSelect.innerHTML = '<option value="">Vui lòng chọn tệp dữ liệu</option>';

                dataFiles.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.path;
                    option.textContent = `${file.name} (${file.size})`;
                    dataFileSelect.appendChild(option);
                });

                console.log('✅ Data file list loaded successfully:', dataFiles);
            } catch (error) {
                console.error('❌ Lỗi tải danh sách tệp dữ liệu:', error);
                showStatus('error', 'Không tải được danh sách tệp dữ liệu.');
            }
        }

        async function loadBinanceSymbols() {
            try {
                const response = await axios.get('/api/binance-symbols');
                const list = document.getElementById('binance-symbol-options');
                list.innerHTML = '';
                response.data.symbols.forEach(symbol => {
                    const option = document.createElement('option');
                    option.value = symbol;
                    list.appendChild(option);
                });
                if (response.data.source === 'fallback') {
                    document.getElementById('binance-symbol-hint').textContent =
                        'Không tải được danh sách mới từ Binance; đang hiển thị một số cặp phổ biến. Bạn vẫn có thể tự nhập mã.';
                } else {
                    document.getElementById('binance-symbol-hint').textContent =
                        `Đã tải ${response.data.symbols.length} cặp Spot/USDT đang giao dịch. Gõ để tìm hoặc nhập mã trực tiếp.`;
                }
            } catch (error) {
                document.getElementById('binance-symbol-hint').textContent =
                    'Không tải được gợi ý cặp coin; bạn vẫn có thể nhập mã trực tiếp, ví dụ ETHUSDT.';
            }
        }

        async function loadVnstockSymbols() {
            const hint = document.getElementById('vnstock-symbol-hint');
            try {
                const response = await axios.get('/api/vnstock-symbols');
                const list = document.getElementById('vnstock-symbol-options');
                list.innerHTML = '';
                response.data.symbols.forEach(item => {
                    const symbol = typeof item === 'string' ? item : item.symbol;
                    const name = typeof item === 'string' ? '' : item.name;
                    const option = document.createElement('option');
                    option.value = symbol;
                    if (name) option.label = `${symbol} — ${name}`;
                    list.appendChild(option);
                });
                if (response.data.source === 'fallback') {
                    hint.textContent = 'Đang hiển thị một số mã phổ biến; bạn vẫn có thể gõ mã khác để tìm dữ liệu.';
                } else {
                    hint.textContent = `Đã tải ${response.data.symbols.length} mã cổ phiếu. Gõ mã hoặc tên công ty để tìm; bạn cũng có thể nhập mã trực tiếp.`;
                }
            } catch (error) {
                hint.textContent = 'Không tải được danh sách gợi ý; bạn vẫn có thể nhập mã trực tiếp, ví dụ FPT.';
            }
        }

        function selectMarketTab(tabId) {
            const isCoin = tabId === 'coin-tab';
            const selectedTab = document.getElementById(tabId);
            const selectedPanel = document.getElementById(isCoin ? 'coin-data-panel' : 'stock-data-panel');
            const otherTab = document.getElementById(isCoin ? 'stock-tab' : 'coin-tab');
            const otherPanel = document.getElementById(isCoin ? 'stock-data-panel' : 'coin-data-panel');
            const selectedDetails = document.getElementById(isCoin ? 'coin-source-details' : 'stock-source-details');
            const otherDetails = document.getElementById(isCoin ? 'stock-source-details' : 'coin-source-details');

            if (selectedTab.classList.contains('active') && !selectedPanel.hidden) {
                if (selectedDetails.open) {
                    selectedDetails.open = false;
                    selectedPanel.hidden = true;
                    selectedTab.classList.remove('active');
                    selectedTab.setAttribute('aria-selected', 'false');
                    selectedTab.setAttribute('aria-expanded', 'false');
                } else {
                    selectedDetails.open = true;
                }
                return;
            }

            otherPanel.hidden = true;
            otherTab.classList.remove('active');
            otherTab.setAttribute('aria-selected', 'false');
            otherTab.setAttribute('aria-expanded', 'false');
            otherDetails.open = false;

            selectedPanel.hidden = false;
            selectedDetails.open = true;
            selectedTab.classList.add('active');
            selectedTab.setAttribute('aria-selected', 'true');
            selectedTab.setAttribute('aria-expanded', 'true');
        }

        function selectFetchedDataset(payload) {
            const select = document.getElementById('data-file-select');
            if (payload.temporary) {
                const option = document.createElement('option');
                option.value = payload.file_path;
                option.textContent = `${payload.dataset_name} (dữ liệu tạm)`;
                select.appendChild(option);
                temporaryDatasetPaths.add(payload.file_path);
                while (temporaryDatasetPaths.size > 8) temporaryDatasetPaths.delete(temporaryDatasetPaths.values().next().value);
            }
            select.value = payload.file_path;
            previewDataFile(payload.file_path);
        }

        // Best effort on page exit; server expiry also handles interrupted connections.
        window.addEventListener('pagehide', event => {
            if (event.persisted || !temporaryDatasetPaths.size) return;
            const body = new Blob([JSON.stringify({ file_paths: [...temporaryDatasetPaths] })], { type: 'application/json' });
            navigator.sendBeacon('/api/release-data', body);
        });

        // Fetch online candles into temporary memory for this page.
        async function fetchBinanceData() {
            const symbol = document.getElementById('binance-symbol').value.trim().toUpperCase();
            const interval = document.getElementById('binance-interval').value;
            const limit = parseInt(document.getElementById('binance-limit').value, 10);
            try {
                showLoading(true);
                document.getElementById('fetch-binance-btn').disabled = true;
                const response = await axios.post('/api/binance-klines', { symbol, interval, limit });
                await loadDataFiles();
                selectFetchedDataset(response.data);
                const loaded = await loadData();
                if (loaded) showStatus('success', `${response.data.message} Dữ liệu đã được nạp. Tiếp theo hãy tải mô hình rồi bấm “Bắt đầu dự báo”.`);
            } catch (error) {
                showStatus('error', `Không lấy được dữ liệu Binance: ${error.response?.data?.error || error.message}`);
            } finally {
                showLoading(false);
                document.getElementById('fetch-binance-btn').disabled = false;
            }
        }

        async function fetchVnstockData() {
            const symbol = document.getElementById('vnstock-symbol').value.trim().toUpperCase();
            const interval = document.getElementById('vnstock-interval').value;
            const count = parseInt(document.getElementById('vnstock-count').value, 10);
            const apiKey = document.getElementById('vnstock-api-key').value.trim();
            try {
                showLoading(true);
                document.getElementById('fetch-vnstock-btn').disabled = true;
                const response = await axios.post('/api/vnstock-klines', { symbol, interval, count, api_key: apiKey });
                await loadDataFiles();
                selectFetchedDataset(response.data);
                const loaded = await loadData();
                if (loaded) showStatus('success', `${response.data.message} Dữ liệu đã được nạp. Tiếp theo hãy tải mô hình rồi bấm “Bắt đầu dự báo”.`);
            } catch (error) {
                showStatus('error', `Không lấy được dữ liệu Vnstock: ${error.response?.data?.error || error.message}`);
            } finally {
                showLoading(false);
                document.getElementById('fetch-vnstock-btn').disabled = false;
            }
        }

        function previewDataFile(filePath) {
            if (!filePath) return;
            const lookback = 400;
            currentLookback = lookback;
            document.getElementById('lookback').value = lookback;
            document.getElementById('lookback-hint').textContent = 'Coin và cổ phiếu đều dùng 400 điểm dữ liệu lịch sử.';
            document.getElementById('prediction-mode-hint').textContent =
                `Tệp đang chọn dùng ${lookback} nến lịch sử và tạo ${predictionHorizon} nến kế tiếp.`;
            currentDataFile = null;
            clearAnalysisForChat();
            document.getElementById('predict-btn').disabled = true;
            document.getElementById('data-info').style.display = 'none';
        }

        // Load data file
        async function loadData() {
            const filePath = document.getElementById('data-file-select').value;

            if (!filePath) {
                showStatus('error', 'Vui lòng chọn tệp dữ liệu cần tải.');
                return;
            }

            try {
                showLoading(true);
                document.getElementById('load-data-btn').disabled = true;

                const response = await axios.post('/api/load-data', {
                    file_path: filePath
                });

                if (response.data.success) {
                    currentDataFile = filePath;
                    clearAnalysisForChat();
                    currentDataInfo = response.data.data_info;
                    showDataInfo(response.data.data_info);
                    displayDatasetOverview(filePath, response.data);
                    document.getElementById('results-link').hidden = true;
                    document.getElementById('forecast-summary').style.display = 'none';
                    document.getElementById('comparison-section').style.display = 'none';
                    if (response.data.preview_chart) {
                        rawPredictionChart = JSON.parse(response.data.preview_chart);
                        chartWheelZoomEnabled = false;
                        chartRangeToRestore = null;
                        document.getElementById('chart-empty').hidden = true;
                        document.getElementById('chart').classList.add('has-chart');
                        renderPredictionChart();
                    }
                    showStatus('success', response.data.message);

                    // Update prediction button status
                    if (modelLoaded) {
                        document.getElementById('predict-btn').disabled = false;
                    }

                    console.log('✅ Data loaded successfully:', response.data.data_info);
                    return true;
                } else {
                    showStatus('error', response.data.error);
                    return false;
                }
            } catch (error) {
                console.error('❌ Lỗi tải dữ liệu:', error);
                showStatus('error', `Tải dữ liệu thất bại: ${error.response?.data?.error || error.message}`);
                return false;
            } finally {
                showLoading(false);
                document.getElementById('load-data-btn').disabled = false;
            }
        }

        function displayDatasetOverview(filePath, payload) {
            const filename = filePath.split(/[\\/]/).pop();
            const match = filename.match(/^(binance|vnstock)_(.+)_([^_]+)\.csv$/i);
            const info = payload.data_info;
            document.getElementById('instrument-symbol').textContent = match ? match[2] : filename;
            document.getElementById('instrument-source').textContent = match ? `${match[1].toLowerCase() === 'binance' ? 'Binance Spot' : 'Chứng khoán Việt Nam'} · ${match[3]}` : 'Tệp dữ liệu OHLCV';
            document.getElementById('dataset-badge').textContent = `${new Intl.NumberFormat('vi-VN').format(info.rows)} NẾN`;
            const candle = payload.last_candle;
            for (const field of ['open', 'high', 'low', 'close']) {
                document.getElementById(`quote-${field}`).textContent = candle ? formatPrice(candle[field]) : '—';
            }
            document.getElementById('quote-volume').textContent = candle?.volume != null ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(candle.volume) : '—';
            document.getElementById('chart-data-caption').textContent = `Nến cuối: ${new Date(info.end_date).toLocaleString('vi-VN')}`;
        }

        // Display data information
        function showDataInfo(dataInfo) {
            currentLookback = Number(dataInfo.minimum_lookback) || 400;
            const windowSize = currentLookback + predictionHorizon;
            document.getElementById('lookback').value = currentLookback;
            document.getElementById('lookback-hint').textContent = 'Coin và cổ phiếu đều dùng 400 điểm dữ liệu lịch sử.';
            const canBacktest = Number(dataInfo.rows) >= windowSize;
            document.getElementById('prediction-mode-hint').textContent =
                `Dữ liệu hiện tại dùng ${currentLookback} nến lịch sử và tạo ${predictionHorizon} nến kế tiếp.` +
                (canBacktest ? '' : ` Kiểm tra trên lịch sử cần ít nhất ${windowSize} nến.`);
            document.getElementById('backtest-window-hint').textContent =
                `Khoảng kiểm tra gồm ${currentLookback} nến lịch sử và ${predictionHorizon} nến đối chiếu.`;
            const backtestOption = document.getElementById('backtest-option');
            backtestOption.disabled = !canBacktest;
            if (backtestOption.disabled && document.getElementById('prediction-mode').value === 'backtest') {
                document.getElementById('prediction-mode').value = 'future';
                document.getElementById('time-window-section').style.display = 'none';
            }
            document.getElementById('data-info').style.display = 'block';
            document.getElementById('data-rows').textContent = dataInfo.rows;
            document.getElementById('data-cols').textContent = dataInfo.columns.length;
            document.getElementById('data-time-range').textContent = `${dataInfo.start_date} to ${dataInfo.end_date}`;
            const fileName = currentDataFile?.split(/[\\/]/).pop().toLowerCase() || '';
            const isVnstockData = fileName.startsWith('vnstock_');
            const isStockMarket = isVnstockData || document.getElementById('stock-tab').classList.contains('active');
            currentPriceUnit = isStockMarket ? 'VND' : 'USDT';
            currentPriceScale = isVnstockData ? 1000 : 1;
            document.getElementById('data-price-range').textContent = `${formatPrice(dataInfo.price_range.min)} – ${formatPrice(dataInfo.price_range.max)}`;
            document.getElementById('data-timeframe').textContent = dataInfo.timeframe;
            document.getElementById('data-prediction-cols').textContent = dataInfo.prediction_columns.join(', ');
            const unitNote = document.getElementById('data-unit-note');
            const chartUnitGuide = document.getElementById('chart-unit-guide');
            if (isStockMarket) {
                unitNote.textContent = isVnstockData
                    ? 'Đơn vị hiển thị là VND; dữ liệu Vnstock được quy đổi từ nghìn đồng. Giá lịch sử có thể đã điều chỉnh theo sự kiện doanh nghiệp.'
                    : 'Đơn vị giá hiển thị là VND. Giá lịch sử có thể đã điều chỉnh theo sự kiện doanh nghiệp.';
                unitNote.style.display = 'block';
                chartUnitGuide.textContent = 'Đơn vị giá: VND. Di chuột lên nến để xem OHLC; dữ liệu Vnstock được quy đổi từ nghìn đồng.';
            } else {
                unitNote.textContent = 'Đơn vị giá: USDT.';
                unitNote.style.display = 'block';
                chartUnitGuide.textContent = 'Đơn vị giá: USDT. Di chuột lên nến để xem giá mở, cao nhất, thấp nhất, đóng cửa và khối lượng.';
            }

            // Initialize time window slider
            initializeTimeWindowSlider(dataInfo);
        }

                    // Time window slider related variables
        let sliderData = null;
        let isDragging = false;
        let currentHandle = null;

        // Initialize time window slider
        function initializeTimeSlider() {
            // Set up slider event listeners
            setupSliderEventListeners();
        }

        // Set up slider event listeners
        function setupSliderEventListeners() {
            const startHandle = document.getElementById('start-handle');
            const endHandle = document.getElementById('end-handle');
            const track = document.querySelector('.slider-track');

            // Start dragging
            startHandle.addEventListener('pointerdown', (e) => {
                isDragging = true;
                currentHandle = 'start';
                e.preventDefault();
            });

            endHandle.addEventListener('pointerdown', (e) => {
                isDragging = true;
                currentHandle = 'end';
                e.preventDefault();
            });

            // Dragging
            document.addEventListener('pointermove', (e) => {
                if (!isDragging) return;

                const rect = track.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, x / rect.width));

                if (currentHandle === 'start') {
                    updateStartHandle(percentage);
                } else if (currentHandle === 'end') {
                    updateEndHandle(percentage);
                }

                updateSliderFromHandles();
            });

            // End dragging
            document.addEventListener('pointerup', () => {
                isDragging = false;
                currentHandle = null;
            });

            // Click track to set position directly
            track.addEventListener('click', (e) => {
                const rect = track.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, x / rect.width));

                // Determine which handle is closer to the click position
                const startHandle = document.getElementById('start-handle');
                const endHandle = document.getElementById('end-handle');
                const startRect = startHandle.getBoundingClientRect();
                const endRect = endHandle.getBoundingClientRect();

                if (Math.abs(x - (startRect.left - rect.left)) < Math.abs(x - (endRect.left - rect.left))) {
                    updateStartHandle(percentage);
                } else {
                    updateEndHandle(percentage);
                }

                updateSliderFromHandles();
            });
        }

        // Update start handle position
        function updateStartHandle(percentage) {
            const startHandle = document.getElementById('start-handle');
            const selection = document.getElementById('slider-selection');

            // Keep the selected history plus comparison window fixed.
            const windowSize = currentLookback + predictionHorizon;
            const totalRows = sliderData ? sliderData.totalRows : 1000;
            const windowPercentage = windowSize / totalRows;

            // Ensure start handle doesn't cause window to exceed data range
            if (percentage + windowPercentage > 1) {
                percentage = 1 - windowPercentage;
            }

            startHandle.style.left = (percentage * 100) + '%';
            selection.style.left = (percentage * 100) + '%';
            selection.style.width = (windowPercentage * 100) + '%';

            // Automatically adjust end handle position to maintain fixed window size
            const endHandle = document.getElementById('end-handle');
            endHandle.style.left = ((percentage + windowPercentage) * 100) + '%';
        }

        // Update end handle position
        function updateEndHandle(percentage) {
            const endHandle = document.getElementById('end-handle');
            const selection = document.getElementById('slider-selection');

            // Keep the selected history plus comparison window fixed.
            const windowSize = currentLookback + predictionHorizon;
            const totalRows = sliderData ? sliderData.totalRows : 1000;
            const windowPercentage = windowSize / totalRows;

            // Ensure end handle doesn't cause window to exceed data range
            if (percentage - windowPercentage < 0) {
                percentage = windowPercentage;
            }

            endHandle.style.left = (percentage * 100) + '%';
            selection.style.left = ((percentage - windowPercentage) * 100) + '%';
            selection.style.width = (windowPercentage * 100) + '%';

            // Automatically adjust start handle position to maintain fixed window size
            const startHandle = document.getElementById('start-handle');
            startHandle.style.left = ((percentage - windowPercentage) * 100) + '%';
        }

        // Update slider display based on handle positions
        function updateSliderFromHandles() {
            const startHandle = document.getElementById('start-handle');
            const endHandle = document.getElementById('end-handle');

            const startPercentage = parseFloat(startHandle.style.left) / 100;
            const endPercentage = parseFloat(endHandle.style.left) / 100;

            if (!sliderData) return;

            // Calculate selected time range
            const totalTime = sliderData.endDate.getTime() - sliderData.startDate.getTime();
            const startTime = sliderData.startDate.getTime() + (totalTime * startPercentage);
            const endTime = sliderData.startDate.getTime() + (totalTime * endPercentage);

            const startDate = new Date(startTime);
            const endDate = new Date(endTime);

            // Update display information
            document.getElementById('window-start').textContent = `Bắt đầu: ${startDate.toLocaleDateString("vi-VN")}`;
            document.getElementById('window-end').textContent = `Kết thúc: ${endDate.toLocaleDateString("vi-VN")}`;

            // Display fixed window size
            document.getElementById('window-size').textContent = `Khoảng chọn: ${currentLookback} + ${predictionHorizon} = ${currentLookback + predictionHorizon} điểm dữ liệu`;

            // Input field values remain fixed
            document.getElementById('lookback').value = currentLookback;
            document.getElementById('pred-len').value = predictionHorizon;
        }

        // Update slider based on input fields
        function updateSliderFromInputs() {
            if (!sliderData) return;

            // Use 400 history bars for both Vietnamese stocks and coin data.
            const lookback = currentLookback;
            const predLen = predictionHorizon;
            const windowSize = lookback + predLen;

            // Calculate slider position
            const totalRows = sliderData.totalRows;

            if (windowSize > totalRows) {
                // If window size exceeds total data amount, show error
                document.getElementById('backtest-option').disabled = true;
                return;
            }

            document.getElementById('backtest-option').disabled = false;

            // Calculate slider position (default select first half of data)
            const startPercentage = Math.min(0.1, 1 - (windowSize / totalRows));
            const endPercentage = startPercentage + (windowSize / totalRows);

            // Update handle positions
            updateStartHandle(startPercentage);
            updateEndHandle(endPercentage);

            // Update display information
            updateSliderFromHandles();
        }

        // Initialize time window slider
        function initializeTimeWindowSlider(dataInfo) {
            sliderData = {
                startDate: new Date(dataInfo.start_date),
                endDate: new Date(dataInfo.end_date),
                totalRows: dataInfo.rows,
                timeframe: dataInfo.timeframe
            };

            // Set slider labels
            document.getElementById('min-label').textContent = dataInfo.start_date.split('T')[0];
            document.getElementById('max-label').textContent = dataInfo.end_date.split('T')[0];

            // Initialize slider position
            updateSliderFromInputs();
        }

        // Start prediction
        async function startPrediction() {
            if (!currentDataFile) {
                showStatus('error', 'Vui lòng tải dữ liệu trước.');
                return;
            }

            if (!modelLoaded) {
                showStatus('error', 'Vui lòng tải mô hình trước.');
                return;
            }

            try {
                showLoading(true);
                document.getElementById('predict-btn').disabled = true;

                const lookback = parseInt(document.getElementById('lookback').value);
                const predLen = parseInt(document.getElementById('pred-len').value);
                const isFutureForecast = document.getElementById('prediction-mode').value === 'future';
                let startDate = null;
                if (!isFutureForecast) {
                    // Historical backtesting uses the selected 520-candle window.
                    const startHandle = document.getElementById('start-handle');
                    const startPercentage = parseFloat(startHandle.style.left) / 100;
                    if (!sliderData) {
                        showStatus('error', 'Thanh chọn khoảng thời gian chưa được khởi tạo.');
                        return;
                    }
                    const totalTime = sliderData.endDate.getTime() - sliderData.startDate.getTime();
                    const startTime = sliderData.startDate.getTime() + (totalTime * startPercentage);
                    startDate = new Date(startTime);
                }

                // Get prediction quality parameters
                const temperature = parseFloat(document.getElementById('temperature').value);
                const topP = parseFloat(document.getElementById('top-p').value);
                const sampleCount = parseInt(document.getElementById('sample-count').value);

                let predictionParams = {
                    file_path: currentDataFile,
                    lookback: lookback,
                    pred_len: predLen,
                    forecast_future: isFutureForecast,
                    temperature: temperature,
                    top_p: topP,
                    sample_count: sampleCount
                };
                if (startDate) {
                    predictionParams.start_date = startDate.toISOString().slice(0, 16);
                }

                console.log('🚀 Starting prediction, parameters:', predictionParams);

                const response = await axios.post('/api/predict', predictionParams);

                if (response.data.success) {
                    // Display prediction results
                    displayPredictionResult(response.data);
                    showStatus('success', response.data.message);
                } else {
                    showStatus('error', response.data.error);
                }
            } catch (error) {
                console.error('❌ Lỗi dự báo:', error);
                showStatus('error', `Dự báo thất bại: ${error.response?.data?.error || error.message}`);
            } finally {
                showLoading(false);
                document.getElementById('predict-btn').disabled = false;
            }
        }

        // Display prediction results
        function displayPredictionResult(result) {
            latestPredictionForChat = result;
            // Display chart
            rawPredictionChart = JSON.parse(result.chart);
            chartWheelZoomEnabled = false;
            chartRangeToRestore = null;
            const interactionHint = document.getElementById('chart-interaction-hint');
            interactionHint.textContent = 'Nhấp chuột trái một lần để khóa thao tác trên biểu đồ. Nhấp lần nữa để nhả và cuộn trang.';
            interactionHint.classList.remove('is-active');
            document.getElementById('chart-empty').hidden = true;
            document.getElementById('chart').classList.add('has-chart');
            renderPredictionChart();
            displayForecastSummary(result);
            document.getElementById('results-link').hidden = false;
            displayFuturesScenario(result);

            // Display comparison analysis (if actual data exists)
            if (result.has_comparison) {
                displayComparisonAnalysis(result);
            } else {
                document.getElementById('comparison-section').style.display = 'none';
            }
            publishAnalysisForChat(result);
        }

        function getChartBucketStart(value, interval) {
            const text = String(value);
            // Keep explicit UTC offsets (Vnstock timestamps use +07:00); only
            // assume UTC for timestamps that do not carry a timezone at all.
            const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
            const date = new Date(hasTimezone ? text : `${text}Z`);
            if (Number.isNaN(date.getTime())) return null;

            if (interval === '1h') {
                date.setUTCMinutes(0, 0, 0);
            } else if (interval === '1d') {
                date.setUTCHours(0, 0, 0, 0);
            } else if (interval === '1w') {
                date.setUTCHours(0, 0, 0, 0);
                const daysSinceMonday = (date.getUTCDay() + 6) % 7;
                date.setUTCDate(date.getUTCDate() - daysSinceMonday);
            } else if (interval === '1M') {
                date.setUTCDate(1);
                date.setUTCHours(0, 0, 0, 0);
            }
            return date;
        }

        function aggregateCandleTrace(candleTrace, hoverTrace, interval) {
            if (!candleTrace.x || candleTrace.x.length === 0 || !hoverTrace?.customdata) return null;
            const grouped = new Map();
            candleTrace.x.forEach((x, i) => {
                const bucket = getChartBucketStart(x, interval);
                if (!bucket) return;
                const key = bucket.getTime();
                const candle = {
                    x: bucket.toISOString(),
                    open: Number(candleTrace.open[i]),
                    high: Number(candleTrace.high[i]),
                    low: Number(candleTrace.low[i]),
                    close: Number(candleTrace.close[i]),
                    customdata: (hoverTrace.customdata[i] || []).map(Number)
                };
                const current = grouped.get(key);
                if (!current) {
                    grouped.set(key, candle);
                } else {
                    current.high = Math.max(current.high, candle.high);
                    current.low = Math.min(current.low, candle.low);
                    current.close = candle.close;
                    current.customdata[1] = Math.max(current.customdata[1] || 0, candle.customdata[1] || 0);
                    current.customdata[2] = Math.min(current.customdata[2] || candle.customdata[2], candle.customdata[2]);
                    current.customdata[3] = candle.customdata[3];
                    current.customdata[4] = (current.customdata[4] || 0) + (candle.customdata[4] || 0);
                    current.customdata[5] = (current.customdata[5] || 0) + (candle.customdata[5] || 0);
                }
            });

            const rows = [...grouped.values()];
            rows.forEach((row, index) => {
                const previousClose = index > 0 ? rows[index - 1].close : row.open;
                row.customdata[6] = previousClose ? ((row.close - previousClose) / previousClose) * 100 : 0;
                row.customdata[7] = row.open ? ((row.high - row.low) / row.open) * 100 : 0;
                for (const [slot, period] of [[8, 7], [9, 25], [10, 99]]) {
                    const sample = rows.slice(Math.max(0, index - period + 1), index + 1);
                    row.customdata[slot] = sample.reduce((sum, point) => sum + point.close, 0) / sample.length;
                }
            });
            const candle = { ...candleTrace };
            candle.x = rows.map(row => row.x);
            candle.open = rows.map(row => row.open);
            candle.high = rows.map(row => row.high);
            candle.low = rows.map(row => row.low);
            candle.close = rows.map(row => row.close);

            const hover = { ...hoverTrace };
            hover.x = rows.map(row => row.x);
            hover.y = rows.map(row => row.close);
            hover.customdata = rows.map(row => row.customdata);
            return [candle, hover];
        }

        function activateChartScrollZoom(event) {
            const chartElement = document.getElementById('chart');
            if (!rawPredictionChart || event.target.closest?.('.modebar')) return;

            const visibleRange = chartElement._fullLayout?.xaxis?.range;
            chartRangeToRestore = visibleRange ? [...visibleRange] : null;
            chartWheelZoomEnabled = !chartWheelZoomEnabled;
            const hint = document.getElementById('chart-interaction-hint');
            hint.textContent = chartWheelZoomEnabled
                ? 'Đang khóa biểu đồ: cuộn để zoom, giữ chuột trái kéo ngang để dịch chuyển. Nhấp trái lần nữa để nhả.'
                : 'Đã nhả biểu đồ: cuộn/kéo sẽ thao tác với trang. Nhấp trái lên biểu đồ để khóa lại.';
            hint.classList.toggle('is-active', chartWheelZoomEnabled);
            renderPredictionChart();
        }

        function applyChartViewport(chartData) {
            const density = document.getElementById('chart-density').value;
            const candles = chartData.data.filter(trace => trace.type === 'candlestick');
            const timestamps = [...new Set(candles.flatMap(trace => trace.x))].sort((a, b) => new Date(a) - new Date(b));
            if (!timestamps.length) return;
            if (chartRangeToRestore) {
                chartData.layout.xaxis.range = [...chartRangeToRestore];
            } else if (density === 'all') {
                chartData.layout.xaxis.range = [timestamps[0], timestamps[timestamps.length - 1]];
            } else {
                const count = Number(density) || 80;
                const forecast = candles.find(trace => trace.name.includes('Dự báo'));
                const pivot = forecast?.x?.length ? timestamps.indexOf(forecast.x[0]) : -1;
                const start = pivot >= 0 ? Math.max(0, pivot - Math.floor(count / 2)) : Math.max(0, timestamps.length - count);
                const end = Math.min(timestamps.length - 1, start + count - 1);
                // Half a candle of breathing room avoids clipping the edge bodies.
                const step = timestamps.length > 1 ? (new Date(timestamps[Math.min(start + 1, timestamps.length - 1)]) - new Date(timestamps[start])) : 3600000;
                chartData.layout.xaxis.range = [new Date(new Date(timestamps[start]).getTime() - step / 2).toISOString(), new Date(new Date(timestamps[end]).getTime() + step / 2).toISOString()];
            }
            chartData.layout.xaxis.autorange = false;
            const [from, to] = chartData.layout.xaxis.range.map(value => new Date(value).getTime());
            const lows = [], highs = [];
            for (const trace of candles) trace.x.forEach((timestamp, index) => {
                const time = new Date(timestamp).getTime();
                if (time >= from && time <= to) {
                    const low = Number(trace.low[index]), high = Number(trace.high[index]);
                    if (Number.isFinite(low) && Number.isFinite(high)) { lows.push(low); highs.push(high); }
                }
            });
            if (lows.length) {
                const low = Math.min(...lows), high = Math.max(...highs);
                const padding = (high - low || Math.abs(high) * 0.01 || 1) * 0.1;
                chartData.layout.yaxis.range = [low - padding, high + padding];
                chartData.layout.yaxis.autorange = false;
            }
        }

        function renderPredictionChart() {
            if (!rawPredictionChart) return;
            const interval = document.getElementById('chart-interval').value;
            const chartData = JSON.parse(JSON.stringify(rawPredictionChart));
            const hint = document.getElementById('chart-interval-hint');

            if (interval !== 'source') {
                const sourceMatch = (currentDataInfo?.timeframe || '').match(/([\d.]+)\s*(seconds|minutes|hours|days)/i);
                const sourceUnits = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
                const sourceMs = sourceMatch ? Number(sourceMatch[1]) * sourceUnits[sourceMatch[2].toLowerCase()] : 0;
                const targetMs = { '1h': 3600000, '1d': 86400000, '1w': 604800000, '1M': 2592000000 }[interval];

                if (sourceMs && targetMs < sourceMs) {
                    hint.textContent = 'Dữ liệu gốc thưa hơn khung đã chọn nên biểu đồ giữ nguyên độ chi tiết của dữ liệu.';
                } else {
                    const candleIndexes = chartData.data
                        .map((trace, index) => trace.type === 'candlestick' ? index : -1)
                        .filter(index => index >= 0);
                    for (const index of candleIndexes) {
                        const candleTrace = chartData.data[index];
                        const hoverTrace = chartData.data[index + 1];
                        const aggregated = aggregateCandleTrace(candleTrace, hoverTrace, interval);
                        if (aggregated) {
                            chartData.data[index] = aggregated[0];
                            chartData.data[index + 1] = aggregated[1];
                        }
                    }
                    hint.textContent = `Các nến được gộp theo khung ${document.querySelector(`#chart-interval option[value="${interval}"]`).textContent}; dự báo gốc không thay đổi.`;
                }
            } else {
                hint.textContent = 'Đang hiển thị theo khung thời gian của dữ liệu gốc.';
            }

            if (currentPriceScale !== 1) {
                for (const candleTrace of chartData.data.filter(trace => trace.type === 'candlestick')) {
                    const candleIndex = chartData.data.indexOf(candleTrace);
                    const hoverTrace = chartData.data[candleIndex + 1];
                    for (const field of ['open', 'high', 'low', 'close']) {
                        candleTrace[field] = candleTrace[field].map(value => Number(value) * currentPriceScale);
                    }
                    if (hoverTrace?.customdata) {
                        hoverTrace.customdata = hoverTrace.customdata.map(row => {
                            const scaledRow = [...row];
                            for (const index of [0, 1, 2, 3, 5, 8, 9, 10]) {
                                if (Number.isFinite(Number(scaledRow[index]))) scaledRow[index] = Number(scaledRow[index]) * currentPriceScale;
                            }
                            if (currentPriceUnit === 'VND' && !Number(scaledRow[5]) && Number(scaledRow[3]) && Number(scaledRow[4])) {
                                scaledRow[5] = Number(scaledRow[3]) * Number(scaledRow[4]);
                            }
                            return scaledRow;
                        });
                    }
                }
            }

            // Match Plotly's canvas to the selected theme while preserving
            // existing traces, axes, ranges, and hover templates.
            const isLightTheme = document.body.dataset.theme === 'light';
            const chartText = isLightTheme ? '#46566d' : '#afc3bb';
            const chartGrid = isLightTheme ? 'rgba(96, 119, 139, 0.13)' : 'rgba(148, 163, 184, 0.13)';
            chartData.layout.paper_bgcolor = 'rgba(0,0,0,0)';
            chartData.layout.plot_bgcolor = isLightTheme ? '#ffffff' : '#101a1b';
            const originalTitle = chartData.layout.title;
            chartData.layout.title = {
                ...(originalTitle && typeof originalTitle === 'object' ? originalTitle : {}),
                text: '',
                x: 0.015,
                xanchor: 'left',
                y: 0.99,
                yanchor: 'top',
                font: { ...(originalTitle?.font || {}), color: isLightTheme ? '#34465d' : '#e8efff', size: 12, family: 'Inter, ui-sans-serif, system-ui, sans-serif' }
            };
            chartData.layout.margin = { ...(chartData.layout.margin || {}), l: window.innerWidth < 600 ? 48 : 62, r: 16, t: 48, b: 42 };
            chartData.layout.height = document.body.classList.contains('chart-expanded') ? Math.max(420, window.innerHeight - 230) : window.innerWidth < 600 ? 520 : Math.max(640, Math.min(820, window.innerHeight * 0.75));
            chartData.layout.hoverlabel = {
                ...(chartData.layout.hoverlabel || {}),
                bgcolor: isLightTheme ? '#ffffff' : '#172527',
                bordercolor: isLightTheme ? '#b8dcd4' : '#3c4c66',
                font: { color: isLightTheme ? '#26364b' : '#eef3ff', size: 13, family: 'Inter, ui-sans-serif, system-ui, sans-serif' },
                align: 'left'
            };
            chartData.layout.dragmode = chartWheelZoomEnabled ? 'pan' : false;
            if (chartData.layout.yaxis) {
                chartData.layout.yaxis = { ...chartData.layout.yaxis, fixedrange: true };
            }
            if (chartRangeToRestore && chartData.layout.xaxis) {
                chartData.layout.xaxis = { ...chartData.layout.xaxis, range: chartRangeToRestore, autorange: false };
            }
            chartData.layout.font = {
                ...(chartData.layout.font || {}),
                color: chartText,
                family: 'Inter, ui-sans-serif, system-ui, sans-serif'
            };
            for (const axisName of ['xaxis', 'yaxis', 'xaxis2', 'yaxis2']) {
                if (chartData.layout[axisName]) {
                    chartData.layout[axisName] = {
                        ...chartData.layout[axisName],
                        gridcolor: chartGrid,
                        zerolinecolor: chartGrid,
                        linecolor: isLightTheme ? '#dfe4ec' : chartGrid,
                        showline: true,
                        ticks: 'outside',
                        tickcolor: isLightTheme ? '#cbd5e1' : chartGrid,
                        automargin: true,
                        tickfont: { ...(chartData.layout[axisName].tickfont || {}), color: chartText, size: 11 }
                    };
                }
            }
            const activityMode = document.getElementById('chart-activity').value;
            const activityIndex = activityMode === 'amount' ? 5 : 4;
            const activityTitle = activityMode === 'amount'
                ? (currentPriceUnit === 'VND' ? 'Giá trị giao dịch ước tính' : 'Giá trị giao dịch')
                : 'Khối lượng giao dịch';
            const activityUnit = activityMode === 'amount' ? 'Giá trị' : 'Khối lượng';
            chartData.layout.xaxis = {
                ...(chartData.layout.xaxis || {}),
                domain: [0, 1],
                rangeslider: { ...(chartData.layout.xaxis?.rangeslider || {}), visible: false }
            };
            chartData.layout.yaxis = {
                ...(chartData.layout.yaxis || {}),
                domain: [0.27, 1],
                fixedrange: true,
                side: 'right',
                title: { ...(chartData.layout.yaxis?.title || {}), text: `Giá (${currentPriceUnit})`, font: { color: chartText, size: 12 } },
                tickformat: currentPriceUnit === 'VND' ? ',.0f' : ',.4f'
            };
            const volumeUnit = currentPriceUnit === 'VND' ? 'cổ phiếu' : 'đơn vị coin';
            document.getElementById('chart-activity-hint').textContent = activityMode === 'amount' && currentPriceUnit === 'VND'
                ? 'Vnstock không có cột giá trị giao dịch; biểu đồ ước tính bằng giá đóng cửa × khối lượng.'
                : activityMode === 'amount'
                    ? `Giá trị giao dịch được hiển thị theo ${currentPriceUnit}.`
                    : `Khối lượng tính theo ${volumeUnit}.`;
            chartData.layout.yaxis2 = {
                domain: [0.02, 0.21],
                anchor: 'x',
                side: 'right',
                fixedrange: true,
                title: { text: activityMode === 'amount' ? `${activityTitle} (${currentPriceUnit})` : `${activityTitle} (${volumeUnit})`, font: { color: chartText, size: 10 }, standoff: 8 },
                tickfont: { color: chartText, size: 9 },
                tickformat: '~s',
                showgrid: false,
                zeroline: false,
                showline: false,
                automargin: true
            };
            chartData.layout.barmode = 'overlay';
            chartData.layout.bargap = 0.12;
            chartData.layout.legend = {
                ...(chartData.layout.legend || {}),
                orientation: 'h',
                x: 0,
                y: 1.02,
                xanchor: 'left',
                yanchor: 'bottom',
                font: { ...(chartData.layout.legend?.font || {}), color: chartText, size: 10 },
                bgcolor: isLightTheme ? 'rgba(255,255,255,0.92)' : 'rgba(16, 26, 27, 0.92)',
                bordercolor: isLightTheme ? '#dfe4ec' : '#263536',
                borderwidth: 1
            };
            for (const trace of chartData.data.filter(item => item.type === 'candlestick')) {
                const isForecast = trace.name.includes('Dự báo');
                const isActual = trace.name.includes('thực tế');
                const colors = { up: '#20b983', upFill: '#20b983', down: '#f6465d', downFill: '#f6465d' };
                trace.opacity = 1;
                trace.whiskerwidth = 0.4;
                trace.increasing = {
                    ...(trace.increasing || {}),
                    line: { ...(trace.increasing?.line || {}), color: colors.up, width: 1.3 },
                    fillcolor: colors.upFill
                };
                trace.decreasing = {
                    ...(trace.decreasing || {}),
                    line: { ...(trace.decreasing?.line || {}), color: colors.down, width: 1.3 },
                    fillcolor: colors.downFill
                };
            }
            if (chartData.layout.xaxis?.rangeslider) {
                chartData.layout.xaxis.rangeslider = {
                    ...chartData.layout.xaxis.rangeslider,
                    bgcolor: isLightTheme ? '#f7f4ec' : '#152122',
                    bordercolor: isLightTheme ? '#e4ded0' : '#263536',
                    thickness: 0.075
                };
            }
            chartData.layout.shapes = [...(chartData.layout.shapes || [])];
            chartData.layout.annotations = [...(chartData.layout.annotations || [])];

            // Draw moving averages over the observed context and predicted path.
            const historyTrace = chartData.data.find(trace => trace.type === 'candlestick' && trace.name.includes('lịch sử'));
            const forecastTrace = chartData.data.find(trace => trace.type === 'candlestick' && trace.name.includes('Dự báo'));
            if (historyTrace && forecastTrace) {
                const historyIndex = chartData.data.indexOf(historyTrace);
                const forecastIndex = chartData.data.indexOf(forecastTrace);
                const hoverTraces = [chartData.data[historyIndex + 1], chartData.data[forecastIndex + 1]];
                const x = [...historyTrace.x, ...forecastTrace.x];
                const closes = [...historyTrace.close, ...forecastTrace.close].map(Number);
                let runningIndex = 0;
                for (const [trace, hoverTrace] of [[historyTrace, hoverTraces[0]], [forecastTrace, hoverTraces[1]]]) {
                    trace.close.forEach((close, localIndex) => {
                        const absoluteIndex = runningIndex + localIndex;
                        const previousClose = absoluteIndex > 0 ? closes[absoluteIndex - 1] : Number(trace.open[localIndex]);
                        if (hoverTrace?.customdata?.[localIndex]) {
                            hoverTrace.customdata[localIndex][6] = previousClose ? ((closes[absoluteIndex] - previousClose) / previousClose) * 100 : 0;
                            for (const [slot, period] of [[8, 7], [9, 25], [10, 99]]) {
                                const window = closes.slice(Math.max(0, absoluteIndex - period + 1), absoluteIndex + 1);
                                hoverTrace.customdata[localIndex][slot] = window.reduce((sum, value) => sum + value, 0) / window.length;
                            }
                        }
                    });
                    runningIndex += trace.close.length;
                }
                for (const [period, color] of [[7, '#f59e0b'], [25, '#ec4899'], [99, '#7e22ce']]) {
                    const movingAverage = closes.map((_, index) => {
                        if (index + 1 < period) return null;
                        const window = closes.slice(index - period + 1, index + 1);
                        return window.reduce((sum, value) => sum + value, 0) / period;
                    });
                    chartData.data.push({
                        type: 'scatter',
                        mode: 'lines',
                        x,
                        y: movingAverage,
                        name: `MA(${period})`,
                        line: { color, width: 2 },
                        hoverinfo: 'skip',
                        showlegend: true
                    });
                }
            }

            for (const candleTrace of chartData.data.filter(trace => trace.type === 'candlestick')) {
                const traceIndex = chartData.data.indexOf(candleTrace);
                const hoverTrace = chartData.data[traceIndex + 1];
                if (!hoverTrace?.customdata) continue;
                const hoverFields = [
                    ['Mở cửa', 0], ['Cao nhất', 1], ['Thấp nhất', 2], ['Đóng cửa', 3],
                    ['MA(7)', 8], ['MA(25)', 9], ['MA(99)', 10]
                ];
                for (const [label, index] of hoverFields) {
                    const originalValue = `${label}: %{customdata[${index}]:,.4f}`;
                    const precision = currentPriceUnit === 'VND' ? ':,.0f' : ':,.4f';
                    const formattedValue = `${label}: %{customdata[${index}]${precision}} ${currentPriceUnit}`;
                    hoverTrace.hovertemplate = hoverTrace.hovertemplate?.replaceAll(originalValue, formattedValue);
                }
                const volumeTemplate = 'Khối lượng: %{customdata[4]:,.4f}';
                hoverTrace.hovertemplate = hoverTrace.hovertemplate?.replaceAll(volumeTemplate, `${volumeTemplate} ${volumeUnit}`);
                const originalAmountTemplate = 'Giá trị giao dịch: %{customdata[5]:,.2f}';
                const amountLabel = currentPriceUnit === 'VND' ? 'Giá trị giao dịch ước tính' : 'Giá trị giao dịch';
                const amountPrecision = currentPriceUnit === 'VND' ? ':,.0f' : ':,.2f';
                const amountTemplate = `${amountLabel}: %{customdata[5]${amountPrecision}}`;
                hoverTrace.hovertemplate = hoverTrace.hovertemplate?.replaceAll(originalAmountTemplate, `${amountTemplate} ${currentPriceUnit}`);
                const isForecast = candleTrace.name.includes('Dự báo');
                const isActual = candleTrace.name.includes('thực tế');
                const colors = candleTrace.close.map((close, index) => {
                    const rising = Number(close) >= Number(candleTrace.open[index]);
                    return rising ? '#20b983' : '#f6465d';
                });
                chartData.data.push({
                    type: 'bar',
                    x: candleTrace.x,
                    y: hoverTrace.customdata.map(row => Math.max(0, Number(row?.[activityIndex]) || 0)),
                    yaxis: 'y2',
                    name: isActual ? `${activityUnit} thực tế` : isForecast ? `${activityUnit} dự báo` : activityTitle,
                    marker: { color: colors, line: { width: 0 } },
                    opacity: 1,
                    showlegend: false,
                    hovertemplate: `<b>%{x|%Y-%m-%d %H:%M}</b><br>${activityUnit}: %{y:${currentPriceUnit === 'VND' ? ',.0f' : ',.2f'}} ${activityMode === 'amount' ? currentPriceUnit : volumeUnit}<extra></extra>`
                });
            }

            const predictionCandles = chartData.data.find(trace => trace.type === 'candlestick' && trace.name.includes('Dự báo'));
            if (predictionCandles?.x?.length) {
                const forecastStart = predictionCandles.x[0];
                const forecastEnd = predictionCandles.x[predictionCandles.x.length - 1];
                chartData.layout.shapes.push({
                    type: 'rect', xref: 'x', yref: 'paper', x0: forecastStart, x1: forecastEnd,
                    y0: 0, y1: 1, fillcolor: isLightTheme ? 'rgba(32, 168, 152, .045)' : 'rgba(84, 240, 203, .045)',
                    line: { width: 0 }, layer: 'below'
                });
                chartData.layout.shapes.push({
                    type: 'line', xref: 'x', yref: 'paper', x0: forecastStart, x1: forecastStart,
                    y0: 0, y1: 1, line: { color: isLightTheme ? '#168f83' : '#54f0cb', width: 1.5, dash: 'dot' }
                });
                chartData.layout.annotations.push({
                    x: forecastStart, y: 1, xref: 'x', yref: 'paper', text: 'BẮT ĐẦU DỰ BÁO',
                    showarrow: false, xanchor: 'left', yanchor: 'bottom', yshift: 7,
                    font: { color: isLightTheme ? '#147c73' : '#8af3dc', size: 10, family: 'Inter, ui-sans-serif, system-ui, sans-serif' },
                    bgcolor: isLightTheme ? 'rgba(236,250,246,.95)' : 'rgba(11,24,34,.92)',
                    bordercolor: isLightTheme ? '#bfe7dd' : '#266254', borderwidth: 1, borderpad: 5
                });
            }

            applyChartViewport(chartData);

            const chartRender = Plotly.newPlot('chart', chartData.data, chartData.layout, {
                responsive: true,
                scrollZoom: chartWheelZoomEnabled,
                displayModeBar: false
            });
            if (chartRangeToRestore) {
                chartRender.then(() => { chartRangeToRestore = null; });
            }
        }

        function displayForecastSummary(result) {
            const forecasts = result.prediction_results || [];
            const reference = result.reference_data;
            const summary = document.getElementById('forecast-summary');
            if (!reference || forecasts.length === 0) {
                summary.style.display = 'none';
                return;
            }

            const closes = forecasts.map(point => Number(point.close)).filter(Number.isFinite);
            if (closes.length === 0) {
                summary.style.display = 'none';
                return;
            }

            const firstClose = Number(reference.close);
            const finalClose = closes[closes.length - 1];
            const changePercent = firstClose === 0 ? 0 : ((finalClose - firstClose) / firstClose) * 100;
            const minClose = Math.min(...closes);
            const maxClose = Math.max(...closes);
            const changeNode = document.getElementById('summary-change');
            const direction = changePercent > 0 ? 'Tăng' : changePercent < 0 ? 'Giảm' : 'Gần như đi ngang';

            document.getElementById('summary-reference-close').textContent = formatPrice(firstClose);
            document.getElementById('summary-final-close').textContent = formatPrice(finalClose);
            changeNode.textContent = `${direction} ${Math.abs(changePercent).toFixed(2)}%`;
            changeNode.className = `value ${changePercent > 0 ? 'positive' : changePercent < 0 ? 'negative' : ''}`;
            document.getElementById('summary-range').textContent = `${formatPrice(minClose)} – ${formatPrice(maxClose)}`;
            const referenceDate = new Date(reference.timestamp).toLocaleString('vi-VN');
            const finalDate = new Date(forecasts[forecasts.length - 1].timestamp).toLocaleString('vi-VN');
            document.getElementById('forecast-summary-note').textContent =
                `Đơn vị giá: ${currentPriceUnit}. So sánh giá đóng cửa từ nến mốc ${referenceDate} đến nến dự báo cuối ${finalDate} (${forecasts.length} nến). Đây là ước tính của mô hình, không phải cam kết về giá thị trường.`;

            const context = result.context_analysis || {};
            const recentMove = Number(context.recent_mean_change_pct || 0);
            const recentDirection = recentMove > 0.1 ? 'tăng' : recentMove < -0.1 ? 'giảm' : 'gần như đi ngang';
            const forecastDirection = changePercent > 0.1 ? 'tăng' : changePercent < -0.1 ? 'giảm' : 'đi ngang';
            const agrees = Math.sign(recentMove) === Math.sign(changePercent) && Math.abs(recentMove) > 0.1 && Math.abs(changePercent) > 0.1;
            const directionRelation = agrees
                ? 'Hướng dự báo cùng chiều với chuyển động gần đây.'
                : Math.abs(recentMove) <= 0.1
                    ? 'Dữ liệu gần đây khá đi ngang; hướng dự báo không được giải thích bởi một xu hướng ngắn hạn rõ rệt.'
                    : 'Hướng dự báo trái với chuyển động gần đây; đây chỉ là dự báo khác xu hướng, chưa xác nhận đảo chiều.';
            const amountChange = finalClose - firstClose;
            const historyTrace = rawPredictionChart?.data.find(trace => trace.type === 'candlestick' && trace.name.includes('lịch sử'));
            const historicalCloses = (historyTrace?.close || []).map(Number).filter(Number.isFinite);
            const latestHistoricalClose = historicalCloses[historicalCloses.length - 1];
            const meanOfLast = count => {
                const values = historicalCloses.slice(-count);
                return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
            };
            const ma7 = meanOfLast(7);
            const ma25 = meanOfLast(25);
            const ma99 = meanOfLast(99);
            let maDirection = 'mixed';
            let technicalStructure = 'Dữ liệu lịch sử chưa đủ để so sánh các đường trung bình động.';
            if ([latestHistoricalClose, ma7, ma25, ma99].every(Number.isFinite)) {
                const alignedUp = latestHistoricalClose > ma7 && ma7 > ma25 && ma25 > ma99;
                const alignedDown = latestHistoricalClose < ma7 && ma7 < ma25 && ma25 < ma99;
                maDirection = alignedUp ? 'up' : alignedDown ? 'down' : 'mixed';
                const structure = alignedUp ? 'xếp theo hướng tăng' : alignedDown ? 'xếp theo hướng giảm' : 'chưa đồng thuận';
                technicalStructure = `Giá đóng cửa gần nhất là ${formatPrice(latestHistoricalClose)}, MA(7) ${formatPrice(ma7)}, MA(25) ${formatPrice(ma25)} và MA(99) ${formatPrice(ma99)}. Các mức hiện ${structure}; đây là dấu hiệu mô tả xu hướng, không phải tín hiệu giao dịch độc lập.`;
            }
            const path = [firstClose, ...closes];
            let risingSteps = 0;
            let fallingSteps = 0;
            let flatSteps = 0;
            for (let index = 1; index < path.length; index++) {
                if (path[index] > path[index - 1]) risingSteps++;
                else if (path[index] < path[index - 1]) fallingSteps++;
                else flatSteps++;
            }
            const forecastHighs = forecasts.map(point => Number(point.high)).filter(Number.isFinite);
            const forecastLows = forecasts.map(point => Number(point.low)).filter(Number.isFinite);
            const projectedHigh = forecastHighs.length ? Math.max(...forecastHighs) : maxClose;
            const projectedLow = forecastLows.length ? Math.min(...forecastLows) : minClose;
            const projectedRangePct = firstClose ? ((projectedHigh - projectedLow) / firstClose) * 100 : 0;
            const forecastBarRangePct = forecasts.reduce((sum, point) => {
                const high = Number(point.high);
                const low = Number(point.low);
                const close = Number(point.close);
                return sum + (close ? ((high - low) / close) * 100 : 0);
            }, 0) / forecasts.length;
            const candlePattern = describeForecastCandlePattern(forecasts);
            document.getElementById('explanation-pattern').textContent =
                `Mẫu hình nến gần giống: ${candlePattern}. Đây là cách đối chiếu hình dạng OHLC của các nến dự báo với một số mẫu nến phổ biến; chỉ là nét tương đồng hình học, không khẳng định mô hình AI đã nhận diện hay mẫu hình sẽ lặp lại ngoài thị trường.`;

            // A transparent heuristic estimate, not a statistically calibrated probability.
            const forecastSign = changePercent > 0.1 ? 'up' : changePercent < -0.1 ? 'down' : 'flat';
            const directionalSteps = risingSteps + fallingSteps;
            const stepAgreement = directionalSteps ? (forecastSign === 'up' ? risingSteps : fallingSteps) / directionalSteps : 0.5;
            let directionScore = 50;
            if (forecastSign !== 'flat') {
                if (Math.abs(recentMove) > 0.1) directionScore += Math.sign(recentMove) === Math.sign(changePercent) ? 8 : -8;
                if (maDirection !== 'mixed') directionScore += (maDirection === forecastSign ? 8 : -8);
                directionScore += stepAgreement >= 0.65 ? 6 : stepAgreement <= 0.35 ? -6 : 0;
            }
            result.direction_estimate = {
                percent: Math.round(Math.max(35, Math.min(65, directionScore))),
                direction: forecastSign,
                step_agreement: stepAgreement
            };
            document.getElementById('explanation-recent-context').textContent =
                `Bối cảnh gần đây: giá đóng cửa trung bình của ${context.comparison_candles || 20} nến gần nhất ${recentDirection} ${Math.abs(recentMove).toFixed(2)}% so với nhóm nến liền trước; biên độ cao–thấp trung bình là ${Number(context.recent_range_pct || 0).toFixed(2)}% mỗi nến. ${technicalStructure} ${directionRelation}`;
            document.getElementById('explanation-projected-move').textContent =
                `Đường dự báo ${forecastDirection}: giá đóng cửa cuối kỳ chênh ${amountChange >= 0 ? '+' : '−'}${formatPrice(Math.abs(amountChange))} (${changePercent >= 0 ? '+' : '−'}${Math.abs(changePercent).toFixed(2)}%) so với nến mốc. Trong ${forecasts.length} bước, ${risingSteps} bước tăng, ${fallingSteps} bước giảm và ${flatSteps} bước đi ngang. Dải cao–thấp dự báo là ${formatPrice(projectedLow)}–${formatPrice(projectedHigh)} (rộng ${projectedRangePct.toFixed(2)}% so với giá mốc); biên độ nến dự báo trung bình ${forecastBarRangePct.toFixed(2)}% so với ${Number(context.recent_range_pct || 0).toFixed(2)}% gần đây. Các con số này cho biết độ lớn và độ liền mạch của đường dự báo, không phải xác suất đạt mục tiêu.`;
            document.getElementById('explanation-limits').textContent =
                'Cách đọc: hướng dự báo được đối chiếu với biến động gần đây và vị trí giá so với MA(7/25/99); độ lớn được tính từ giá đóng cửa mốc đến cuối kỳ, còn dải cao–thấp mô tả biên độ toàn đường đi. Mô hình nhận diện mẫu hình OHLCV, không hiểu nguyên nhân như tin tức, dòng tiền hay sự kiện. Vì vậy đây là diễn giải định lượng về đầu vào và đầu ra, không khẳng định chắc chắn giá sẽ tăng/giảm hoặc chạm toàn bộ dải giá.';
            summary.style.display = 'block';
        }

        function describeForecastCandlePattern(points) {
            const candles = points.slice(-3).map(point => ({
                open: Number(point.open), high: Number(point.high), low: Number(point.low), close: Number(point.close)
            })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite));
            if (!candles.length) return 'chưa đủ dữ liệu OHLC để đối chiếu';
            const last = candles[candles.length - 1];
            const range = Math.max(last.high - last.low, Number.EPSILON);
            const body = Math.abs(last.close - last.open);
            const upperWick = last.high - Math.max(last.open, last.close);
            const lowerWick = Math.min(last.open, last.close) - last.low;
            if (body / range <= 0.1) return 'Doji (thân nến rất nhỏ so với toàn biên độ), thường thể hiện sự lưỡng lự';
            if (lowerWick >= body * 2 && upperWick <= body) return 'nến Búa (Hammer), có bóng dưới dài';
            if (upperWick >= body * 2 && lowerWick <= body) return 'nến Sao băng (Shooting Star), có bóng trên dài';
            if (candles.length >= 2) {
                const previous = candles[candles.length - 2];
                const bullishEngulfing = previous.close < previous.open && last.close > last.open && last.open <= previous.close && last.close >= previous.open;
                const bearishEngulfing = previous.close > previous.open && last.close < last.open && last.open >= previous.close && last.close <= previous.open;
                if (bullishEngulfing) return 'nhấn chìm tăng (Bullish Engulfing) giữa hai nến cuối';
                if (bearishEngulfing) return 'nhấn chìm giảm (Bearish Engulfing) giữa hai nến cuối';
                if (last.high < previous.high && last.low > previous.low) return 'Inside Bar (nến nằm trong biên độ nến trước), chưa tự cho biết hướng';
            }
            return 'chưa khớp rõ với các mẫu đơn giản như Doji, Búa, Sao băng, nhấn chìm hoặc Inside Bar';
        }

        function displayFuturesScenario(result) {
            const plan = result.futures_scenario;
            if (!plan) return;
            const biasText = {
                long: 'LONG (thiên tăng theo dự báo). Đây là hướng kịch bản của mô hình, chưa phải tín hiệu vào lệnh.',
                short: 'SHORT (thiên giảm theo dự báo). Đây là hướng kịch bản của mô hình, chưa phải tín hiệu vào lệnh.',
                neutral: `ĐỨNG NGOÀI: chưa có hướng đủ rõ. Dự báo thay đổi ${Number(plan.forecast_change_pct).toFixed(2)}%, thấp hơn ngưỡng lọc ${Number(plan.direction_threshold_pct).toFixed(2)}%.`
            };
            document.getElementById('futures-bias').textContent = biasText[plan.bias] || biasText.neutral;
            const estimate = result.direction_estimate;
            document.getElementById('futures-direction-estimate').textContent = plan.bias === 'neutral'
                ? 'Tỷ lệ tham khảo: chưa ước tính vì đường dự báo chưa thể hiện hướng tăng/giảm đủ rõ.'
                : `Ước tính kỹ thuật đi đúng hướng ${estimate?.percent ?? '—'}% (${plan.bias === 'long' ? 'tăng' : 'giảm'}). Đây là điểm tham khảo theo mức đồng thuận giữa biến động gần đây, MA(7/25/99) và tỷ lệ bước dự báo cùng hướng; chưa được hiệu chỉnh bằng kiểm định lịch sử nên không phải xác suất thống kê hay cam kết thị trường.`;

            const horizon = result.forecast_horizon;
            if (horizon) {
                const intervalMinutes = Number(horizon.interval_minutes);
                const intervalLabel = intervalMinutes < 60
                    ? `${intervalMinutes} phút`
                    : intervalMinutes % 1440 === 0
                        ? `${intervalMinutes / 1440} ngày`
                        : `${intervalMinutes / 60} giờ`;
                const durationHours = Number(horizon.duration_hours);
                const durationLabel = durationHours >= 24
                    ? `${(durationHours / 24).toFixed(durationHours % 24 === 0 ? 0 : 1)} ngày`
                    : `${durationHours.toFixed(durationHours % 1 === 0 ? 0 : 1)} giờ`;
                const start = horizon.start ? new Date(horizon.start).toLocaleString('vi-VN') : '';
                const end = horizon.end ? new Date(horizon.end).toLocaleString('vi-VN') : '';
                document.getElementById('futures-horizon').textContent =
                    `Thời hạn mô hình: ${horizon.bars} nến × ${intervalLabel} ≈ ${durationLabel} (${horizon.style})${start && end ? ` Từ ${start} đến ${end}.` : ''}`;
            }
            document.getElementById('futures-leverage').textContent =
                'Đòn bẩy: mô hình không thể xác định mức x phù hợp từ dữ liệu giá. Nó không biết số dư, mức lỗ tối đa, bậc ký quỹ hay giá thanh lý của hợp đồng; đừng lấy hướng dự báo này làm căn cứ chọn đòn bẩy.';

            const levels = document.getElementById('futures-levels');
            const targetCheck = document.getElementById('futures-target-check');
            const dca = document.getElementById('futures-dca');
            const formula = document.getElementById('futures-formula');
            if (plan.bias === 'neutral' || !plan.entry_zone) {
                levels.style.display = 'none';
                targetCheck.textContent = '';
                dca.textContent = 'DCA: Không đề xuất DCA khi mô hình chưa cho hướng rõ ràng.';
                formula.textContent = `ATR(14) hiện tại: ${formatPrice(plan.atr14)} (${Number(plan.atr14_pct).toFixed(2)}% giá tham chiếu).`;
                return;
            }

            levels.style.display = 'grid';
            document.getElementById('futures-entry').textContent = `${formatPrice(plan.entry_zone[0])} – ${formatPrice(plan.entry_zone[1])}`;
            document.getElementById('futures-stop').textContent = formatPrice(plan.stop_loss);
            document.getElementById('futures-tp1').textContent = formatPrice(plan.take_profit_1);
            document.getElementById('futures-tp2').textContent = formatPrice(plan.take_profit_2);

            const tp1Text = plan.tp1_within_forecast ? 'Đường dự báo chạm TP1' : 'Đường dự báo không chạm TP1';
            const tp2Text = plan.tp2_within_forecast ? 'và chạm TP2' : 'và không chạm TP2';
            targetCheck.textContent = `${tp1Text} ${tp2Text} trong kỳ ${result.prediction_results.length} nến. Đây chỉ là phép đối chiếu với đường dự báo, không phải xác suất đạt mục tiêu.`;
            dca.textContent = 'DCA: Không nên tự động bình quân giá khi vị thế đang lỗ. Kịch bản này không đề xuất thêm vị thế; nếu chia lệnh, cần định trước tổng mức lỗ tối đa và giữ nguyên điểm cắt lỗ.';
            formula.textContent = `Cách tính minh bạch: ATR(14) = ${formatPrice(plan.atr14)} (${Number(plan.atr14_pct).toFixed(2)}% giá tham chiếu); vùng vào quanh giá đóng cửa mốc ±0.25 ATR; cắt lỗ 1.5 ATR; TP1 1R và TP2 2R, cùng neo tại giá đóng cửa tham chiếu. Nếu khớp lệnh lệch trong vùng entry, tỷ lệ R thực tế sẽ đổi. Không tính khối lượng lệnh vì chưa có vốn và mức rủi ro bạn chấp nhận.`;
        }

        // Display comparison analysis
        function displayComparisonAnalysis(result) {
            document.getElementById('comparison-section').style.display = 'block';

            // Update comparison information
            document.getElementById('prediction-type').textContent = result.prediction_type;
            document.getElementById('comparison-data').textContent = `${result.actual_data.length} điểm dữ liệu thực tế`;
            document.getElementById('comparison-unit').textContent = currentPriceUnit;

            // Calculate error statistics
            const errorStats = getPredictionQuality(result.prediction_results, result.actual_data);

            // Display error statistics
            document.getElementById('mae').textContent = formatPrice(errorStats.mae);
            document.getElementById('rmse').textContent = formatPrice(errorStats.rmse);
            document.getElementById('mae-unit').textContent = `Sai số giá (${currentPriceUnit})`;
            document.getElementById('rmse-unit').textContent = `Sai số giá (${currentPriceUnit})`;
            document.getElementById('mape').textContent = errorStats.mape.toFixed(2);

            // Fill comparison table
            fillComparisonTable(result.prediction_results, result.actual_data);
        }

        // Calculate prediction quality metrics
        function getPredictionQuality(predictions, actuals) {
            if (!predictions || !actuals || predictions.length === 0 || actuals.length === 0) {
                return { mae: 0, rmse: 0, mape: 0 };
            }

            const minLen = Math.min(predictions.length, actuals.length);
            let mae = 0, rmse = 0, mape = 0;

            for (let i = 0; i < minLen; i++) {
                const pred = predictions[i];
                const act = actuals[i];

                // Use closing price to calculate errors
                const error = Math.abs(pred.close - act.close);
                const percentError = (error / act.close) * 100;

                mae += error;
                rmse += error * error;
                mape += percentError;
            }

            mae /= minLen;
            rmse = Math.sqrt(rmse / minLen);
            mape /= minLen;

            return { mae, rmse, mape };
        }

                    // Fill comparison table
        function fillComparisonTable(predictions, actuals) {
            const tbody = document.getElementById('comparison-tbody');
            tbody.innerHTML = '';

            const minLen = Math.min(predictions.length, actuals.length);

            for (let i = 0; i < minLen; i++) {
                const pred = predictions[i];
                const act = actuals[i];

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(pred.timestamp).toLocaleString("vi-VN")}</td>
                    <td>${formatPrice(act.open)}</td>
                    <td>${formatPrice(pred.open)}</td>
                    <td>${formatPrice(act.high)}</td>
                    <td>${formatPrice(pred.high)}</td>
                    <td>${formatPrice(act.low)}</td>
                    <td>${formatPrice(pred.low)}</td>
                    <td>${formatPrice(act.close)}</td>
                    <td>${formatPrice(pred.close)}</td>
                `;
                tbody.appendChild(row);
            }
        }

        // Set up event listeners
        function setupEventListeners() {
            const symbolInput = document.getElementById('binance-symbol');
            let previousSymbol = symbolInput.value;
            symbolInput.addEventListener('focus', () => {
                previousSymbol = symbolInput.value;
                symbolInput.value = '';
            });
            symbolInput.addEventListener('blur', () => {
                symbolInput.value = symbolInput.value.trim().toUpperCase() || previousSymbol;
            });
            const settingsToggle = document.getElementById('settings-toggle');
            settingsToggle.addEventListener('click', () => {
                const open = document.body.classList.toggle('settings-open');
                settingsToggle.setAttribute('aria-expanded', String(open));
            });
            document.getElementById('open-settings').addEventListener('click', () => {
                document.body.classList.add('settings-open');
                settingsToggle.setAttribute('aria-expanded', 'true');
                document.getElementById(document.getElementById('stock-tab').classList.contains('active') ? 'vnstock-symbol' : 'binance-symbol').focus();
            });
            document.getElementById('coin-tab').addEventListener('click', () => selectMarketTab('coin-tab'));
            document.getElementById('stock-tab').addEventListener('click', () => selectMarketTab('stock-tab'));

            // Load model button
            document.getElementById('load-model-btn').addEventListener('click', loadModel);

            // Load data button
            document.getElementById('load-data-btn').addEventListener('click', loadData);
            document.getElementById('data-file-select').addEventListener('change', function() {
                previewDataFile(this.value);
            });

            // Fetch Binance market data button
            document.getElementById('fetch-binance-btn').addEventListener('click', fetchBinanceData);

            // Fetch Vietnamese equity candles through Vnstock
            document.getElementById('fetch-vnstock-btn').addEventListener('click', fetchVnstockData);

            // Prediction button
            document.getElementById('predict-btn').addEventListener('click', startPrediction);

            // Change only the chart's candle aggregation; do not rerun the model.
            document.getElementById('chart-interval').addEventListener('change', () => { chartRangeToRestore = null; renderPredictionChart(); });
            document.getElementById('chart-activity').addEventListener('change', renderPredictionChart);
            document.getElementById('chart-density').addEventListener('change', () => { chartRangeToRestore = null; renderPredictionChart(); });
            document.getElementById('chart-expand').addEventListener('click', () => {
                const expanded = document.body.classList.toggle('chart-expanded');
                document.getElementById('chart-expand').setAttribute('aria-pressed', String(expanded));
                document.getElementById('chart-expand').textContent = expanded ? 'Thu gọn ⤡' : 'Mở rộng ⤢';
                renderPredictionChart();
            });
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && document.body.classList.contains('chart-expanded')) document.getElementById('chart-expand').click();
            });

            document.getElementById('prediction-mode').addEventListener('change', function() {
                document.getElementById('time-window-section').style.display = this.value === 'backtest' ? 'block' : 'none';
            });

            // Prediction quality parameter sliders
            document.getElementById('temperature').addEventListener('input', function() {
                document.getElementById('temperature-value').textContent = this.value;
            });

            document.getElementById('top-p').addEventListener('input', function() {
                document.getElementById('top-p-value').textContent = this.value;
            });

            // Update slider when lookback window size changes
            document.getElementById('lookback').addEventListener('input', updateSliderFromInputs);
            document.getElementById('pred-len').addEventListener('input', updateSliderFromInputs);
        }

        // Display status information
        function showStatus(type, message) {
            const statusDiv = document.getElementById('model-status');
            statusDiv.className = `status ${type}`;
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';

            // Auto-hide
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }

        // Show/hide loading status
        function showLoading(show) {
            const loadingDiv = document.getElementById('loading');
            if (show) {
                loadingDiv.classList.add('show');
            } else {
                loadingDiv.classList.remove('show');
            }
        }

        function clearAnalysisForChat() {
            const previous = latestAnalysisForChat;
            latestPredictionForChat = null;
            latestAnalysisForChat = null;
            if (previous) window.dispatchEvent(new CustomEvent('financial-analysis-changed'));
        }

        function publishAnalysisForChat(result) {
            const points = result.prediction_results || [];
            if (!points.length || !result.reference_data) { clearAnalysisForChat(); return; }
            const scaled = value => value == null ? null : Number(value) * currentPriceScale;
            const closes = points.map(point => scaled(point.close)).filter(Number.isFinite);
            if (!closes.length) { clearAnalysisForChat(); return; }
            const text = id => document.getElementById(id)?.textContent?.trim() || '';
            const plan = result.futures_scenario;
            const scenario = plan ? { ...plan } : null;
            if (scenario) {
                for (const field of ['reference_close', 'atr14', 'stop_loss', 'take_profit_1', 'take_profit_2', 'projected_favorable_price']) scenario[field] = scaled(plan[field]);
                scenario.entry_zone = plan.entry_zone?.map(scaled) || null;
            }
            latestAnalysisForChat = {
                analysis_id: `analysis-${Date.now()}-${++analysisSequence}`,
                symbol: text('instrument-symbol'), unit: currentPriceUnit,
                prediction_type: result.prediction_type,
                reference_timestamp: result.reference_data.timestamp,
                forecast_summary: {
                    reference_close: scaled(result.reference_data.close), final_close: closes[closes.length - 1],
                    min_close: Math.min(...closes), max_close: Math.max(...closes), bars: points.length,
                    min_low: Math.min(...points.map(point => scaled(point.low))),
                    max_high: Math.max(...points.map(point => scaled(point.high)))
                },
                forecast_horizon: result.forecast_horizon || null,
                context_analysis: result.context_analysis || null,
                direction_estimate: result.direction_estimate || null,
                futures_scenario: scenario,
                displayed_analysis: {
                    summary_note: text('forecast-summary-note'), recent_context: text('explanation-recent-context'),
                    projected_move: text('explanation-projected-move'), candle_pattern: text('explanation-pattern'),
                    limits: text('explanation-limits'),
                    scenario_bias: plan ? text('futures-bias') : '',
                    direction_estimate: plan ? text('futures-direction-estimate') : '',
                    horizon: plan ? text('futures-horizon') : '',
                    target_check: plan ? text('futures-target-check') : '',
                    dca: plan ? text('futures-dca') : '', leverage: plan ? text('futures-leverage') : '',
                    calculation: plan ? text('futures-formula') : ''
                },
                comparison: result.has_comparison ? {
                    mae: text('mae'), rmse: text('rmse'), mape: text('mape'),
                    actual_bars: (result.actual_data || []).length
                } : null
            };
            window.dispatchEvent(new CustomEvent('financial-analysis-changed'));
        }

        window.getFinancialChatContext = function() {
            return {
                file_path: currentDataFile, price_unit: currentPriceUnit,
                dataset_label: currentDataFile ? currentDataFile.split(/[\\/]/).pop() : null,
                analysis: latestAnalysisForChat ? JSON.parse(JSON.stringify(latestAnalysisForChat)) : null
            };
        };
