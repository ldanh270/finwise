# Bank sync implementation plan

## Mục tiêu

Đồng bộ dữ liệu ngân hàng an toàn, có thể retry, không tạo giao dịch trùng và
giữ được dữ liệu gốc từ provider.

## Luồng tổng quát

```text
Connect provider
    ↓
Receive bank accounts
    ↓
Map bank account → fund
    ↓
Create sync run
    ↓
Fetch provider transactions
    ↓
Store raw bank transactions
    ↓
Deduplicate and match pending/posted
    ↓
Create or update internal transactions
    ↓
Update cursor and balance
```

## BS-01 — Provider adapter

Không để business logic phụ thuộc trực tiếp vào một provider. Tạo interface
chung:

```text
connect()
listAccounts()
listTransactions(cursor, dateRange)
getBalances()
disconnect()
refreshCredential()
```

Mỗi provider có adapter riêng để map format của provider về format nội bộ.

## BS-02 — Idempotency

Một lần sync có thể chạy lại nhiều lần. Dữ liệu không được nhân đôi.

Khóa deduplicate đề xuất:

```text
(bank_account_id, external_transaction_id)
```

Nếu provider có pending transaction, lưu thêm `pending_external_transaction_id`
để map pending thành posted thay vì tạo hai transaction.

## BS-03 — Sync state

Sync run có trạng thái:

```text
queued
running
succeeded
partial_success
failed
```

Lưu:

```text
started_at
finished_at
cursor_before
cursor_after
fetched_count
created_count
updated_count
failed_count
error_code
error_message
```

## BS-04 — Retry

Retry được phép với lỗi tạm thời như timeout hoặc provider 5xx.

Không retry vô hạn. Dùng:

```text
max attempts
exponential backoff
dead-letter/failed state
manual retry action
```

Lỗi cần re-authentication phải chuyển thành `reauth_required`, không retry
liên tục.

## BS-05 — Transaction mapping

Bank transaction có thể được:

```text
auto_imported
matched_existing
needs_review
ignored
```

MVP có thể auto-import mọi transaction hợp lệ. Sau đó bổ sung rule mapping
merchant/category.

## BS-06 — Pending, reversal và refund

Phải lưu được các trường hợp:

- Pending đổi thành posted.
- Giao dịch bị ngân hàng reverse.
- Refund từ merchant.
- Giao dịch bị thay đổi description hoặc amount.

Không xóa dữ liệu cũ; cập nhật trạng thái và lưu audit.

## BS-07 — Security

- Encrypt access token và refresh token.
- Không ghi token vào log.
- Không trả credential qua frontend API.
- Hạn chế worker chỉ đọc credential của connection cần sync.
- Disconnect phải revoke hoặc xóa credential theo policy của provider.

## Bank sync acceptance criteria

- Một sync chạy lại không tạo duplicate transaction.
- Pending và posted được merge đúng.
- Lỗi provider được retry có giới hạn.
- Lỗi credential chuyển thành re-auth required.
- User xem được trạng thái và lịch sử sync.
- Raw provider payload vẫn được giữ để debug/audit.
