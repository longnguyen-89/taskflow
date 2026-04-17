# CCE-TasksFlow — Project Context

## ⚠️ CRITICAL SAFETY RULES — PRODUCTION SYSTEM
**App nay dang VAN HANH THUC TE cho he thong Coco Group. Bat buoc tuan thu:**

1. **KHONG duoc tu dong xoa file du lieu** — bat ky file nao (code, migration, asset, config) khong duoc xoa neu khong co yeu cau ro rang tu user.
2. **KHONG duoc xoa du lieu database** — khong chay `DROP TABLE`, `TRUNCATE`, `DELETE FROM` tren production; khong chay lai `supabase-setup.sql` (file do co `DROP TABLE ... CASCADE` se xoa sach du lieu dang chay).
3. **Chi THEM & SUA tinh nang** — khi them cot/bang moi dung `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` hoac tao migration moi (`supabase-migration-YYYY-MM-DD-x.sql`), khong sua migration cu.
4. **Dam bao khong mat du lieu** — truoc khi deploy thay doi lien quan den schema, luon kiem tra: co anh huong data hien co khong? Co can backup khong? Co the rollback khong?
5. **Khi sua logic xoa** — kiem tra ky cac API `delete-*` (delete-task, delete-proposal, delete-user) de khong tao path xoa ngoai y muon.

## Identity
- **Project name**: CCE-TasksFlow (Tasks Flow)
- **Owner**: Coco Group (Coco Spa / Coco Nails / Hotel)
- **Purpose**: App quản lý công việc + đề xuất nội bộ cho team 5-15 người
- **Live URL**: Deploy trên Vercel
- **Status**: PRODUCTION — đang vận hành với dữ liệu thật

> **QUAN TRỌNG**: Đây KHÔNG PHẢI dự án "App giao viec" (coco-tasks) ở `D:\Claude Code\App giao viec`. Đó là dự án khác hoàn toàn với Next.js 16 + TypeScript + App Router.

## Tech Stack
- **Next.js 14** — Pages Router (`src/pages/`)
- **JavaScript** (không TypeScript)
- **React 18**
- **Tailwind CSS v3** — config tại `tailwind.config.js`
- **Supabase** — PostgreSQL + Realtime + Auth + Storage (client-side `@supabase/supabase-js`)
- **web-push** (VAPID) — push notification qua Service Worker
- **Vercel** deploy + Vercel Cron (`vercel.json`)

## Architecture
- Pages Router: `src/pages/index.js` (login), `src/pages/dashboard.js` (main app)
- API routes: `src/pages/api/` (create-user, delete-task, delete-proposal, delete-user, send-push, check-deadlines, generate-recurring)
- Components: `src/components/` (TaskList, CreateTask, Proposals, Performance, MyTasks, Notifications, AdminPanel, RecurringTasks, SearchModal, Toaster)
- Context: `src/contexts/AuthContext.js`
- Lib: `src/lib/` (supabase.js, push.js, notify.js, sendPush.js, branches.js, deletions.js)
- Single-page app style: dashboard.js chứa tất cả tabs, switch bằng state

## Organization Structure
- **2 departments**: Nail (4 chi nhanh: Ben Cat, Thuan An, Thu Dau Mot, VSIP) + Hotel (1 co so)
- **4 roles**: `director` (TGD), `admin` (Quan ly), `accountant` (Ke toan), `member` (Nhan vien)
- **Branch-based access**: TGD/KT thay tat ca, Admin thay chi nhanh phu trach, Member chi thay task lien quan

## Database Tables (Supabase)
profiles, tasks, task_assignees, task_watchers, task_files, task_groups, task_checklist, proposals, proposal_approvers, proposal_watchers, proposal_files, proposal_categories, comments, notifications, push_subscriptions, recurring_tasks, app_settings

## Key Features
- Dashboard: stats + task list (grouped by assignee for admin, by status for member)
- My Tasks: cross-dept tasks grouped by deadline urgency
- Create Task: N assignees = N separate tasks (group_key links them)
- Recurring Tasks: template-based (daily/weekly/monthly/quarterly/semiannual/yearly), cron auto-generates
- Proposals: Mua hang + Thanh toan tabs, multi-approver workflow
- Performance: KPI scoring A+ to D
- Comments: @mention autocomplete, file attachments
- Sub-tasks + Checklist per task
- Overdue reason required when completing late tasks
- Realtime via Supabase channels
- PWA: manifest + service worker
- Admin: user CRUD, groups, categories, reports, appearance (theme/banner/bg)
- Server-side deletion (service_role bypass RLS, director-only)

