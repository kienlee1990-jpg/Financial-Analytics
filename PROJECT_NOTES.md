# Ghi nhớ dự án Kronos

> **Cấu trúc hiện tại sau sắp xếp 16/11/2026:** ứng dụng ở `app/api.py`, các service ở `app/services/`, tài nguyên giao diện ở `app/static/` và `app/templates/`, worker ở `app/workers/`. `webui/*.py` chỉ chuyển tiếp để giữ import/lệnh cũ. Xem `docs/STRUCTURE.md`. Các ghi chú theo thời gian bên dưới có thể nhắc đường dẫn trước khi chuyển.

Cập nhật: 12/11/2026. Tài liệu ghi nhận mã nguồn cục bộ khi đọc dự án; cần đối chiếu lại mã trước khi sửa. Người dùng muốn trao đổi bằng tiếng Việt.

## Mục đích và công nghệ

- Dự báo chuỗi nến tài chính bằng mô hình Kronos; giao diện mang tên Financial Forecast, có tab Coin và Chứng khoán.
- Backend Python, Flask + Flask-CORS, phục vụ cục bộ bằng Waitress. Xử lý dữ liệu bằng pandas/numpy; suy luận bằng PyTorch và tải trọng số qua Hugging Face Hub.
- Frontend nằm trong `webui/templates/index.html`, gồm HTML/CSS/JavaScript, Axios và Plotly từ CDN; không có ứng dụng React hay quy trình build Node chính.
- Có phần huấn luyện/tinh chỉnh tokenizer, predictor và ví dụ backtest riêng.

## Điểm vào và cách chạy

- Từ thư mục gốc chạy `./start` hoặc `python3 start`.
- Chuỗi khởi động: `start` → `run.py` → `webui/run.py` → `webui/app.py`.
- `run.py` chuyển thư mục làm việc sang `webui`, ưu tiên Python trong `.venv` khi khởi chạy từ Python hệ thống.
- `webui/run.py` kiểm tra thư viện, có nhắc cài nếu thiếu; dùng Waitress tại `127.0.0.1:7070`, 8 threads và tự mở trình duyệt.
- Thư viện khai báo ở `requirements.txt` và `webui/requirements.txt`.
- VNStock chạy riêng trong `.venv-vnstock`; `python3 setup_vnstock.py` thiết lập runtime Python 3.11 cho Mac Apple Silicon, kiểm tra SHA-256 và cài `vnstock>=5.0.5`. Script hiện dành cho arm64 macOS.

## Bản đồ mã nguồn

| Vị trí | Vai trò |
| --- | --- |
| `model/kronos.py` | `KronosTokenizer`, `Kronos`, sinh tự hồi quy, `KronosPredictor.predict()` và `predict_batch()` |
| `model/module.py` | Binary Spherical Quantization, RoPE attention, TransformerBlock, RMSNorm, embedding phân cấp/thời gian, dual head |
| `model/__init__.py` | Xuất các lớp mô hình và hàm tra cứu lớp |
| `webui/app.py` | Đọc dữ liệu, API nguồn dữ liệu/mô hình/dự báo, biểu đồ và lưu JSON kết quả |
| `webui/templates/index.html` | Toàn bộ giao diện, trạng thái phía trình duyệt, gọi API, chọn thời gian, biểu đồ, diễn giải và đối chiếu |
| `webui/vnstock_worker.py` | Lấy OHLCV qua `Market`, thử nguồn VCI rồi KBS; chuẩn hóa, bỏ trùng, sắp thời gian; trả JSON qua stdout |
| `webui/vnstock_symbols_worker.py` | Danh sách mã và tên công ty qua `Listing(source='vci')` |
| `data/` | CSV/Feather đầu vào; dữ liệu tải từ Binance/VNStock cũng lưu tại đây |
| `webui/prediction_results/` | Các tệp `prediction_YYYYMMDD_HHMMSS.json` |
| `finetune/` | Tiền xử lý Qlib, dataset cửa sổ trượt, huấn luyện tokenizer/predictor và backtest |
| `finetune_csv/` | Tinh chỉnh từ CSV, cấu hình YAML, chạy lần lượt tokenizer rồi predictor, hỗ trợ DDP |
| `examples/` | Dự báo đơn/lô/thiếu volume, dữ liệu thị trường và backtest mẫu |
| `tests/test_kronos_regression.py` | Regression và MSE của predictor trên CPU, có dữ liệu chuẩn trong `tests/data/` |

