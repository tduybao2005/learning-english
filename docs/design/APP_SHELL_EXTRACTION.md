# Tách khung app (AppHeader / AppSidebar) khỏi Next.js

**Ngày:** 2026-07-10
**Mục tiêu:** đưa `AppHeader` và `AppSidebar` vào design system trên claude.ai/design,
để mọi thiết kế dùng khung app **thật** thay vì để agent tự bịa.
**Nguyên tắc:** không stub. Một component render sai trong preview sẽ render sai trong
mọi thiết kế sau này, và không ai bắt được.

---

## 1. Vấn đề gốc

Design-sync **không chạy app** — không server, không database, không session, không
đăng nhập. Nó biên dịch component thẳng từ source rồi render trong một trang HTML trống.
Vì vậy mọi import phụ thuộc runtime của Next đều là rào cản:

```
AppHeader.tsx
  ├── import Link from "next/link"                    ← cần router context
  └── import { LogoutButton } from "..."
        └── import { signOut } from "next-auth/react" ← cần SessionProvider

AppSidebar.tsx
  ├── import Link from "next/link"                    ← cần router context
  └── import { usePathname } from "next/navigation"   ← cần router context
```

Đây **không phải** vấn đề đăng nhập Google. Đây là vấn đề import: hai component trộn lẫn
phần **trình bày** với phần **tác dụng phụ** (điều hướng, đăng xuất).

---

## 2. Những gì đã thay đổi

### 2.1 `web/src/components/AppHeader.tsx`

- Bỏ `import Link from "next/link"` → thêm prop **bắt buộc** `linkComponent: React.ElementType`.
- Bỏ `import { LogoutButton }` → thêm prop **bắt buộc** `logoutSlot: React.ReactNode`.
- Vẫn là server component (không thêm `"use client"`).

### 2.2 `web/src/components/AppSidebar.tsx`

- Bỏ `import Link from "next/link"` → prop **bắt buộc** `linkComponent`.
- Bỏ `usePathname()` → prop **bắt buộc** `pathname: string`.
- Bỏ `"use client"` (không còn hook nào).
- `pathname?.startsWith(...)` → `pathname.startsWith(...)` (không còn nullable).

### 2.3 `web/src/components/AppSidebarConnected.tsx` — **file mới**

Wrapper `"use client"` 5 dòng, giữ `usePathname()` và `NextLink` ở lại app:

```tsx
export function AppSidebarConnected(props) {
  return <AppSidebar {...props} pathname={usePathname() ?? ""} linkComponent={NextLink} />;
}
```

### 2.4 `web/src/app/(app)/layout.tsx`

```tsx
<AppSidebarConnected name={...} email={...} band={...} />
<AppHeader
  className="lg:hidden"
  linkComponent={NextLink}
  logoutSlot={<LogoutButton variant="ghost" />}
/>
```

`layout.tsx` là **server component**. Đó là lý do dùng `logoutSlot` (một ReactNode) chứ
không phải `onLogout` (một hàm): truyền element từ server sang được, truyền hàm thì không.

### 2.5 Design-sync

- `web/.ds-entry.tsx`: export thêm `AppHeader`, `AppSidebar`.
- `.design-sync/config.json`: thêm `componentSrcMap`, `dtsPropsFor`, và `overrides`
  (`AppSidebar` cần `viewport: "1180x560"` vì nó là `hidden lg:flex`).
- `.design-sync/previews/AppHeader.tsx`, `AppSidebar.tsx`: preview truyền `linkComponent="a"`.
- `.design-sync/conventions.md`: dạy design agent phải truyền `linkComponent="a"`.

---

## 3. Vì sao cách này trung thực

Preview truyền `linkComponent="a"`; app truyền `NextLink`. `NextLink` **cũng render ra `<a>`**.
Nghĩa là markup trong design system **giống hệt** markup trong app — chỉ khác cơ chế
điều hướng phía client. Không có gì bị giả lập.

Ngược lại, nếu stub `usePathname` thành hàm rỗng, sidebar sẽ render trạng thái "không có
mục nào active" — một trạng thái **không bao giờ tồn tại** trong app thật.

**Bằng chứng bundle sạch** (đã kiểm sau khi build):

| Chuỗi tìm trong `_ds_bundle.js` | Kết quả |
|---|---|
| `next-auth` | không có |
| `usePathname` | không có |
| `useRouter` | không có |
| `next/link` | không có |

---

## 4. Kiểm chứng đã chạy

| Kiểm tra | Trước | Sau |
|---|---|---|
| `npx tsc --noEmit` | 0 | **0** |
| `npm test` (vitest) | 24 file / 229 test pass | **24 file / 229 test pass** |
| `npm run lint` | 1 warning (`QuestionCard` `<img>`) | **1 warning, y hệt** |
| `npm run build` | — | **exit 0**, mọi route biên dịch |
| `package-validate.mjs` | — | **17/17 preview render sạch**, 0 cảnh báo |

**Chốt an toàn đã được kiểm chủ động.** Tôi tạo một file tạm cố tình quên prop và
xác nhận TypeScript báo lỗi:

```
error TS2739: Type '{ className: string; }' is missing the following properties
  from type '...': linkComponent, logoutSlot
error TS2739: Type '{ name: string; email: string; band: null; }' is missing the
  following properties from type '...': pathname, linkComponent
```