## Conventions
- Color scheme: primary `#2D5A3D` (emerald green), fonts DM Sans + Outfit
- CSS classes: `.card`, `.input-field`, `.btn-primary`, `.btn-secondary` (defined in globals.css)
- Toast: `import { toast } from '@/components/Toaster'`
- Supabase client: `import { supabase } from '@/lib/supabase'`
- Push: `import { sendPush } from '@/lib/notify'`
- Branch helpers: `import { NAIL_BRANCHES, branchLabel } from '@/lib/branches'`
- Vietnamese UI text throughout
- File naming: PascalCase components, camelCase lib/utils

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client
- `SUPABASE_SERVICE_ROLE_KEY` — server-side API routes
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — push notifications
- `CRON_SECRET` / `NEXT_PUBLIC_CRON_SECRET` — cron auth

## Vercel Cron
- `/api/check-deadlines` — daily 00:00 UTC (nhac deadline + weekly report Thu 2)
- `/api/generate-recurring` — daily 23:00 UTC (sinh task lap lai cho ngay hom sau)

---
## Session Log
<!-- Ghi lai cac thay doi quan trong sau moi phien lam viec -->

### 2026-04-16
- Doc toan bo codebase, hieu day du boi canh du an.
- Tao file CLAUDE.md nay de ghi nho context.
- Them cac nguyen tac an toan production (khong xoa file/data, chi them-sua).

### 2026-04-16 (p.m.) — Feature: Bang chi tiet mat hang trong De xuat
- **DB**: migration moi `supabase-migration-2026-04-16.sql` — `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`. Idempotent, khong anh huong data cu.
- **Code**: sua `src/components/Proposals.js`:
  - Them state `items` + helpers `addItem/removeItem/updateItem/parseNum/itemTotal/itemsGrandTotal`.
  - Them UI bang 7 cot (STT - Ten - DVT - SL - Don gia - Tong gia auto-calc - Ghi chu) trong form create, responsive desktop/mobile.
  - Nut "+ Them dong moi" + nut xoa dong (disabled khi chi con 1 dong).
  - Hang "Tong cong" tu dong sum o cuoi bang.
  - Format VND (1.234.567) cho cot Don gia.
  - Hien thi readonly bang chi tiet khi expand proposal (chi hien neu co items).
  - Save items vao DB khi submit (filter dong trong, parse so).
  - Reset state sau submit.
- **User choices**: giu truong "Chi phi du kien" doc lap voi bang chi tiet; bang khong bat buoc (co the gui de xuat khong co chi tiet).
- **Ap dung**: ca 2 loai "Mua hang" + "Thanh toan".
- **De deploy**: user can chay file `supabase-migration-2026-04-16.sql` tren Supabase SQL Editor truoc khi deploy code.
- **DEPLOYED**: Migration applied thanh cong tren Supabase project `taskflow` (id: dvoagdhbbppqpofzlkju). Code deployed tren Vercel (project `taskflow`, team wyckoffvsa6868-2637s-projects). Production URL: https://cce-tasks.vercel.app. Deployment ID: dpl_AExAXFcrGzePdbaGGnYaBSyydmAy.

### 2026-04-16 (late) — Feature: Upload file dinh kem cho tung dong trong bang chi tiet
- **DB**: Khong can migration moi — mo rong structure JSONB cua cot `items` da co. Moi item them field `files: [{name, url, type, size}]`.
- **Code**: sua `src/components/Proposals.js`:
  - Mo rong `EMPTY_ITEM` them `files: []`.
  - Them state `uploadingItemIdx` de track row dang upload (disable button).
  - Them handlers `handleItemFileUpload(itemIdx, e)` + `removeItemFile(itemIdx, fileIdx)`.
  - Upload len Supabase Storage bucket `attachments` tai path `proposals/items/{timestamp}_{safename}`. Sanitize tieng Viet.
  - Ho tro upload nhieu file 1 lan, moi dinh dang.
  - Desktop: them row phu duoi moi row chinh (indent 52px, align duoi input ten) hien thi file chips + nut "Dinh kem file".
  - Mobile: them section files trong card (sau Ghi chu).
  - Moi file chip: icon type + ten (truncate) + nut xoa (icon X do).
  - Click vao chip → mo file tab moi.
  - Readonly display khi expand proposal: hien file chips duoi moi row (desktop + mobile), click de mo.
  - `cleanItems` giu nguyen `files` array khi submit.
