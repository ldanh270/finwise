# Frontend implementation plan

## Mục tiêu

Xây giao diện theo các luồng người dùng chính, hiển thị đúng permission và
không để người dùng tạo dữ liệu sai nghiệp vụ.

## FE-01 — Cấu trúc màn hình

```text
/login
/register
/workspaces
/workspaces/:id/overview
/workspaces/:id/transactions
/workspaces/:id/funds
/workspaces/:id/categories
/workspaces/:id/members
/workspaces/:id/bank-connections
/settings/profile
```

## FE-02 — Workspace overview

Hiển thị:

- Tổng số dư theo fund.
- Thu nhập và chi phí trong khoảng thời gian.
- Danh sách giao dịch gần nhất.
- Trạng thái bank sync.
- Workspace hiện tại và user role.

Nếu workspace chưa có fund hoặc transaction, hiển thị empty state có nút tạo
thay vì để màn hình trống.

## FE-03 — Fund flow

Form tạo fund:

```text
name
type
currency_code
opening_balance
```

Validation phía frontend:

- Name bắt buộc.
- Amount không âm.
- Currency hợp lệ.
- Không hiển thị action tạo/sửa cho viewer.

Frontend vẫn phải chấp nhận lỗi từ backend vì validation client không thay thế
được backend validation.

## FE-04 — Transaction flow

Form transaction có các trường:

```text
type: income | expense | transfer
amount
fund
destination_fund khi type = transfer
category khi type = income/expense
transaction_date
note
```

Behavior:

- Chọn `transfer` thì hiện fund đích và ẩn category.
- Chọn `income/expense` thì hiện category và ẩn fund đích.
- Không cho submit amount bằng 0.
- Hiển thị preview tác động tới balance.
- Sau khi thành công, invalidate transaction list và fund balance.

## FE-05 — Transaction list

Chức năng:

- Filter theo fund.
- Filter theo category.
- Filter theo income/expense/transfer.
- Filter theo khoảng ngày.
- Sort mới nhất/cũ nhất.
- Pagination hoặc infinite scroll.
- Hiển thị badge transaction status.
- Viewer không thấy edit/void action.

## FE-06 — Member management

Các trạng thái cần hiển thị:

```text
invited
active
removed
```

Owner/admin có thể mời, đổi role và remove member. Member/viewer chỉ xem danh
sách theo quyền được cấp.

## FE-07 — Bank connection flow

Flow giao diện:

1. Bấm “Connect bank”.
2. Redirect hoặc mở provider authorization.
3. Hiển thị danh sách bank accounts provider trả về.
4. User chọn account và map vào fund.
5. Hiển thị trạng thái connected/syncing/error.
6. Cho phép sync lại hoặc disconnect.

Không hiển thị token trong URL, local storage hoặc error message.

## FE-08 — State và API cache

Tách rõ:

```text
server state: workspace, funds, transactions, sync runs
local UI state: modal, filter, form draft
auth state: current user/session
```

Query key nên chứa workspace/fund context để không hiển thị nhầm dữ liệu khi
user đổi workspace.

## FE-09 — Loading và lỗi

Mỗi màn hình cần có:

- Loading state.
- Empty state.
- Error state.
- Retry action.
- Permission denied state.
- Optimistic update chỉ dùng khi rollback được an toàn.

Với transaction và balance, ưu tiên cập nhật sau khi backend xác nhận thành
công để tránh hiển thị số dư sai.

## FE-10 — Frontend acceptance criteria

- User không thể chọn fund/category từ workspace khác.
- Form transfer tự ẩn/hiện đúng field.
- Viewer không thấy action ghi dữ liệu.
- Refresh trang vẫn giữ đúng workspace context.
- Sync error có thông báo dễ hiểu và nút retry.
- Sau khi tạo/void transaction, list và balance được cập nhật chính xác.
