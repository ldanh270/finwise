# Business decisions và các điểm cần chốt

Tài liệu này ghi các quyết định nghiệp vụ để FE, BE và DB cùng hiểu một cách.

## Đã chọn cho MVP

### Workspace

Một workspace là một nhóm dùng chung, ví dụ “Gia đình Nguyễn”. Một user có thể
tham gia nhiều workspace.

### Thành viên

Role đề xuất:

| Role | Quyền |
| --- | --- |
| owner | Toàn quyền, chuyển quyền owner, xóa/archive workspace |
| admin | Quản lý thành viên, fund, category và giao dịch |
| member | Xem dữ liệu và tạo/sửa giao dịch theo policy |
| viewer | Chỉ xem |

Membership có status `invited`, `active`, `removed`.

### Fund

Fund đại diện cho một nơi giữ tiền. Ví dụ:

```text
Tiền mặt
VCB
MoMo
Thẻ tín dụng
```

Một fund có một currency. Tạm thời chỉ cho transfer giữa hai fund cùng currency.

### Transaction

Amount luôn dương:

```text
income   = cộng vào fund
expense  = trừ khỏi fund
transfer = trừ fund nguồn, cộng fund đích
```

Transfer không có category. Income/expense có thể không có category nếu người
dùng chọn “Uncategorized”.

### Balance

Balance được tính từ các transaction hợp lệ. `fund_balance_cache` chỉ phục vụ
đọc nhanh và có thể rebuild.

### Bank sync

Một bank connection có thể trả về nhiều bank account. Mỗi bank account được map
vào một fund. Dữ liệu provider được lưu riêng trước khi tạo transaction nội bộ.

## Cần chốt trước khi mở rộng

- Có cần cấp quyền riêng cho từng fund không, hay member workspace thấy mọi fund?
- Có hỗ trợ nhiều owner không?
- Có cho phép transaction được sửa sau khi import từ ngân hàng không?
- Provider ngân hàng đầu tiên là provider nào và có hỗ trợ webhook không?
- Có cần chia khoản chi cho nhiều thành viên trong MVP không?
- Auth tự xây dựng hay dùng Supabase/Auth0/Clerk/nhà cung cấp khác?
- Currency MVP chỉ là VND hay ngay từ đầu hỗ trợ nhiều loại tiền?

Nếu chưa có quyết định khác, các tài liệu còn lại dùng các giả định MVP ở trên.