- **DEPLOYED**: Code deployed tren Vercel. Deployment ID: dpl_Bt3Mo3EpR4aCipDANuaRPRfqK88J. Production URL: https://cce-tasks.vercel.app. Bundle /dashboard: 39.6 kB (tang 0.7 kB).

### 2026-04-17 — Feature: Redesign Bao cao C-Level Dashboard
- **Code**: thay the toan bo `ReportsSection` trong `src/components/AdminPanel.js` voi dashboard C-Level moi.
- **Khong can migration DB** — su dung du lieu hien co (tasks, proposals, profiles), them query ky truoc de so sanh trend.
- **7 sections moi**:
  1. Health Score (vong tron 0-100) — diem suc khoe van hanh tu dong tinh theo completion rate, on-time rate, overdue ratio, approval rate.
  2. KPI Cards voi Trend — so sanh voi ky truoc, mui ten len/xuong + % thay doi.
  3. So sanh ky truoc — task moi, hoan thanh, de xuat, chi phi; +/- voi % va delta cu the.
  4. Phan tich bottleneck — tre han theo muc do (1-3d, 3-7d, >7d) + nhan su can chu y (co bao nhieu task tre).
  5. Xep hang hieu qua nhan su — bang xep hang voi progress bar, % hoan thanh, badge tre han.
  6. De xuat & Chi phi — ty le duyet, breakdown dang thanh, phan tich chi phi TB/de xuat, so voi ky truoc.
  7. Khuyen nghi hanh dong AI — tu dong sinh insights tu data patterns (tre han, nhan su, chi phi, xu huong).
- **DEPLOYED**: Deployment ID: dpl_7oLXUZNwXVDfeg2VwGx55sP2zz1U. Bundle /dashboard: 43.6 kB (tang 4 kB do them analytics code).

### 2026-04-17 (p.m.) — Bugfix: Fix 9 bugs tu audit
- **Bug #1 CRITICAL**: `api/send-push.js` — accept ca `CRON_SECRET` va `NEXT_PUBLIC_CRON_SECRET` de push notification tu client khong bi 401.
- **Bug #2 CRITICAL**: `api/create-user.js` — them kiem tra requesterId, chi director moi duoc tao user. `AuthContext.js` gui requesterId khi goi API.
- **Bug #3 HIGH**: Xoa `lib/sendPush.js` — dead code trung lap voi `lib/notify.js`.
- **Bug #4 HIGH**: `api/generate-recurring.js` — doi tu `NEXT_PUBLIC_CRON_SECRET` sang `CRON_SECRET` (server-only, khong expose cho client).
- **Bug #5 HIGH**: `dashboard.js` realtime — debounce 800ms, filter theo department va user_id, tach 2 channel rieng. Giam N² query storm.
- **Bug #6 MEDIUM**: `TaskList.js` — doi tu shared `newComment`/`commentFiles`/`mentionedIds` sang per-task `commentDrafts` state (keyed by taskId). Draft khong bi lon giua cac task.
- **Bug #7 MEDIUM**: `Performance.js` — them `profile` vao useMemo dependency array.
- **Bug #8 LOW**: `TaskList.js` sub-task upload — them `safeName` normalize nhu cac cho khac.
- **Bug #9 LOW**: `AdminPanel.js` — doi `fetch()` thanh `fetchGroups()`/`fetchCats()` tranh shadow global.
- **Bug #10 LOW**: Skip — Proposals client-side filter da du, chua can server-side.
- **DEPLOYED**: Deployment ID: dpl_EfwYJr22Eie5xAzmMD1pbcHUjmYx. Build 16s. All 8 files syntax validated.

### 2026-04-17 (late) — Feature: 4 tinh nang moi (Activity Log, Permissions, Branches, Password)
- **DB**: migration `features_activity_branches_2026_04_17` tao 2 bang: `activity_log` (UUID, user_id, action, target_type/id/title, details JSONB, dept, branch) + `branches` (id TEXT PK, label, department, active, sort_order). Seed 4 chi nhanh hien co.
- **Feature 1 — Activity Log**:
  - New file `lib/activityLog.js` (logActivity helper + ACTIONS constants + labels + icons).
  - Integrate logging tai 5 action points: CreateTask (task_created), TaskList (task_status_changed), Proposals (proposal_created, proposal_approved/rejected).
  - New AdminPanel section "Lich su" voi filter theo action type, timeline UI, load more.