## Luồng dữ liệu và dự báo

1. Chọn tệp có sẵn hoặc tải nến trực tuyến, lưu thành CSV rồi xem thông tin qua `/api/load-data`.
2. Chọn và tải mô hình qua `/api/load-model`; backend giữ tokenizer/model/predictor trong biến toàn cục của tiến trình.
3. Frontend gửi `/api/predict` với `file_path`, `lookback`, `pred_len`, `forecast_future`, `start_date` khi cần, `temperature`, `top_p`, `sample_count`.
4. Giao diện dùng 400 nến lịch sử và 120 nến dự báo; backend yêu cầu lookback ít nhất 400 nhưng nhận pred_len từ request.
5. Chế độ tương lai dùng các nến cuối cùng, tạo thời gian tương lai theo chênh lệch hai mốc cuối. Chế độ lịch sử có `start_date` dùng cửa sổ bắt đầu từ mốc đã chọn và các nến kế tiếp để đối chiếu.
6. Predictor chuẩn hóa 6 đặc trưng OHLC/volume/amount, clip, mã hóa thành token phân cấp, sinh tự hồi quy, giải mã và đưa về thang đo ban đầu. Các mẫu được tổng hợp trong luồng suy luận.
7. API trả biểu đồ, nến dự báo/thực tế, giá tham chiếu, phân tích bối cảnh, thời hạn dự báo và kịch bản Futures theo ATR; đồng thời lưu JSON kết quả.

Đầu vào bắt buộc: `open`, `high`, `low`, `close`; thời gian nhận `timestamps`, `timestamp` hoặc `date`. Thiếu thời gian thì loader tạo chuỗi giờ từ 01/01/2024. Thiếu volume thì predictor điền 0 cho volume/amount; có volume mà thiếu amount thì tính từ volume nhân giá OHLC trung bình. API web hiện chỉ chuyển OHLC và volume sang predictor, không chuyển amount gốc.

## Mô hình trong cấu hình Web UI

| Khóa | Model Hub | Tokenizer | Context |
| --- | --- | --- | --- |
| `kronos-mini` | `NeoQuasar/Kronos-mini` | `NeoQuasar/Kronos-Tokenizer-2k` | 2048 |
| `kronos-small` | `NeoQuasar/Kronos-small` | `NeoQuasar/Kronos-Tokenizer-base` | 512 |
| `kronos-base` | `NeoQuasar/Kronos-base` | `NeoQuasar/Kronos-Tokenizer-base` | 512 |

Predictor tự chọn CUDA → MPS → CPU nếu không chỉ định; API tải mô hình mặc định nhận CPU và giao diện cho chọn thiết bị.

## API và nguồn bên ngoài

- `GET /`, `/api/data-files`, `/api/available-models`, `/api/model-status`.
- `GET /api/binance-symbols`: danh sách cặp Spot USDT, cache 1 giờ, có danh sách dự phòng.
- `POST /api/binance-klines`: `api1.binance.com`, giới hạn 520–1000 nến, bỏ nến chưa đóng, lưu `data/binance_{symbol}_{interval}.csv`.
- `GET /api/vnstock-symbols`: worker riêng, cache 12 giờ, danh sách dự phòng.
- `POST /api/vnstock-klines`: worker riêng, 400–1000 nến yêu cầu; cần ít nhất 400 nến trả về; API key tùy chọn truyền qua biến môi trường `VNSTOCK_API_KEY` vào worker.
- `POST /api/load-data`, `/api/load-model`, `/api/predict`.

## Lưu ý để tiếp tục làm việc

