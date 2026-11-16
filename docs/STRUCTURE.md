# Cấu trúc Financial Analytics

Đợt sắp xếp này chỉ tách module, chuyển tài nguyên và thống nhất cách khởi chạy. Thuật toán Kronos, tham số mặc định, API và cách tính chỉ báo không được sửa.

```text
app/
  api.py                  Flask app và các route hiện có
  cli.py                  Khởi chạy local bằng Waitress
  config.py               Đường dẫn thư mục dự án
  wsgi.py                 Điểm vào cho WSGI server
  services/
    data.py               Đọc tệp, bộ nhớ tạm, xuất kết quả cũ
    charts.py             Dựng biểu đồ Plotly
    scenarios.py          Kịch bản tham khảo dựa trên ATR
    chatbot.py            Gemini/OpenAI và tóm tắt chỉ báo
  workers/
    vnstock_worker.py
    vnstock_symbols_worker.py
  templates/index.html
  static/                 CSS, JavaScript và SVG
model/                    Thuật toán Kronos gốc, giữ nguyên
finetune/                 Huấn luyện với Qlib, giữ nguyên
finetune_csv/             Huấn luyện từ CSV, giữ nguyên
examples/                 Ví dụ nghiên cứu, giữ nguyên
requirements/
  model.txt               Thư viện mô hình
  web.txt                 Thư viện ứng dụng, bao gồm model.txt
scripts/setup_vnstock.py   Bộ cài môi trường VNStock hiện có
tests/                    Các bài kiểm tra
deploy/README.md          Lệnh chạy WSGI và các giới hạn còn lại
webui/                    Tệp chuyển tiếp cho lệnh/import cũ
  prediction_results/     Kết quả cũ vẫn ở nguyên vị trí
run.py                    Chọn .venv rồi gọi app.cli
start                     Lệnh ./start quen thuộc
setup_vnstock.py           Chuyển tiếp sang scripts/setup_vnstock.py
requirements.txt          Chuyển tiếp sang requirements/web.txt
```

## Chạy và cài thư viện

- Ứng dụng đầy đủ: `pip install -r requirements.txt`.
- Chỉ mô hình/nghiên cứu: `pip install -r requirements/model.txt`.
- Chạy local: `./start` hoặc `python3 run.py`.
- Không tự mở trình duyệt: `FINANCIAL_ANALYTICS_OPEN_BROWSER=0 ./start`.
- Cài VNStock: `python3 scripts/setup_vnstock.py`; lệnh cũ `python3 setup_vnstock.py` vẫn dùng được.

## Vì sao vẫn có một số tên tệp giống nhau?

`webui/app.py`, `webui/chatbot.py`, `webui/run.py` và các worker cũ chỉ là tệp chuyển tiếp, không chứa bản sao thuật toán. Chúng giữ tương thích cho lệnh cũ và các import trong kiểm thử. Mã ứng dụng thực nằm trong `app/`.

`requirements.txt` và `webui/requirements.txt` chỉ dẫn tới cùng bộ thư viện ở `requirements/`. Không nâng phiên bản thư viện đang khai báo trong lần sắp xếp này; bản cài đầy đủ kết hợp các ràng buộc mô hình và giao diện như trước.

Các README và `__init__.py` nằm ở các thư mục khác nhau vẫn có chức năng riêng. `finetune/` và `finetune_csv/` xử lý hai luồng dữ liệu khác nhau.

## Dữ liệu và cấu hình

- `.env` vẫn ở gốc dự án, không đổi nội dung và không đưa vào Git.
- Model cache Hugging Face giữ nguyên; không tải hay di chuyển trọng số.
- Dữ liệu tải từ Binance/VNStock vẫn chỉ dùng tạm trong RAM.
- Tệp trong `data/` và các kết quả cũ trong `webui/prediction_results/` không bị chuyển hoặc xóa.
- Bỏ tệp `package-lock.json` rỗng vì dự án không có ứng dụng Node tương ứng.

## Kiểm chứng giữ nguyên hành vi

Đã so sánh cấu trúc hàm và kết quả API trước/sau với mô hình giả lập cố định, gồm dự báo tương lai, lịch sử, cửa sổ được chọn và biểu đồ xem trước. Kiểm thử không dùng API AI trả phí.

Các vấn đề đã phát hiện khi rà soát, như timestamp của một số nhánh lịch sử, kiểm soát quyền truy cập, giới hạn tài nguyên dự báo và dữ liệu tạm giữa nhiều worker, không được sửa trong lần này vì yêu cầu giữ nguyên logic. Cấu trúc mới không đồng nghĩa với đã sẵn sàng public production.
