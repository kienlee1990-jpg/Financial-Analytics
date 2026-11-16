<div align="center">
  <h2><b>Kronos: Mô hình nền tảng cho ngôn ngữ của thị trường tài chính</b></h2>
</div>

<div align="center">
<a href="https://huggingface.co/NeoQuasar">
<img src="https://img.shields.io/badge/🤗-Hugging_Face-yellow" alt="Hugging Face">
</a>
<a href="https://shiyu-coder.github.io/Kronos-demo/"><img src="https://img.shields.io/badge/🚀-Bản_demo-brightgreen" alt="Bản demo"></a>
<a href="https://github.com/shiyu-coder/Kronos/graphs/commit-activity">
<img src="https://img.shields.io/github/last-commit/shiyu-coder/Kronos?color=blue" alt="Commit gần nhất">
</a>
<a href="https://github.com/shiyu-coder/Kronos/stargazers">
<img src="https://img.shields.io/github/stars/shiyu-coder/Kronos?color=lightblue" alt="Số lượt sao GitHub">
</a>
<a href="https://github.com/shiyu-coder/Kronos/network/members">
<img src="https://img.shields.io/github/forks/shiyu-coder/Kronos?color=yellow" alt="Số lượt fork GitHub">
</a>
<a href="./LICENSE">
<img src="https://img.shields.io/github/license/shiyu-coder/Kronos?color=green" alt="Giấy phép">
</a>
</div>

<div align="center">
  <!-- Giữ các liên kết này. Bản dịch sẽ được cập nhật tự động theo README. -->
  <a href="https://zdoc.app/de/shiyu-coder/Kronos">Tiếng Đức</a> |
  <a href="https://zdoc.app/es/shiyu-coder/Kronos">Tiếng Tây Ban Nha</a> |
  <a href="https://zdoc.app/fr/shiyu-coder/Kronos">Tiếng Pháp</a> |
  <a href="https://zdoc.app/ja/shiyu-coder/Kronos">Tiếng Nhật</a> |
  <a href="https://zdoc.app/ko/shiyu-coder/Kronos">Tiếng Hàn</a> |
  <a href="https://zdoc.app/pt/shiyu-coder/Kronos">Tiếng Bồ Đào Nha</a> |
  <a href="https://zdoc.app/ru/shiyu-coder/Kronos">Tiếng Nga</a> |
  <a href="https://zdoc.app/zh/shiyu-coder/Kronos">Tiếng Trung</a>
</div>

<p align="center">
<img src="./figures/logo.png" width="100" alt="Biểu trưng Kronos">
</p>

> Kronos là **mô hình nền tảng mã nguồn mở đầu tiên** dành cho dữ liệu nến tài chính, được huấn luyện trên dữ liệu từ hơn **45 sàn giao dịch toàn cầu**.

## 📰 Tin tức