- Tại lần đọc này đã có nhiều thay đổi chưa commit trong README, launcher, Web UI, dữ liệu và kết quả. Giữ nguyên thay đổi sẵn có khi thực hiện yêu cầu sau.
- Thông báo khởi động còn nhắc dự báo mô phỏng khi thiếu thư viện, nhưng `/api/predict` thực tế từ chối dự báo nếu chưa có mô hình đã tải.
- Nhánh lịch sử không có `start_date` lấy phần đầu tệp dù nhãn nói “latest”; phần timestamp JSON của nhánh này lại tính từ cuối tệp. Cần kiểm tra nếu sửa logic thời gian.
- Mốc tương lai hiện suy từ khoảng thời gian nến, chưa thấy lịch phiên giao dịch cổ phiếu trong nhánh này.
- Cấu hình fine-tune chứa đường dẫn mẫu và cần chỉnh trước khi huấn luyện.
- Test regression tải model/tokenizer với revision cố định, dùng CPU và seed cố định; đây không phải bộ test đầy đủ cho Web UI.
- Lần đọc này chỉ khảo sát mã và tạo ghi chú; chưa khởi động máy chủ, tải trọng số, chạy suy luận hay chạy test để xác nhận vận hành.

## Giao diện cập nhật 15/11/2026

- Giao diện Prediction Studio nền xanh đen, điểm nhấn xanh lá; CSS tách sang `webui/static/dashboard.css`, template giữ các ID và API hiện có.
- Tham khảo danh mục Design System trong `/Users/xuandieu/Desktop/Lập trình codex/ThietkeUI/README.md`; thư mục này không chứa SKILL.md.
- Có breakpoint cho điện thoại, trạng thái biểu đồ chưa có dữ liệu, focus bàn phím, skip link và giảm chuyển động. Thanh chọn thời gian chuyển sang pointer events để nhận cả chạm và chuột.
- Đã kiểm tra cú pháp JS, nesting HTML, ID/label và API đọc dữ liệu; chưa kiểm tra trực quan vì trình xem trước từ chối quyền mở localhost. Chưa chạy suy luận mô hình trong lần đổi giao diện.

- Theo yêu cầu tiếp theo của người dùng: giữ bố cục Prediction Studio, đổi toàn bộ giao diện sang nền sáng kem/trắng và xanh ngọc theo tông cũ; `data-theme="light"` đồng bộ màu Plotly.

## Bố cục terminal phân tích (15/11/2026)

- Theo phản hồi mới nhất: bỏ hero quảng bá; thanh điều hướng navy gọn, nền trắng/xám, nút xanh dương. Biểu đồ bên trái và bảng thiết lập cuộn riêng bên phải; điện thoại có nút mở/đóng thiết lập.
- Nguồn dữ liệu đặt trước mô hình trong bảng thiết lập; hướng dẫn và tham số nâng cao được thu gọn.
- `/api/load-data` bổ sung `preview_chart` của tối đa 400 nến cuối và `last_candle` để hiển thị OHLC/khối lượng từ dữ liệu thực trước khi suy luận. Frontend vẫn xử lý được response cũ nếu backend chưa khởi động lại.
- Kiểm tra: nesting HTML, ID/label, API, dữ liệu preview trên 3 CSV; kiểm tra logic chuẩn bị biểu đồ bằng Node trên 12 tổ hợp kích thước/khung nến/volume-amount. Chưa xác minh trực quan bằng trình duyệt.
- Máy chủ 7070 đang giữ mô hình trên MPS; không tự dừng tiến trình đó. Cần khởi động lại ứng dụng để backend nhận các trường preview mới.

- Điều chỉnh màu theo yêu cầu mới: nền trắng/xám sáng hơi ấm, thanh đầu trang trắng kem, nút xanh lá, tab xanh nhạt và nhãn dữ liệu vàng nhạt. Giữ bố cục terminal.

- Tăng mảng màu theo yêu cầu: nền xanh sage sáng, bảng thiết lập/toolbar xanh nhạt, hàng OHLC vàng kem, tab đang chọn vàng ấm; giữ vùng vẽ biểu đồ sáng và bố cục cũ.

- Logo K vector ở `webui/static/kronos-mark.svg`: nền emerald, nét dọc trắng ngà và hai nhánh vàng; dùng chung ở thanh thương hiệu và favicon.