- **Feature 2 — Phan quyen chi tiet**:
  - 6 permissions luu trong `app_settings` key='permissions': member_create_task, admin_delete_tasks, admin_delete_proposals, admin_approve_proposals, admin_manage_users, member_view_reports.
  - AuthContext load permissions on mount, expose 6 computed booleans: canCreateTask, canDeleteTask, canDeleteProposal, canApproveProposal, canManageUsers, canViewReports.
  - Dashboard tabs su dung permission-aware checks thay vi hardcoded role.
  - TaskList su dung canDeleteTask prop thay vi chi isDirector.
  - New AdminPanel section "Phan quyen" voi toggle switches + save.
- **Feature 3 — Quan ly chi nhanh**:
  - `lib/branches.js` them `loadBranches(supabase)` fetch tu DB, fallback hardcoded.
  - Dashboard load dynamic branches on mount, pass `dynamicBranches` xuong components.
  - Branch switcher dung dynamicBranches thay vi NAIL_BRANCHES.
  - New AdminPanel section "Chi nhanh" voi CRUD: them/sua/an/xoa chi nhanh.
- **Feature 4 — Doi mat khau**:
  - New API `api/change-password.js` (user tu doi: verify old pw qua signInWithPassword, roi update).
  - New API `api/reset-password.js` (TGD reset: verify requester = director, roi updateUserById).
  - AuthContext them `changePassword()` va `resetPassword()` methods.
  - Dashboard header: icon khoa ben canh avatar, click mo modal doi mat khau (old + new + confirm).
  - AdminPanel UsersSection: nut "Reset MK" per user, mo modal nhap mat khau moi.
- **Files**: 4 new (migration, activityLog.js, change-password.js, reset-password.js) + 8 modified (AuthContext, dashboard, AdminPanel, CreateTask, TaskList, Proposals, branches.js, Performance.js).
- **DEPLOYED**: Deployment ID: dpl_35DDPjkotTRhuE8EP6wMf3ysc4b1. Bundle /dashboard: 47.8 kB. 2 new API routes: change-password, reset-password.

### 2026-04-17 (night) — Bugfix: Khac phuc trang Quan tri crash sau deploy 4-feature
- **Trieu chung**: User bao trang "Quan tri" bi loi/trang trang sau khi deploy cac hotfix. Nhieu lan rollback/redeploy khong xoa duoc loi.
- **Root cause discovery**:
  1. Them ErrorBoundary (commit c440b12 wrap AdminPanel; 96489dc top-level in _app.js voi inline styles + `window.__LAST_ERROR__`).
  2. ErrorBoundary bat duoc loi: `TypeError: (0, s.loadBranches) is not a function` → truoc do dashboard.js da deploy voi `import { loadBranches }` nhung `src/lib/branches.js` CHUA COMMIT. Hotfix truoc dung `gitDirty: "1"` include uncommitted code nen chay on, sau do commit lai bi dropped.
- **Fix 1**: commit tat ca 17 pending files (4dce41e) — activity log, permissions, branches loadBranches, password APIs, migrations 04-16/04-17, xoa `src/lib/sendPush.js` (dead code, thay the boi `lib/notify.js`).
- **Fix 2**: deploy 4dce41e loai bo loi `loadBranches`, nhung lo ra loi moi: `TypeError: t.find is not a function`. Root cause: `branchLabel(id, dynamicBranches)` bi dung lam Array.prototype.map callback trong AdminPanel (`m.branches.map(branchLabel)`) — map truyen `(element, index, array)` nen `dynamicBranches` nhan gia tri index (number), bien `0` (falsy) ok nhung `index >= 1` truthy se goi `.find()` tren so.
- **Fix 3**: commit c577d70 — doi guard trong `branchLabel` tu `if (dynamicBranches)` sang `if (Array.isArray(dynamicBranches))`. Safe against map-callback misuse.
- **Verification**: click qua 4 tab "Quan tri > Tai khoan / Chi nhanh / Phan quyen / Lich su" tren https://cce-tasks.vercel.app — tat ca render OK, khong crash. DB tables `activity_log`, `app_settings`, `branches` deu da ton tai tren Supabase taskflow project (dvoagdhbbppqpofzlkju).
- **DEPLOYED**: dpl_BB9wX6xubVZihqfFaC1ZaKaDNXv1 (4dce41e — commit features) → dpl_2MEcisoG656hFiYUznxKuyfMEHEm (c577d70 — branchLabel guard fix). Build 22s. Admin page confirmed working end-to-end.
- **Bai hoc**: khi refactor ham utility them tham so, kiem tra tat ca callers — nhat la callers dung ham lam callback cho `.map()` / `.filter()` / `.sort()`. Array prototype methods truyen them arguments lam lech signature.
