# Backend implementation plan

## Mục tiêu

Xây dựng backend API xử lý authentication, workspace, fund, category,
transaction, balance và gọi bank-sync worker.

## Module backend

```text
auth
workspace
membership
fund
category
transaction
balance
bank-connection
bank-sync
audit
```

## BE-01 — Quy ước API

API cần thống nhất:

```text
GET    /api/v1/...
POST   /api/v1/...
PATCH  /api/v1/...
DELETE /api/v1/...  # chỉ archive/void, không hard delete tài chính
```

Response lỗi thống nhất:

```json
{
  "error": {
    "code": "TRANSFER_DESTINATION_REQUIRED",
    "message": "Transfer must have a destination fund",
    "details": {}
  }
}
```

Backend không tin dữ liệu do frontend gửi. Các rule nghiệp vụ phải validate ở
backend và database.

## BE-02 — Authentication

Implement hoặc tích hợp một auth provider để xử lý:

- Register/login.
- Password hashing bằng Argon2id hoặc provider tương đương.
- Refresh session.
- Logout.
- Email verification.
- Forgot/reset password.
- OAuth nếu sản phẩm cần.

Nếu dùng Supabase/Auth provider, `users` chỉ nên lưu thông tin domain và giữ
external auth user ID thay vì tự lưu password.

## BE-03 — Workspace API

Các API chính:

```text
POST /workspaces
GET  /workspaces
GET  /workspaces/:workspaceId
PATCH /workspaces/:workspaceId
POST /workspaces/:workspaceId/archive
```

Khi tạo workspace:

1. Tạo workspace.
2. Thêm người tạo vào membership với role owner.
3. Tạo category mặc định nếu có.

Ba bước chạy trong một database transaction.

## BE-04 — Membership API

```text
GET  /workspaces/:workspaceId/members
POST /workspaces/:workspaceId/invitations
POST /invitations/:token/accept
PATCH /workspaces/:workspaceId/members/:userId
POST /workspaces/:workspaceId/members/:userId/remove
```

Backend phải kiểm tra role của người gọi trước khi cho phép thao tác.

## BE-05 — Fund và category API

```text
GET  /workspaces/:workspaceId/funds
POST /workspaces/:workspaceId/funds
PATCH /funds/:fundId
POST /funds/:fundId/archive

GET  /workspaces/:workspaceId/categories
POST /workspaces/:workspaceId/categories
PATCH /categories/:categoryId
POST /categories/:categoryId/archive
```

Khi tạo fund/category, backend lấy `workspaceId` từ URL và kiểm tra user là
member của workspace. Không cho client tự gửi workspace khác trong body để
ghi đè context.

## BE-06 — Transaction API

```text
GET  /workspaces/:workspaceId/transactions
POST /workspaces/:workspaceId/transactions
GET  /transactions/:transactionId
PATCH /transactions/:transactionId
POST /transactions/:transactionId/void
POST /transactions/:transactionId/restore
```

Flow tạo transaction:

1. Kiểm tra user có quyền trong workspace.
2. Kiểm tra fund/category thuộc workspace.
3. Validate type và destination.
4. Validate currency.
5. Insert transaction và audit trong cùng transaction DB.
6. Cập nhật balance cache.
7. Trả transaction mới cho frontend.

Flow transfer dùng cùng service nhưng cập nhật balance cho cả fund nguồn và fund
đích.

## BE-07 — Balance service

Balance service cần có hai chức năng:

```text
getCachedBalance(fundId)
rebuildBalance(fundId)
```

Khi đọc dashboard dùng cache. Khi reconciliation hoặc admin yêu cầu, tính lại
từ transactions rồi so sánh.

Phải xử lý concurrent insert/update để hai request không ghi balance sai.

## BE-08 — Bank API

```text
POST /workspaces/:workspaceId/bank-connections
GET  /workspaces/:workspaceId/bank-connections
POST /bank-connections/:id/sync
POST /bank-connections/:id/disconnect
GET  /bank-connections/:id/accounts
POST /bank-accounts/:id/link-fund
GET  /bank-connections/:id/sync-runs
```

Backend chỉ trả trạng thái kết nối, account name/mask và lỗi thân thiện; không
trả access token hoặc refresh token.

## BE-09 — Background jobs

Các job cần có:

```text
sync-bank-connection
rebuild-fund-balance
cleanup-expired-invitations
retry-failed-sync
```

Sync bank không nên chạy lâu trong HTTP request. API chỉ tạo sync job và trả
trạng thái `queued` hoặc `syncing`.

## BE-10 — Backend acceptance criteria

- User không gọi được API của workspace mình không thuộc.
- Viewer không tạo/sửa/void transaction.
- Invalid transfer bị reject với error code rõ ràng.
- Tạo transaction và audit thành công hoặc thất bại cùng nhau.
- Retry cùng một request không tạo transaction trùng.
- Bank sync chạy background và có sync status.
