# QA and testing implementation plan

## Mục tiêu

Kiểm tra cả tính đúng của số tiền, quyền truy cập, bank sync và trải nghiệm
frontend trước khi coi MVP hoàn thành.

## QA-01 — Database tests

Kiểm tra constraint:

```text
amount = 0 hoặc âm → reject
transfer thiếu destination → reject
transfer có category → reject
transfer source = destination → reject
workspace A dùng fund workspace B → reject
category parent khác workspace → reject
duplicate external bank transaction → reject/ignore
```

## QA-02 — Backend unit tests

Test các service:

- Tính balance cho income.
- Tính balance cho expense.
- Tính balance cho transfer hai fund.
- Void transaction.
- Restore transaction.
- Permission theo role.
- Invite và accept member.
- Validate category đúng type.

## QA-03 — Integration tests

Các flow chính:

```text
register → create workspace → create fund → create transaction
invite member → accept invitation → member creates transaction
create transfer → verify both fund balances
connect bank → list accounts → map fund → sync
repeat sync → verify no duplicate
void transaction → verify balance and audit
```

## QA-04 — Frontend tests

- Form income/expense/transfer đổi field đúng.
- Amount invalid hiển thị lỗi.
- Viewer không thấy write actions.
- Empty state hiển thị đúng.
- Loading/error/retry hoạt động.
- Workspace switch không làm lộ dữ liệu workspace cũ.
- Bank sync error hiển thị trạng thái dễ hiểu.

## QA-05 — Security tests

- Truy cập workspace khác bằng URL đổi ID.
- Gọi write API bằng viewer.
- Dùng membership đã removed.
- Dùng invitation đã hết hạn.
- Kiểm tra token không nằm trong API response/log.
- Rate limit login và bank connection.

## QA-06 — Reconciliation tests

Tạo dữ liệu mẫu và kiểm tra:

```text
calculated balance từ transactions
== balance cache
== balance hiển thị frontend
```

Test thêm các tình huống:

- Nhiều transaction cùng lúc.
- Void giao dịch cũ.
- Sync bank tạo transaction mới.
- Sync bank update pending thành posted.
- Rebuild balance sau khi cache bị xóa.

## QA-07 — Test data

Seed data local cần có:

```text
2 users
1 workspace
owner/admin/member/viewer
3 funds
income/expense/transfer
category cha/con
bank connection giả lập
pending và posted bank transaction
```

Không dùng credential ngân hàng thật trong seed hoặc test.

## QA-08 — CI checks

Pipeline tối thiểu:

```text
format check
lint
type check
unit tests
database migration test
integration tests
frontend build
```

## QA acceptance criteria

- Tất cả test nghiệp vụ tiền và permission pass.
- Có test chống cross-workspace access.
- Có test idempotency bank sync.
- Có test rebuild balance.
- Có seed data để developer chạy local.
- CI fail nếu migration hoặc test chính không pass.