- Logo chốt theo yêu cầu: chữ K liền nét màu vàng `#F6D56F`, nằm giữa khung xanh `#18764F`; dùng hình học SVG thay vì font để giữ căn giữa ổn định.

- Máy chủ Waitress cache template: HTTP `/` vẫn có span K cũ sau khi sửa template. `.brand-mark` dùng SVG làm background và ẩn chữ span cũ để logo vàng căn giữa hiển thị ngay mà không phải dừng mô hình đang chạy.

- Làm gọn bằng CSS tương thích template đang cache: nhóm nguồn dữ liệu/mô hình thành khối đánh số, ghép khung nến và số lượng vào một hàng, cặp model/thiết bị cùng hàng, phân cách các giá OHLC, thu gọn thông số chỉ đọc, giữ bảng điều khiển bên phải và nền xanh/vàng sáng.

## Biểu đồ xanh/đỏ và góc nhìn cận cảnh

- Theo ảnh tham khảo: nến và volume dùng xanh `#20b983` / đỏ `#f6465d`, thân nến tô đặc, MA cam/hồng/tím giữ lại. Giá ở trục phải, biểu đồ desktop cao tối thiểu 640px, điện thoại 520px.
- Góc nhìn mặc định 80 nến quanh ranh giới lịch sử/dự báo nếu có; chọn được 160 nến hoặc toàn bộ. Dữ liệu giữ nguyên; trục giá khớp biên độ nến đang nhìn. Có Mở rộng/Thu gọn và phím Escape.
- JavaScript chuyển sang `webui/static/dashboard.js`; bật TEMPLATES_AUTO_RELOAD để tránh lặp lại lỗi template cũ.
- Đã khởi động lại máy chủ 7070 và xác nhận HTTP trả control/script mới cùng API preview hoạt động. Mô hình cần tải lại sau restart.
- Kiểm tra logic 12 tổ hợp desktop/mobile, khung nến, volume/amount; kiểm tra 80 nến quanh điểm bắt đầu dự báo và chuyển lại toàn bộ 520 nến. Chưa kiểm tra trực quan trong trình duyệt.

## Dữ liệu trực tuyến dùng tạm (16/11/2026)

- Theo yêu cầu người dùng: Binance/VNStock không tự ghi CSV vào `data/`. DataFrame lưu trong RAM với tham chiếu `memory://<uuid>/<tên-nguồn>.csv`; hậu tố chỉ để giữ nhận diện nguồn, không phải tệp thật.
- Bộ nhớ tạm tối đa 8 tập dữ liệu, hết hạn sau 2 giờ không dùng, được giải phóng khi nhận beacon đóng trang; hết hạn được dọn khi bộ nhớ tạm được truy cập. Khởi động lại máy chủ cũng xóa dữ liệu tạm.
- `load_data_file` nhận cả tham chiếu tạm và đường dẫn tệp cũ. `/api/load-data` và `/api/predict` tiếp tục dùng được dữ liệu tạm; kết quả dự báo trên dữ liệu tạm không tự lưu JSON.
- `/api/release-data` chỉ giải phóng bộ nhớ theo danh sách tham chiếu; không xóa tệp có sẵn. Dropdown thêm dữ liệu tạm cho trang đang dùng; không đưa dữ liệu tạm vào danh sách tệp trên ổ đĩa.
- Kiểm tra 5 unittest cho fetch Binance/VNStock, preview, predict bằng stub, không ghi tệp, expiry/giới hạn RAM/giải phóng; kiểm tra JS chọn dữ liệu tạm và beacon. Máy chủ 7070 đã khởi động lại với hành vi mới.

- Icon SVG nét mảnh dùng sprite cục bộ `webui/static/icons.svg`: nguồn dữ liệu, CPU/mô hình, tải dữ liệu, dự báo, tham số và hướng dẫn. Icon trang trí được ẩn với trình đọc màn hình, giữ nhãn chữ; không cần CDN.

- Trang trí bổ sung: nền mint/kem chuyển nhẹ, icon tiêu đề vàng, nét biểu đồ trang trí trong đầu trang (`workspace-motif.svg`), ô OHLC thành các thẻ tách biệt và trạng thái chờ biểu đồ có icon nến/ba bước ngắn. Họa tiết chỉ mang tính trang trí, không dùng làm dữ liệu thị trường.