Đây chính là lý do `linkComponent` **không có giá trị mặc định**. Nếu để mặc định `"a"`,
quên truyền ở app sẽ khiến mọi link âm thầm thành thẻ `<a>` thường — build xanh, test xanh,
app vẫn chạy, chỉ là reload cả trang mỗi lần bấm. Không công cụ nào bắt được.

---

## 5. NHỮNG VẤN ĐỀ CÓ THỂ PHÁT SINH KHI TEST THẬT

> Đọc kỹ phần này. `npm test` **không** bảo vệ tầng UI: `vitest.config.ts` đặt
> `include: ["src/**/*.test.ts"]` (chỉ `.ts`, không `.tsx`) và `environment: "node"`.
> Không một test nào trong 229 test chạm tới `AppHeader`, `AppSidebar`, hay `layout.tsx`.
> **Test xanh không chứng minh khung app còn hoạt động.**

### 5.1 Mất client-side navigation (rủi ro cao nhất, không tự động phát hiện được)

**Triệu chứng:** bấm vào link trên sidebar/header thì cả trang **reload trắng** (thấy
nhấp nháy, mất scroll position) thay vì chuyển trang mượt.

**Nguyên nhân:** một call site nào đó truyền `linkComponent="a"` thay vì `NextLink`.

**Vì sao nguy hiểm:** `<a href>` là HTML hợp lệ. Build xanh, test xanh, không lỗi console.

**Cách kiểm bằng tay:** chạy `npm run dev`, đăng nhập, bấm "Luyện nghe" trên sidebar.
Mở DevTools → tab Network. Nếu thấy request tải lại **document** (HTML) thì đã hỏng.
Nếu chỉ thấy request RSC/fetch thì đúng.

**Hiện trạng:** chỉ có **2 call site** trong toàn repo, cả hai đều truyền `NextLink`
(`layout.tsx` và `AppSidebarConnected.tsx`). Đã grep xác nhận.

### 5.2 Active-state của sidebar sai

**Triệu chứng:** không mục nào sáng lên, hoặc sai mục.

**Nguyên nhân:** `usePathname()` trả `null` trong một số trường hợp; `AppSidebarConnected`
đang fallback về `""`. Chuỗi rỗng không khớp `href` nào → không mục nào active.

**Kiểm:** vào `/dashboard`, mục "Lộ trình" phải sáng (nền `bg-primary/10`, chữ `text-primary`).
Vào `/listening/practice_a2_02`, mục "Luyện nghe" phải sáng (logic `startsWith`).

### 5.3 Nút đăng xuất biến mất khỏi header

**Triệu chứng:** ở màn hình < 1024px, góc phải header trống.

**Nguyên nhân:** `logoutSlot` không được truyền. TypeScript **sẽ** bắt được vì prop bắt buộc,
nhưng nếu ai đó truyền `logoutSlot={null}` thì lọt.

**Kiểm:** thu nhỏ cửa sổ dưới 1024px, header hiện ra, phải thấy nút "Đăng xuất" bên phải.
Bấm vào phải đăng xuất và về `/login`.

### 5.4 Server/client boundary

**Triệu chứng:** lỗi build kiểu *"Functions cannot be passed directly to Client Components"*.

**Nguyên nhân:** ai đó đổi `logoutSlot` (ReactNode) thành `onLogout` (function). `layout.tsx`
là server component, **không** truyền hàm xuống được.

**Hiện trạng:** `npm run build` đã pass, nên ranh giới hiện tại đúng. Đừng đổi sang callback.

### 5.5 `AppSidebar` không còn `"use client"`

Nó giờ là component thuần. Nó chỉ được render từ `AppSidebarConnected` (là client).
Nếu sau này có ai render `AppSidebar` **trực tiếp** từ một server component và truyền
hàm vào, sẽ gặp lỗi boundary. Luôn dùng `AppSidebarConnected` trong app.

### 5.6 Điều KHÔNG bị ảnh hưởng

- Không đụng logic nghiệp vụ, grading, seed, prisma, API route.
- `LogoutButton` giữ nguyên hoàn toàn; `settings/page.tsx` vẫn dùng nó như cũ.
- 229 test vẫn pass vì chúng test logic thuần, không test UI.

---

## 6. Đề xuất bổ sung (chưa làm)

Bộ test hiện tại không thể bảo vệ tầng UI. Nếu muốn khung app được test thật:

1. Thêm `jsdom` + `@testing-library/react` vào `vitest.config.ts`, mở `include` cho `.tsx`.
2. Viết test render `AppSidebar` với `pathname="/listening"` và assert mục "Luyện nghe"
   có class `text-primary`. Giờ **làm được**, vì sidebar không còn cần router.

Đây chính là lợi ích phụ của việc tách: component trở nên test được. Trước khi tách thì
không.

---

## 7. Trạng thái design system

- Project: https://claude.ai/design/p/c65cc8d7-1c60-4c55-98e9-8c2555892ad3
- **17 component**, tất cả verify và chấm `good`, render check 17/17 sạch.
- 15 component cũ được anchor `_ds_sync.json` **carried forward** — không phải chấm lại.
- Còn ngoài phạm vi: 17 component nhóm C/D/E (xem `.design-sync/NOTES.md`).
