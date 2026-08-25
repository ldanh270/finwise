# Finwise implementation plan

Finwise là ứng dụng quản lý tiền cho cá nhân và nhóm dùng chung. Tài liệu này
chia kế hoạch triển khai thành các workstream riêng để có thể làm tuần tự hoặc
chia cho nhiều người.

## Mục tiêu MVP

Người dùng có thể:

- Đăng ký và đăng nhập.
- Tạo workspace/quỹ nhóm.
- Mời thành viên vào workspace.
- Tạo nhiều fund như tiền mặt, tài khoản ngân hàng, ví điện tử hoặc thẻ tín dụng.
- Tạo giao dịch thu nhập, chi phí và chuyển tiền giữa các fund.
- Xem số dư và lịch sử giao dịch.
- Kết nối ngân hàng, đồng bộ giao dịch và chống import trùng.
- Phân quyền owner, admin, member và viewer.

## Quy ước nghiệp vụ MVP

- `workspace` là một nhóm quản lý tiền, ví dụ “Quỹ gia đình”.
- `fund` là một nơi chứa tiền, ví dụ “Tiền mặt” hoặc “VCB”.
- `transaction` là một khoản tiền vào, tiền ra hoặc chuyển giữa hai fund.
- Thành viên active có thể xem các fund trong workspace.
- Một workspace có một owner.
- Một fund chỉ dùng một currency; transfer khác currency chưa hỗ trợ ở MVP.
- `amount` luôn là số dương.
- `transactions` là nguồn dữ liệu gốc. Balance chỉ là dữ liệu tính nhanh.
- Giao dịch tài chính không bị xóa cứng; chỉ được void/archive và phải giữ lịch sử.
- Chưa triển khai chia tiền giữa thành viên, settlement, budget và recurring transaction.

## Thứ tự triển khai

```text
DB foundation
    ↓
Workspace + permissions
    ↓
Funds + categories + transaction constraints
    ↓
Backend API + balance calculation
    ↓
Frontend core flows
    ↓
Bank connection + bank sync
    ↓
RLS/security hardening
    ↓
Integration/e2e/performance testing
```

## Workstream documents

- [Business decisions](./00-decisions.md)
- [Database](./db/README.md)
- [Backend](./be/README.md)
- [Frontend](./fe/README.md)
- [Bank sync](./bank-sync/README.md)
- [Security](./security/README.md)
- [QA and testing](./qa/README.md)

## Đề xuất cấu trúc source code

Repo hiện chưa có source code. Khi bắt đầu implement có thể dùng:

```text
finwise/
├── fe/                 # Web/mobile frontend
├── be/                 # Backend API and workers
├── db/                 # Migrations, seeds, DBML
├── docs/               # Product and implementation documentation
└── infra/              # Docker, deployment, monitoring configuration
```

## Definition of Done cho MVP

- Database không cho phép trộn dữ liệu giữa hai workspace.
- Các rule income/expense/transfer được enforce bằng database và backend.
- Balance tính lại từ transactions cho cùng kết quả với balance cache.
- Người dùng không đọc hoặc sửa được workspace mình không thuộc về.
- Giao dịch bank không bị import trùng khi chạy sync nhiều lần.
- Frontend xử lý được loading, empty, validation, permission denied và sync error.
- Có unit test, integration test và các flow e2e chính.
- Có migration, seed data và hướng dẫn chạy local.