- Tên hiển thị mới nhất là `Financial Analytics`, bỏ phụ đề tiếng Việt tại thương hiệu; dùng font thư pháp nhẹ (Snell Roundhand/Apple Chancery/Segoe Script, có fallback cursive), giữ logo K vàng.

- Theo yêu cầu cuối: Financial Analytics dùng chữ thẳng sans-serif theo font giao diện, bỏ font thư pháp.

## Chatbot AI (16/11/2026)

- Người dùng chọn AI trò chuyện tự do qua nhà cung cấp do mình chọn: OpenAI Responses API, model mặc định `gpt-4.1-mini`.
- Backend `webui/chatbot.py`, blueprint đăng ký trong `webui/app.py`: `GET /api/chat/status`, `POST /api/chat`. Thư viện `openai>=2,<3` và `python-dotenv>=1,<2` nằm trong `webui/requirements.txt`; startup kiểm tra cả hai.
- Đọc `OPENAI_API_KEY`/`OPENAI_MODEL` từ biến môi trường hoặc `.env` gốc mỗi yêu cầu. `.env` mẫu trống đã tạo, không đưa vào Git, quyền 600. `.env.example` dùng làm mẫu. Chưa có API key nên chưa thử trả lời AI thật.
- Frontend `webui/static/chatbot.js`, khung chat nổi góc phải, có gợi ý, hội thoại mới, đóng/mở và xử lý chờ/lỗi. Lịch sử tối đa 12 tin, giữ trong RAM của trang; không localStorage hay lưu tệp.
- Tùy chọn gửi dữ liệu tới OpenAI mặc định tắt. Khi bật, chỉ gửi tóm tắt OHLC/volume/MA7-25-99/RSI Wilder14/ATR Wilder14 do backend tính, cộng tóm tắt dự báo hiện tại qua `window.getFinancialChatContext`. Không gửi cả CSV hay đường dẫn đầy đủ.
- Giới hạn câu hỏi 2000 ký tự, lịch sử không nhận role system/developer, tối đa 2 cuộc gọi đồng thời, timeout45s, `store=False`, lỗi nhà cung cấp không trả chi tiết nhạy cảm, chặn origin khác.
- Đã qua 8 unit test chatbot + 5 test dữ liệu tạm, kiểm tra logic UI bằng DOM giả lập và HTTP thực sau restart. Kiểm tra trực quan và hội thoại AI thật chưa thực hiện.

- Chatbot hỗ trợ thêm Gemini qua REST GenerateContent; chọn `CHAT_PROVIDER=gemini`, khóa `GEMINI_API_KEY`, model mặc định `gemini-3.8-flash` theo tài liệu Google hiện tại. Giữ hỗ trợ OpenAI qua `CHAT_PROVIDER=openai`. Đã đặt cấu hình cục bộ mặc định Gemini, không ghi đè khóa cũ. UI/status tự đổi tên provider và tên biến khóa. 10 unit test đã qua; chưa có khóa để kiểm tra câu trả lời Gemini thật.

## Sửa Gemini timeout (16/11/2026)

- Người dùng đã thêm Gemini key nhưng model `gemini-3.8-flash` liên tục timeout. Kiểm tra thật: danh sách model HTTP 200 trong khoảng 0,4 giây, key hợp lệ; generateContent của 3.8 không trả trong phép thử 22 giây.
- Đã chuyển `.env`, mặc định mã và mẫu sang `gemini-3.1-flash-lite`. Không thay đổi hay hiển thị khóa. Không cần restart vì cấu hình đọc lại mỗi yêu cầu.
- Đã kiểm tra thật qua `/api/chat` với Origin cùng ứng dụng: lời chào phản hồi HTTP200 trong 1,8 giây, câu hỏi MA25 có lịch sử hội thoại trong 1,62 giây. 10 unit test chatbot và test logic UI vẫn qua.

## Sắp xếp cấu trúc, giữ nguyên logic (16/11/2026)

