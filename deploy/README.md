# Điểm vào triển khai

Từ thư mục gốc, dùng WSGI app đã thống nhất:

```sh
./.venv/bin/waitress-serve --host=127.0.0.1 --port=7070 --threads=8 app.wsgi:app
```

Lệnh này không mở trình duyệt, không chạy Flask development server và không tự cài thư viện. Trong môi trường triển khai, cài trước bằng `pip install -r requirements.txt`, dùng process manager và reverse proxy/HTTPS phù hợp với máy chủ.

Các lệnh local `./start`, `python3 run.py`, `python3 webui/run.py` và `webui/start.sh` dùng chung một phần khởi động tại `app/cli.py`.

## Giới hạn được giữ nguyên

Đây là bước chuẩn hóa cấu trúc, chưa phải hoàn tất triển khai production:

- API chưa có xác thực, phân quyền hoặc hạn mức sử dụng theo người dùng.
- Mô hình và dữ liệu tạm vẫn nằm trong một tiến trình; chưa cấu hình chạy nhiều worker độc lập.
- Bộ cài VNStock vẫn dành cho Mac Apple Silicon như trước. Chưa bổ sung bộ cài Linux.
- Các kiểm tra tham số, chính sách đọc tệp và lỗi timestamp đã nêu trong lần rà soát cần một đợt sửa logic riêng.
- Tài nguyên, lưu trữ, giám sát và kiểm thử tải cần được quyết định theo cách triển khai thực tế.

Không đưa trực tiếp cấu hình hiện tại lên Internet trước khi xử lý các mục phù hợp ở trên.
