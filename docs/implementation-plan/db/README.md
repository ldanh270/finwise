# Database implementation plan

## Mục tiêu

Thiết kế lại schema PostgreSQL để dữ liệu tài chính đúng, không bị trộn giữa
các workspace, có thể tính lại balance và hỗ trợ bank sync.

### DB-00 — Prisma và Supabase

- Backend dùng Prisma ORM với PostgreSQL adapter `pg`.
- Prisma CLI/migrations dùng `DIRECT_URL`; NestJS runtime dùng
  `DATABASE_URL` qua Supavisor session pooler.
- Tất cả model Finwise được map vào PostgreSQL schema `finwise`, không dùng
  `public` làm namespace cho dữ liệu nghiệp vụ.
- `finwise` là schema do Prisma quản lý; các schema Supabase managed như
  `auth` và `storage` không được đưa vào Prisma datasource để tránh drift.
- Connection strings chỉ nằm trong biến môi trường backend; không đặt vào
  frontend hoặc log.

## Thứ tự công việc

### DB-01 — Chuẩn hóa kiểu dữ liệu

- Đổi ID nội bộ sang `uuid` và có default generator.
- Đổi `varchar` không giới hạn thành `text`.
- Đổi `timestamp` thành `timestamptz`.
- Dùng `numeric` cho tiền.
- Chuẩn hóa `currency_code` thành mã ISO 3 ký tự.
- Tạo trigger cập nhật `updated_at`.

### DB-02 — Workspace và membership

Đổi `workspace_users` thành `workspace_members` và bổ sung:

```text
role: owner | admin | member | viewer
status: invited | active | removed
invited_by
invited_at
joined_at
removed_at
```

Chốt một nguồn xác định owner. Nếu dùng role `owner`, không duy trì thêm
`workspaces.owner_id` như một nguồn quyền thứ hai.

### DB-03 — Tenant isolation bằng foreign key

Tạo unique key phụ:

```text
funds(workspace_id, id)
categories(workspace_id, id)
workspace_members(workspace_id, user_id)
```

Sau đó dùng composite foreign key cho:

```text
transactions(workspace_id, fund_id)
transactions(workspace_id, destination_fund_id)
transactions(workspace_id, category_id)
transactions(workspace_id, created_by)
categories(workspace_id, parent_category_id)
```

Mục tiêu là database tự chặn transaction của workspace A trỏ tới fund hoặc
category của workspace B.

### DB-04 — Funds và categories

`funds` cần có:

```text
currency_code
created_by
archived_at
```

`categories` cần:

```text
type: income | expense
created_by
archived_at
```

Không dùng category cho transfer.

Tạo unique index active, không phân biệt hoa thường:

```text
Root category:
(workspace_id, lower(name))
WHERE parent_category_id IS NULL AND archived_at IS NULL

Child category:
(workspace_id, parent_category_id, lower(name))
WHERE parent_category_id IS NOT NULL AND archived_at IS NULL
```

### DB-05 — Transactions

Các cột cần có:

```text
id
workspace_id
fund_id
destination_fund_id
category_id
amount
type
currency_code
transaction_date
occurred_at
note
created_by
updated_by
status: posted | voided
voided_by
voided_at
void_reason
created_at
updated_at
```

Constraint bắt buộc:

```text
amount > 0

transfer:
- destination_fund_id khác null
- destination_fund_id khác fund_id
- category_id là null

income/expense:
- destination_fund_id là null
```

Giao dịch không được hard delete. Khi người dùng xóa, đổi sang `voided` và
ghi audit.

### DB-06 — Opening balance và balance cache

Dùng transaction đặc biệt cho số dư ban đầu:

```text
type = adjustment
adjustment_type = opening_balance
```

Balance cache nên có:

```text
fund_id
balance
calculated_at
```

Cache không phải source of truth. Phải có khả năng rebuild bằng cách tính lại từ
transactions.

### DB-07 — Audit

Tạo `transaction_audits`:

```text
id
transaction_id
action: created | updated | voided | restored
changed_by
old_data jsonb
new_data jsonb
created_at
```

Audit chỉ append, không cho user sửa trực tiếp.

### DB-08 — Bank sync tables

Tách mô hình hiện tại thành:

```text
bank_connections
bank_credentials
bank_accounts
bank_sync_runs
bank_transactions
```

Quan hệ:

```text
bank_connection 1 ── N bank_accounts
bank_account     1 ── 1 fund
bank_account     1 ── N bank_transactions
bank_transaction 0 ── 1 transaction
```

### DB-09 — Index và delete policy

Thêm index cho các foreign key và màn hình thường dùng:

```text
transactions(workspace_id, transaction_date desc)
transactions(fund_id, transaction_date desc)
transactions(category_id)
bank_transactions(bank_account_id)
bank_transactions(bank_account_id, external_transaction_id)
```

Delete policy:

```text
workspace/fund/category: archive
transaction: void
bank connection: disconnect
credential: có thể cascade khi connection bị xóa
```

## Migration order

1. Tạo các bảng mới và cột mới ở trạng thái nullable.
2. Backfill dữ liệu cũ.
3. Kiểm tra duplicate và dữ liệu trỏ sai workspace.
4. Sửa dữ liệu lỗi.
5. Thêm foreign key và check constraint.
6. Đổi các cột bắt buộc thành `NOT NULL`.
7. Tạo index.
8. Chuyển backend sang schema mới.
9. Xóa/đổi tên phần schema cũ sau khi chạy ổn định.

## Database acceptance criteria

- Không insert được transaction trỏ sang workspace khác.
- Không insert được transfer thiếu fund đích.
- Không insert được amount bằng 0 hoặc âm.
- Category income không gắn được vào expense và ngược lại.
- Một external bank transaction không xuất hiện hai lần.
- Balance rebuild bằng balance cache.
- Archive category rồi tạo category active cùng tên được.