- Tách nguyên các hàm dữ liệu, biểu đồ và kịch bản ra `app/services/data.py`, `charts.py`, `scenarios.py`; chuyển chatbot sang `app/services/chatbot.py`. Route và trạng thái mô hình vẫn ở `app/api.py` để không đổi cách gọi hay luồng dự báo.
- Đường dẫn tập trung tại `app/config.py`. Giữ nguyên `data/`, `webui/prediction_results/`, model cache, `.env`, các module mô hình/huấn luyện/ví dụ.
- Startup duy nhất ở `app/cli.py`, WSGI ở `app/wsgi.py`; các lệnh cũ là wrapper. `webui/start.sh` nay cũng dùng Waitress thay vì khởi động debug server.
- Bộ cài VNStock thực ở `scripts/setup_vnstock.py`, vẫn dùng runtime/môi trường cũ; wrapper ở gốc giữ lệnh cũ.
- Dependencies tập trung tại `requirements/model.txt` và `requirements/web.txt`; hai requirements.txt cũ chuyển tiếp. Không nâng phiên bản đang khai báo; cài từ gốc giờ gồm đủ mô hình và giao diện.
- Chỉ bỏ package-lock.json đã xác nhận rỗng; giữ toàn bộ dữ liệu/kết quả cũ. Thêm cấu hình ignore cho kết quả mới và .env phụ, luôn giữ .env.example trong Git.
- Chưa sửa kiểm soát quyền truy cập, giới hạn dự báo, lỗi timestamp hoặc trạng thái nhiều worker do yêu cầu không đổi logic. Chưa thể coi là public-production-ready chỉ vì đã sắp xếp thư mục.

- Kết quả kiểm tra đợt sắp xếp: 10 test chatbot + 5 test dữ liệu tạm + 3 test cấu trúc/khởi chạy đều qua (18 test). API/preview/ba chế độ dự báo so với baseline giống nhau; các hàm dự báo, tải mô hình và chatbot có AST không đổi. Hash mô hình, huấn luyện, ví dụ, giao diện, dữ liệu/kết quả cũ và .env không đổi. Requirements ở hai đường dẫn cài đều qua dry-run offline, pip check không báo xung đột. Máy chủ hiện chạy từ app.wsgi:app; chưa chạy CI trên GitHub.

## Hội thoại tiếp nối kết quả Kronos (16/11/2026)

- Chatbot mới lấy snapshot sau khi dashboard đã hiển thị đầy đủ dự báo và kịch bản: lời diễn giải, hướng LONG/SHORT/NEUTRAL, vùng vào, SL/TP, khung dự báo, điểm kỹ thuật và đối chiếu nếu có. Giá VNStock được đổi sang VND đúng một lần. Không thay đổi mô hình hay thuật toán dự báo.
- Khi có kết quả, tự bật gắn ngữ cảnh; chỉ gửi đến nhà cung cấp khi người dùng gửi câu hỏi. Nút “Trao đổi với AI về kết quả này” mở chat. Người dùng có thể bỏ chọn để hỏi chung. Lịch sử tiếp nối cùng analysis_id; đổi dữ liệu/kết quả thì xóa lịch sử gửi AI để tránh lẫn kết quả.
- POST /api/chat nhận analysis có allowlist và giới hạn độ dài/số hữu hạn; source=displayed_kronos_analysis. Luồng UI mới không gửi đường dẫn CSV, không đọc lại CSV; dữ liệu tạm hết hạn không ảnh hưởng snapshot đang xem. Nhánh tóm tắt CSV cũ chỉ giữ tương thích client cũ.
- 22 unittest của chatbot/dữ liệu tạm/cấu trúc và bài Node chạy renderer thực + transport chat đều qua. Full unittest discovery còn gặp dependency pytest thiếu ở test_kronos_regression có sẵn; không chạy lại hồi quy model cho thay đổi chatbot.
- Đã restart Waitress 7070 từ app.wsgi:app. Gemini thực nhận dữ liệu giả lập trả đúng TP2=94, SL=103 trong 1,74s và câu hỏi tiếp TP1=97 trong 1,50s. Không gửi dữ liệu thị trường thật trong smoke test. Người dùng cần tải lại trang, nạp mô hình/dữ liệu và chạy dự báo một lần để có snapshot mới.
