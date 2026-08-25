# Security implementation plan

## Mục tiêu

Đảm bảo user chỉ truy cập dữ liệu workspace mình được phép, credential ngân
hàng không bị lộ và mọi thay đổi tài chính quan trọng có thể audit.

## SEC-01 — Authentication

- Hash password bằng Argon2id nếu tự quản lý auth.
- Không lưu password plaintext.
- Session có expiration và refresh policy.
- Hỗ trợ revoke session khi logout hoặc đổi password.
- Email/username dùng unique case-insensitive.
- Nếu dùng auth provider, không duplicate password storage.

## SEC-02 — Authorization

Mỗi request cần xác định:

```text
current_user
workspace_id
membership status
membership role
```

Rule cơ bản:

```text
removed/invited member → không truy cập dữ liệu workspace
viewer → read only
member → tạo giao dịch
admin → quản lý dữ liệu workspace
owner → toàn quyền và ownership
```

Không chỉ dựa vào frontend để ẩn nút; backend luôn kiểm tra lại.

## SEC-03 — Tenant isolation

- Composite FK để chống trộn dữ liệu.
- API lấy workspace context từ route và session.
- Không tin `workspace_id` do client tự gửi trong body.
- Bật Row-Level Security nếu client có thể truy cập DB trực tiếp.
- Viết test cố tình truy cập workspace khác.

## SEC-04 — Bank secrets

- Encrypt access/refresh token at rest.
- Tốt nhất lưu reference tới secret manager/KMS.
- Token không xuất hiện trong log, error, analytics hoặc frontend storage.
- Có key rotation policy.
- Có thời hạn/consent expiration.

## SEC-05 — Audit và dữ liệu tài chính

Audit các action:

```text
create/update/void/restore transaction
change fund
change category
invite/remove member
change role
connect/disconnect bank
```

Transaction tài chính không hard delete. Audit log append-only và chỉ role
được phép mới đọc được.

## SEC-06 — API protection

- Rate limit login, invitation và bank connect.
- Validate input bằng schema ở backend.
- Giới hạn độ dài note/name/metadata.
- Không trả stack trace cho client.
- Log request ID để trace nhưng loại bỏ secret/PII nhạy cảm.
- CORS chỉ cho domain hợp lệ.

## Security acceptance criteria

- User không đọc được workspace khác bằng cách đổi ID trên URL.
- Viewer không thể gọi write API dù tự gửi request thủ công.
- Token ngân hàng không xuất hiện trong response/log.
- Mọi transaction update/void đều có audit record.
- Login và invitation có rate limit.