- 🚩 **[2025.11.10]** Kronos được chấp nhận tại hội nghị AAAI 2026.
- 🚩 **[2025.08.17]** Đã phát hành các tập lệnh tinh chỉnh mô hình để bạn điều chỉnh Kronos theo tác vụ của mình.
- 🚩 **[2025.08.02]** Bài nghiên cứu của chúng tôi đã được đăng trên [arXiv](https://arxiv.org/abs/2508.02739).

## 📜 Giới thiệu

**Kronos** là một họ mô hình nền tảng decoder-only, được huấn luyện chuyên biệt trên “ngôn ngữ” của thị trường tài chính: các chuỗi nến. Khác với những mô hình dự báo chuỗi thời gian đa dụng, Kronos được thiết kế để xử lý đặc tính nhiễu cao và riêng biệt của dữ liệu tài chính. Mô hình sử dụng quy trình gồm hai giai đoạn:

1. Bộ mã hóa chuyên biệt lượng tử hóa dữ liệu nến liên tục, đa chiều (OHLCV) thành **các token rời rạc có cấu trúc phân cấp**.
2. Transformer tự hồi quy quy mô lớn được huấn luyện trước trên các token đó, tạo thành một mô hình thống nhất cho nhiều tác vụ định lượng.

<p align="center">
    <img src="figures/overview.png" alt="Tổng quan kiến trúc Kronos" align="center" width="700px" />
</p>

## ✨ Bản demo trực tuyến

Bản demo trực tuyến minh họa kết quả dự báo của Kronos. Trang web hiện trình bày dự báo cho cặp giao dịch **BTC/USDT** trong 24 giờ tiếp theo.

**👉 [Mở bản demo tại đây](https://shiyu-coder.github.io/Kronos-demo/)**

## 📦 Danh sách mô hình

Kronos có nhiều kích thước mô hình để phù hợp với các nhu cầu tính toán và ứng dụng khác nhau. Các mô hình được cung cấp trên Hugging Face Hub.

| Mô hình | Bộ mã hóa (Tokenizer) | Độ dài ngữ cảnh | Số tham số | Mã nguồn mở |
|---|---|---:|---:|---|
| Kronos-mini | [Kronos-Tokenizer-2k](https://huggingface.co/NeoQuasar/Kronos-Tokenizer-2k) | 2048 | 4.1M | ✅ [NeoQuasar/Kronos-mini](https://huggingface.co/NeoQuasar/Kronos-mini) |
| Kronos-small | [Kronos-Tokenizer-base](https://huggingface.co/NeoQuasar/Kronos-Tokenizer-base) | 512 | 24.7M | ✅ [NeoQuasar/Kronos-small](https://huggingface.co/NeoQuasar/Kronos-small) |
| Kronos-base | [Kronos-Tokenizer-base](https://huggingface.co/NeoQuasar/Kronos-Tokenizer-base) | 512 | 102.3M | ✅ [NeoQuasar/Kronos-base](https://huggingface.co/NeoQuasar/Kronos-base) |
| Kronos-large | [Kronos-Tokenizer-base](https://huggingface.co/NeoQuasar/Kronos-Tokenizer-base) | 512 | 499.2M | ❌ |

## 🚀 Bắt đầu

### Cấu trúc ứng dụng

Mã ứng dụng hiện nằm trong `app/`: API ở `app/api.py`, xử lý dữ liệu/biểu đồ/chatbot ở `app/services/`, giao diện ở `app/templates/` và `app/static/`. Thư mục `webui/` giữ các tệp chuyển tiếp để lệnh cũ vẫn dùng được. Xem [bản đồ cấu trúc](docs/STRUCTURE.md) và [điểm vào WSGI](deploy/README.md).

### Cài đặt thư viện

1. Cài Python 3.10 trở lên.
2. Cài các thư viện cần thiết:

```shell
pip install -r requirements.txt
```

### Chạy giao diện web của dự án

Tại thư mục gốc dự án, chạy:

```shell
./start
```

Trên macOS, bạn cũng có thể chạy `python3 start`. Trình khởi chạy dùng môi trường `.venv` nếu có và khởi động ứng dụng bằng Waitress. Mở [http://localhost:7070](http://localhost:7070) nếu trình duyệt không tự mở. Giữ Terminal đang chạy ứng dụng; nhấn **Ctrl+C** để dừng máy chủ.

### Tính năng của giao diện web

- Chuyển giữa phân tích **Coin** và **Chứng khoán**.
- Lấy dữ liệu coin từ Binance, dữ liệu cổ phiếu Việt Nam qua VNStock hoặc tải tệp CSV/Feather.
- Xem biểu đồ nến, đường trung bình động và thông tin OHLC khi rê chuột lên nến; có thể đổi khung thời gian hiển thị.
- Xem tóm tắt dự báo, phần giải thích hướng dự báo, kịch bản Futures tham khảo và kết quả đối chiếu khi có dữ liệu thực tế.
- Chọn mô hình và thiết bị chạy: CPU, CUDA hoặc MPS trên máy Mac dùng Apple Silicon.

Dữ liệu mới lấy từ Binance/VNStock chỉ dùng tạm trong bộ nhớ để xem chỉ báo và dự báo, không tự lưu CSV hoặc kết quả JSON. Ứng dụng yêu cầu giải phóng dữ liệu khi đóng trang; dữ liệu tạm cũng hết hạn sau 2 giờ không dùng hoặc mất khi khởi động lại máy chủ. Các tệp dữ liệu có sẵn vẫn dùng được.

### Quy trình sử dụng

1. Chọn tab **Coin** hoặc **Chứng khoán**.
2. Lấy dữ liệu từ nguồn trực tuyến hoặc tải tệp lên.
3. Chọn mô hình và thiết bị, sau đó bấm **Tải mô hình**.
4. Chọn khoảng dữ liệu lịch sử. Ứng dụng hiện dùng 400 điểm lịch sử và dự báo 120 điểm tiếp theo.
5. Bấm **Bắt đầu dự báo** để xem biểu đồ và phần diễn giải.

### Tham số dự báo trong giao diện

- **Temperature (T), 0.1–2.0:** điều chỉnh độ ngẫu nhiên; giá trị thấp thường ổn định hơn, giá trị cao có thể tạo kết quả đa dạng hơn.
- **Top-p, 0.1–1.0:** điều chỉnh số khả năng được cân nhắc khi tạo dự báo.
- **Số lần lấy mẫu, 1–5:** tạo nhiều lượt dự báo để tổng hợp kết quả; có thể bắt đầu với 1–3 lượt.

Các tham số này ảnh hưởng cách mô hình tạo kết quả, nhưng không đảm bảo dự báo chính xác.

### Định dạng tệp dữ liệu

Tệp CSV hoặc Feather cần có các cột giá `open`, `high`, `low`, `close`. Các cột `volume`, `amount` và mốc thời gian (`timestamps`, `timestamp` hoặc `date`) có thể được dùng nếu có. Hãy đảm bảo dữ liệu đủ dài cho khoảng lịch sử đã chọn.

### Đọc kết quả và lưu ý

- Phần tóm tắt hiển thị giá tham chiếu, giá dự báo cuối kỳ, mức thay đổi và khoảng giá dự báo.
- Phần giải thích nêu bối cảnh dữ liệu gần đây, mức thay đổi được dự báo và các giới hạn của mô hình.
- Kịch bản Futures được mô phỏng từ dự báo và ATR của dữ liệu Spot; đây không phải khuyến nghị đặt lệnh. Kết quả không tính funding, giá Mark, đòn bẩy, phí, thanh khoản hoặc mức chịu lỗ của người dùng.
- Nếu có dữ liệu thực tế tương ứng, phần đối chiếu hiển thị MAE, RMSE, MAPE và bảng so sánh.

### Khắc phục sự cố giao diện web

- Nếu không mở được trang, kiểm tra Terminal xem máy chủ còn chạy không rồi mở lại [http://localhost:7070](http://localhost:7070).
- Nếu cổng 7070 đang được chương trình khác sử dụng, hãy dừng chương trình đó rồi chạy lại ứng dụng.
- Nếu thiếu thư viện, khởi chạy lại bằng `./start` và làm theo thông báo trong Terminal. Bộ thư viện đầy đủ nằm ở `requirements/web.txt`; `requirements.txt` và `webui/requirements.txt` chuyển tiếp tới cùng bộ này.
- Nếu không tải được mô hình, kiểm tra kết nối Internet; có thể chọn CPU nếu CUDA hoặc MPS không khả dụng.
- Nếu dữ liệu không được nhận diện, kiểm tra tên cột, định dạng thời gian và các cột giá bắt buộc.

## 📈 Tạo dự báo bằng Python

Có thể tạo dự báo bằng lớp `KronosPredictor`. Lớp này xử lý tiền xử lý dữ liệu, chuẩn hóa, dự báo và chuyển kết quả về thang đo ban đầu, giúp tạo dự báo từ dữ liệu thô chỉ với một số dòng mã.

> **Lưu ý quan trọng:** `max_context` của `Kronos-small` và `Kronos-base` là **512**, tức độ dài chuỗi tối đa mà mô hình có thể xử lý. Để đạt hiệu quả tốt, nên giữ độ dài dữ liệu đầu vào (`lookback`) không vượt quá giới hạn này. `KronosPredictor` sẽ tự cắt bớt phần vượt quá giới hạn.

Các bước dưới đây hướng dẫn tạo dự báo đầu tiên.

### 1. Tải bộ mã hóa và mô hình

Tải mô hình Kronos đã huấn luyện trước cùng bộ mã hóa tương ứng từ Hugging Face Hub:

```python
from model import Kronos, KronosTokenizer, KronosPredictor

# Tải mô hình và tokenizer từ Hugging Face Hub
tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
```

### 2. Khởi tạo bộ dự báo

Tạo đối tượng `KronosPredictor`, truyền vào mô hình, bộ mã hóa và thiết bị muốn sử dụng:

```python
# Khởi tạo bộ dự báo
predictor = KronosPredictor(model, tokenizer, max_context=512)
```

### 3. Chuẩn bị dữ liệu đầu vào

Phương thức `predict` cần ba đầu vào chính:

- `df`: DataFrame của pandas chứa dữ liệu nến lịch sử. Cần có các cột `['open', 'high', 'low', 'close']`. `volume` và `amount` là tùy chọn.
- `x_timestamp`: Series của pandas chứa mốc thời gian tương ứng với dữ liệu lịch sử trong `df`.
- `y_timestamp`: Series của pandas chứa các mốc thời gian tương lai cần dự báo.

```python
import pandas as pd

# Đọc dữ liệu
df = pd.read_csv("./data/XSHG_5min_600977.csv")
df['timestamps'] = pd.to_datetime(df['timestamps'])

# Chọn khoảng dữ liệu lịch sử và số bước dự báo
lookback = 400
pred_len = 120

# Chuẩn bị dữ liệu cho bộ dự báo
x_df = df.loc[:lookback-1, ['open', 'high', 'low', 'close', 'volume', 'amount']]
x_timestamp = df.loc[:lookback-1, 'timestamps']
y_timestamp = df.loc[lookback:lookback+pred_len-1, 'timestamps']
```

### 4. Tạo dự báo

Gọi phương thức `predict` để tạo dự báo. Có thể điều chỉnh quá trình lấy mẫu bằng các tham số `T`, `top_p` và `sample_count`.

```python
# Tạo dự báo
pred_df = predictor.predict(
    df=x_df,
    x_timestamp=x_timestamp,
    y_timestamp=y_timestamp,
    pred_len=pred_len,
    T=1.0,          # Temperature (độ ngẫu nhiên khi lấy mẫu)
    top_p=0.9,      # Xác suất lấy mẫu nucleus
    sample_count=1  # Số đường dự báo được tạo và lấy trung bình
)

print("Các dòng đầu của dữ liệu dự báo:")
print(pred_df.head())
```

Phương thức `predict` trả về một DataFrame của pandas chứa các giá trị dự báo `open`, `high`, `low`, `close`, `volume` và `amount`, được đánh chỉ mục theo `y_timestamp` đã cung cấp.

Để xử lý nhiều chuỗi thời gian hiệu quả, Kronos có phương thức `predict_batch`, cho phép dự báo song song trên nhiều bộ dữ liệu. Tính năng này hữu ích khi cần dự báo nhiều tài sản hoặc nhiều khoảng thời gian.

```python
# Chuẩn bị nhiều bộ dữ liệu để dự báo theo lô
df_list = [df1, df2, df3]  # Danh sách DataFrame
x_timestamp_list = [x_ts1, x_ts2, x_ts3]  # Danh sách mốc thời gian lịch sử
y_timestamp_list = [y_ts1, y_ts2, y_ts3]  # Danh sách mốc thời gian tương lai

# Tạo dự báo theo lô
pred_df_list = predictor.predict_batch(
    df_list=df_list,
    x_timestamp_list=x_timestamp_list,
    y_timestamp_list=y_timestamp_list,
    pred_len=pred_len,
    T=1.0,
    top_p=0.9,
    sample_count=1,
    verbose=True
)

# Kết quả được trả về theo đúng thứ tự các bộ dữ liệu đầu vào
for i, pred_df in enumerate(pred_df_list):
    print(f"Kết quả dự báo cho chuỗi {i}:")
    print(pred_df.head())
```

**Yêu cầu đối với dự báo theo lô:**

- Mọi chuỗi phải có cùng độ dài lịch sử (cửa sổ `lookback`).
- Mọi chuỗi phải có cùng độ dài dự báo (`pred_len`).
- Mỗi DataFrame phải có các cột bắt buộc `['open', 'high', 'low', 'close']`.
- Nếu thiếu `volume` hoặc `amount`, các cột này sẽ được điền bằng số 0.

`predict_batch` tận dụng khả năng xử lý song song của GPU và tự chuẩn hóa, rồi chuyển dữ liệu về thang đo ban đầu cho từng chuỗi.

### 5. Ví dụ và biểu đồ

Xem tập lệnh hoàn chỉnh gồm đọc dữ liệu, tạo dự báo và vẽ biểu đồ tại [`examples/prediction_example.py`](examples/prediction_example.py).

Chạy tập lệnh sẽ tạo biểu đồ so sánh dữ liệu thực tế với dự báo của mô hình, tương tự hình dưới đây:

<p align="center">
    <img src="figures/prediction_example.png" alt="Ví dụ biểu đồ dự báo" align="center" width="600px" />
</p>

Ngoài ra còn có tập lệnh tạo dự báo khi không có dữ liệu Volume và Amount: [`examples/prediction_wo_vol_example.py`](examples/prediction_wo_vol_example.py).

## 🔧 Tinh chỉnh mô hình trên dữ liệu riêng (ví dụ thị trường cổ phiếu Trung Quốc)

Dự án cung cấp quy trình tinh chỉnh Kronos trên bộ dữ liệu riêng. Ví dụ dưới đây dùng [Qlib](https://github.com/microsoft/qlib) để chuẩn bị dữ liệu thị trường cổ phiếu hạng A của Trung Quốc và chạy kiểm thử chiến lược đơn giản.

> **Miễn trừ trách nhiệm:** Quy trình này chỉ nhằm minh họa cách tinh chỉnh mô hình. Đây là ví dụ đơn giản, chưa phải hệ thống giao dịch định lượng sẵn sàng cho môi trường thực tế. Một chiến lược định lượng vững chắc cần các kỹ thuật phức tạp hơn, chẳng hạn tối ưu hóa danh mục và trung hòa các yếu tố rủi ro, để đạt lợi nhuận vượt trội ổn định.

Quy trình tinh chỉnh gồm bốn bước chính:

1. **Cấu hình:** Thiết lập đường dẫn và siêu tham số.
2. **Chuẩn bị dữ liệu:** Dùng Qlib để xử lý và chia dữ liệu.
3. **Tinh chỉnh mô hình:** Tinh chỉnh Tokenizer và Predictor.
4. **Kiểm thử chiến lược:** Đánh giá hiệu quả của mô hình đã tinh chỉnh.

### Điều kiện cần

1. Cài đặt các thư viện trong `requirements.txt`.
2. Quy trình này cần `qlib`. Cài đặt bằng lệnh:

   ```shell
   pip install pyqlib
   ```

3. Chuẩn bị dữ liệu Qlib. Làm theo [hướng dẫn chính thức của Qlib](https://github.com/microsoft/qlib) để tải và thiết lập dữ liệu trên máy. Các tập lệnh ví dụ giả định dữ liệu có tần suất ngày.

### Bước 1: Cấu hình thử nghiệm

Các thiết lập về dữ liệu, huấn luyện và đường dẫn mô hình nằm trong `finetune/config.py`. Trước khi chạy tập lệnh, hãy chỉnh các đường dẫn sau cho phù hợp với máy của bạn:

- `qlib_data_path`: Thư mục dữ liệu Qlib trên máy.
- `dataset_path`: Thư mục lưu các tệp pickle đã xử lý dùng cho tập huấn luyện, xác thực và kiểm thử.
- `save_path`: Thư mục gốc lưu các checkpoint của mô hình.
- `backtest_result_path`: Thư mục lưu kết quả kiểm thử chiến lược.
- `pretrained_tokenizer_path` và `pretrained_predictor_path`: Đường dẫn tới mô hình đã huấn luyện trước muốn dùng làm điểm bắt đầu; có thể là đường dẫn cục bộ hoặc tên mô hình trên Hugging Face.

Bạn cũng có thể điều chỉnh các tham số như `instrument`, `train_time_range`, `epochs` và `batch_size`. Nếu không dùng [Comet.ml](https://www.comet.com/), hãy đặt `use_comet = False`.

### Bước 2: Chuẩn bị bộ dữ liệu

Chạy tập lệnh tiền xử lý. Tập lệnh sẽ đọc dữ liệu thị trường thô từ thư mục Qlib, xử lý và chia thành tập huấn luyện, xác thực, kiểm thử, rồi lưu thành các tệp pickle.

```shell
python finetune/qlib_data_preprocess.py
```

Sau khi chạy xong, các tệp `train_data.pkl`, `val_data.pkl` và `test_data.pkl` sẽ nằm trong thư mục `dataset_path` đã cấu hình.

### Bước 3: Tinh chỉnh mô hình

Quy trình tinh chỉnh gồm hai giai đoạn: tinh chỉnh Tokenizer, sau đó tinh chỉnh Predictor. Cả hai tập lệnh huấn luyện đều hỗ trợ huấn luyện đa GPU qua `torchrun`.

#### 3.1 Tinh chỉnh Tokenizer

Bước này điều chỉnh Tokenizer cho phù hợp với phân phối dữ liệu của lĩnh vực cụ thể.

```shell
# Thay NUM_GPUS bằng số GPU muốn sử dụng, ví dụ 2
torchrun --standalone --nproc_per_node=NUM_GPUS finetune/train_tokenizer.py
```

Checkpoint Tokenizer tốt nhất sẽ được lưu tại đường dẫn cấu hình trong `config.py`, được tạo từ `save_path` và `tokenizer_save_folder_name`.

#### 3.2 Tinh chỉnh Predictor

Bước này tinh chỉnh mô hình Kronos chính cho tác vụ dự báo.

```shell
# Thay NUM_GPUS bằng số GPU muốn sử dụng, ví dụ 2
torchrun --standalone --nproc_per_node=NUM_GPUS finetune/train_predictor.py
```

Checkpoint Predictor tốt nhất sẽ được lưu tại đường dẫn đã cấu hình trong `config.py`.

### Bước 4: Đánh giá bằng kiểm thử chiến lược

Cuối cùng, chạy tập lệnh kiểm thử để đánh giá mô hình đã tinh chỉnh. Tập lệnh tải mô hình, suy luận trên tập kiểm thử, tạo tín hiệu dự báo (ví dụ mức thay đổi giá) và chạy một chiến lược top-K đơn giản.

```shell
# Chọn GPU để suy luận
python finetune/qlib_test.py --device cuda:0
```

Tập lệnh sẽ in báo cáo hiệu quả chi tiết ra Terminal và tạo biểu đồ so sánh đường lợi nhuận tích lũy của chiến lược với chỉ số tham chiếu, tương tự hình dưới đây:

<p align="center">
    <img src="figures/backtest_result_example.png" alt="Ví dụ kết quả kiểm thử chiến lược" align="center" width="700px" />
</p>

### 💡 Từ bản minh họa đến ứng dụng thực tế

- **Tín hiệu thô và alpha thuần:** Tín hiệu trong bản minh họa này là dự báo thô. Trong quy trình định lượng thực tế, tín hiệu thường được đưa vào mô hình tối ưu hóa danh mục. Mô hình này áp dụng các ràng buộc để trung hòa mức độ tiếp xúc với các yếu tố rủi ro phổ biến (ví dụ beta thị trường, quy mô và giá trị), qua đó tách phần **alpha thuần** và tăng độ vững chắc của chiến lược.
- **Xử lý dữ liệu:** `QlibDataset` được cung cấp chỉ là ví dụ. Với nguồn hoặc định dạng dữ liệu khác, bạn cần điều chỉnh phần tải và tiền xử lý dữ liệu.
- **Độ phức tạp của chiến lược và kiểm thử:** Chiến lược top-K đơn giản là điểm khởi đầu cơ bản. Chiến lược dùng thực tế thường có logic phức tạp hơn cho xây dựng danh mục, phân bổ quy mô vị thế linh hoạt và quản lý rủi ro (ví dụ mức cắt lỗ/chốt lời). Kiểm thử sát thực tế cũng cần mô hình hóa cẩn thận phí giao dịch, trượt giá và tác động lên thị trường.

> **📝 Ghi chú do AI tạo:** Nhiều chú thích mã trong thư mục `finetune/` được tạo bởi trợ lý AI Gemini 2.5 Pro nhằm giải thích mã nguồn và có thể chưa chính xác. Hãy xem mã nguồn là căn cứ chính xác nhất về cách chương trình hoạt động.

## 📖 Trích dẫn

Nếu sử dụng Kronos trong nghiên cứu, vui lòng trích dẫn bài [nghiên cứu](https://arxiv.org/abs/2508.02739):

```
@misc{shi2025kronos,
      title={Kronos: A Foundation Model for the Language of Financial Markets},
      author={Yu Shi and Zongliang Fu and Shuo Chen and Bohan Zhao and Wei Xu and Changshui Zhang and Jian Li},
      year={2025},
      eprint={2508.02739},
      archivePrefix={arXiv},
      primaryClass={q-fin.ST},
      url={https://arxiv.org/abs/2508.02739},
}
```

## 📜 Giấy phép

Dự án được cấp phép theo [Giấy phép MIT](./LICENSE).

## Chatbot Financial Analytics

Nhấn **Hỏi trợ lý AI** ở góc dưới bên phải. Chatbot hỗ trợ **Gemini** và **OpenAI**; chọn nhà cung cấp trong `.env` ở thư mục gốc.

Cấu hình Gemini (mặc định):

```dotenv
CHAT_PROVIDER=gemini
GEMINI_API_KEY=khóa_của_bạn
GEMINI_MODEL=gemini-3.1-flash-lite
```

Hoặc OpenAI:

```dotenv
CHAT_PROVIDER=openai
OPENAI_API_KEY=khóa_của_bạn
OPENAI_MODEL=gpt-4.1-mini
```

Cài thư viện bằng `pip install -r webui/requirements.txt`, chạy `./start`, mở chatbot và bấm **Kiểm tra kết nối lại** sau khi sửa `.env`. Cấu hình được đọc lại mỗi yêu cầu; khóa chỉ được dùng ở backend, không đưa vào HTML/JavaScript hay Git. Có thể đổi model theo quyền truy cập API của tài khoản.

Sau khi Kronos trả kết quả, bấm **Trao đổi với AI về kết quả này** để hỏi tiếp. Chatbot được gắn với chính lần phân tích vừa hiển thị: giá tham chiếu/cuối kỳ, hướng long/short/neutral, thời hạn, vùng vào, cắt lỗ, TP1/TP2, phần diễn giải, điểm kỹ thuật tham khảo và đối chiếu thực tế nếu có.

Tùy chọn **Dùng kết quả Kronos đang xem** được chọn khi có kết quả mới, và có thể bỏ chọn để hỏi kiến thức chung. Không có cuộc gọi AI tự động khi dự báo xong; kết quả chỉ được gửi tới nhà cung cấp khi bạn đặt câu hỏi. Luồng trao đổi về dự báo không đọc lại CSV, nên vẫn hoạt động khi dữ liệu tạm đầu vào hết hạn nhưng kết quả còn trên trang. Khi chuyển sang dữ liệu hoặc dự báo mới, lịch sử gửi cho AI được tách để không trộn lời khuyên của các lần phân tích. Không gửi toàn bộ tệp hay toàn bộ chuỗi nến.

Chatbot giải thích kết quả đã hiển thị; không truy cập suy luận ẩn bên trong Kronos và không coi điểm kỹ thuật tham khảo là xác suất đã kiểm định.

Hội thoại giữ trong bộ nhớ của trang, mất khi tải lại hoặc bấm hội thoại mới. Ứng dụng không lưu lịch sử thành tệp. OpenAI dùng Responses API với `store=False`; Gemini dùng GenerateContent với lịch sử do trang gửi, không tạo phiên lưu trữ trên ứng dụng. Nhà cung cấp xử lý nội dung khi bạn gửi câu hỏi. Chưa có API key thì chatbot hiển thị hướng dẫn cấu hình, không tạo câu trả lời giả.

Tài liệu: [Google Gemini API](https://ai.google.dev/api/generate-content), [Model Gemini](https://ai.google.dev/gemini-api/docs/models), [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).
