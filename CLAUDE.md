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

### 2026-04-17 (late night) — Features 7 & 9: Kanban Board + Task Pin
- **Yeu cau user**: "Ở phần nâng cấp này hãy nâng cấp phần 7 và phần 9" (nang cap phan 7 va 9 trong roadmap UI).
- **Feature 7 — Kanban Board view**:
  - New component `src/components/KanbanBoard.js`: 4 cot trang thai (Chua lam / Dang thuc hien / Cho phan hoi / Hoan thanh).
  - HTML5 native drag-and-drop giua cac cot → doi `task.status` tu tren client, verify voi overdue modal (neu task tre han + keo sang done/waiting thi yeu cau chon ly do — reuse modal y het TaskList).
  - Task card trong Kanban: title, description preview, priority chip, deadline, assignee avatars, sub-task count, file count.
  - Toast xac nhan doi trang thai, push notify creator, log activity voi `source: 'kanban'` trong details.
  - View toggle "Danh sach / Kanban" trong tab Dashboard, persist preference vao `localStorage` key `taskflow_view_mode`.
  - Click card Kanban → chuyen ve List view + focus task (reuse `focusTaskId` state).
- **Feature 9 — Task Pin (ghim)**:
  - Migration moi `supabase-migration-2026-04-17b.sql`: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false`. Index partial `WHERE pinned = true`.
  - `togglePin` handler trong TaskList + KanbanBoard. Permission: `canPinTasks = isAdmin || isAccountant` (admin/director/accountant; member khong duoc ghim).
  - Task ghim: 📌 emoji canh title + amber-500 left border 3px + amber-50 bg tint. Hien o ca List va Kanban view.
  - Sort pinned truoc: trong `parentTasks.sort(...)` cua TaskList va trong `byStatus` groups cua KanbanBoard.
  - Nut Ghim/Bo ghim: trong List view o header dong expanded (canh nut Xoa); trong Kanban o goc phai tren cua card (icon-only 📌/📍).
- **Prop threading**: them `canPinTasks` prop xuyen suot Dashboard → TaskList → Row (vi `isAdmin` trong TaskList da bi overload thanh "admin view mode" = director||accountant, khong phan anh vai tro admin thuc).
- **Files**: 2 new (`supabase-migration-2026-04-17b.sql`, `src/components/KanbanBoard.js`) + 2 modified (`src/components/TaskList.js`, `src/pages/dashboard.js`). Migration da apply tren Supabase taskflow project (dvoagdhbbppqpofzlkju) qua MCP.
- **Verification**: tren `https://cce-tasks.vercel.app/dashboard`:
  1. Toggle List/Kanban: click chuyen doi muot, state persist qua localStorage.
  2. Kanban: 4 cot hien day du, 29 task done nam trong cot "Hoan thanh", task card co day du info.
  3. Pin: click nut 📌 tren task card → toast "📌 Da ghim task" xuat hien, task nhan border amber + emoji 📌 canh title. Tab List hien thi dung nhu Kanban.
  4. Unpin: click lai → toast "Da bo ghim", border va emoji bien mat. Khoi phuc trang thai goc.
  5. Console: no errors. Build 23s.
- **DEPLOYED**: dpl_J24PQtvdHvwXc7zG89StKn5dLbB2 (commit c18734a). Production alias `cce-tasks.vercel.app` da cap nhat.
- **Safety**: migration idempotent (IF NOT EXISTS, DEFAULT false) — khong anh huong 29 task hien co, tat ca mac dinh `pinned = false`.

### 2026-04-17 (end-of-day) — Features 10, 11, 12: Price History + Smart @mention + Comment Reactions
- **Yeu cau user**: "Lich su gia - Theo doi gia mua cua tung mat hang qua cac de xuat. Phat hien gia tang bat thuong. @mention thong minh hon - Khi @mention trong comment, auto goi y context: 'Giao task nay cho @Truc?' -> 1 click gan assignee. Reactions tren comment - Like/emoji nhanh thay vi phai reply 'OK', 'Da nhan'. Lam cac phan tren".
- **Feature 10 — Lich su gia mua hang (Price History)**:
  - New file `src/components/PriceHistory.js` (~260 dong).
  - Query `proposals` co items, loc `category_name != 'Thanh toán'` (chi de xuat Mua hang).
  - Group by `normalizeName(item.name)` (lowercase, bo dau, trim). Moi group tinh: min/max/avg/latest price + entries[] sorted desc theo date.
  - Classify latest vs avg: >50% = "Tang manh" (🚨 do), >20% = "Tang" (📈 cam), <-20% = "Giam" (📉 xanh), else = "Binh thuong" (📦 xam).
  - UI: 3 thẻ KPI (so mat hang, so abnormal, so de xuat da duyet) + search + filter (all/approved/pending) + sort (abnormal/recent/count/name) + main list card.
  - Row expand → hien toan bo lich su mua: date · title · creator · branch · status · SL · price · % thay doi so voi entry truoc.
  - AdminPanel: them menu "Lich su gia" (icon line-chart) giua "Lich su" va "Bao cao".
- **Feature 11 — Smart @mention suggest-assign**:
  - Trong TaskList, them ham `assignMentionedUser(taskId, userId, userName)`: insert `task_assignees`, gui notify + push.
  - Permission giao task: `isAdmin || isDirector || t.created_by === uid` (creator luon co quyen gan cho task cua minh).
  - UI: ngay duoi CommentInput (trong Row), khi `draft.mentionedIds` chua co nguoi chua-la-assignee VA tex comment van con chua `@Name`, hien chip xanh `Giao task nay cho @Name?` voi icon user-plus.
  - Click chip → `assignMentionedUser()` → toast "✅ Da giao task cho Name" + `onRefresh()`.
  - Han che: chi hien cho member la mentionable (khong hien cho chinh minh, khong hien cho nguoi da la assignee).
- **Feature 12 — Reactions tren comment**:
  - New migration `supabase-migration-2026-04-17c.sql`: bang `comment_reactions(id, comment_id FK, user_id FK, emoji, created_at, UNIQUE(comment_id, user_id, emoji))`. RLS: SELECT public, INSERT/DELETE chi cho `auth.uid() = user_id`. Apply qua Supabase MCP.
  - `loadComments` tang nested select: `reactions:comment_reactions(id, emoji, user_id)` — Supabase auto-detect FK.
  - Ham `toggleReaction(commentId, emoji, taskId)`: neu minh da react → delete; chua → insert. Sau do reload comments cua task.
  - New component `CommentRow` (extract tu inline): render avatar + name + time + content + files + reactions + picker. Mappers reactions theo emoji de dem count + biet minh da react chua.
  - 6 emoji: 👍 ✅ ❤️ 🎉 🙏 😂. Display pill `emoji count` duoi comment; pill xanh border khi minh da react.
  - Hover comment → hien button `😊+` o cuoi; click mo popover picker; click emoji trong picker → toggle + dong picker.
- **Files**: 1 new component (`PriceHistory.js`), 1 new migration, 2 modified (`AdminPanel.js`: import+menu+section; `TaskList.js`: loadComments nested, assignMentionedUser, toggleReaction, CommentRow extract, suggest-chip UI).
- **Prop threading**: `assignMentionedUser`, `members`, `toggleReaction` them vao Row props + 3 Row call sites (2 trong view thong thuong, 1 trong view groupByAssignee).
- **DEPLOYED**: commit a2689ab, deployment dpl_H6qgrMnDh5d2qn9phDcMoEHpcXWs. Migration `comment_reactions_feature_12` da apply tren Supabase taskflow project (dvoagdhbbppqpofzlkju).
- **Safety**: migration idempotent, khong anh huong 61 comment hien co. PriceHistory chi doc proposals + items — khong sua du lieu. Smart @mention chi dung quyen san co (check assignee trung, check permission). Reactions FK CASCADE → khi xoa comment thi xoa luon reactions.

### 2026-04-18 — Features 20, 21, 22, 23: CEO Analytics Suite
- **Yeu cau user**: 4 feature cho TGD/CEO — (20) bao cao tu dong cuoi tuan/thang, (21) so sanh chi nhanh, (22) bieu do xu huong theo thoi gian, (23) heatmap gio lam viec. Kem cau hoi "bao cao o muc 20 co gui qua zalo dc ko?".
- **Tra loi Zalo**: Co 3 cach — Zalo OA + ZNS (gui tin SMS-like qua so phone, can duyet mau 1-3 ngay, ~300-500d/tin, phai la DN), Zalo OA message (mien phi nhung user phai bam Quan Tam OA), webhook Zalo group (khong co API chinh thuc). Truoc mat trien khai: in-app notification + push + email (qua Resend neu co key). Sau se them Zalo ZNS khi khach dang ky OA.
- **Feature 20 — Auto CEO Report**:
  - New endpoint `src/pages/api/send-ceo-report.js`. Method: GET (cron) hoac POST (manual).
  - Params: `?period=week` (7 ngay qua) hoac `?period=month` (tu dau thang). Default `week`.
  - Auth: Vercel Cron gui header `Authorization: Bearer <CRON_SECRET>` → check; hoac `x-api-key` / `?key=`; hoac `?requesterId=` + DB check role=director.
  - Compute KPI cho ca 2 department (nail + hotel): totalTasks, done, rate, overdue, approved, pending, cost, health score, onTimeRate + so sanh voi ky truoc (trendArrow).
  - Send: notify (`notifications` insert) + push (`sendPushToUser`) + email (Resend API neu co `RESEND_API_KEY` env, else skipped) cho tat ca director. HTML email co style inline.
  - Updated `vercel.json` them 2 cron: weekly `0 1 * * 1` (Thu 2 8am VN) va monthly `0 1 1 * *` (ngay 1 8am VN).
  - Manual trigger: button trong `ReportsSection` (banner amber phia tren) — "Báo cáo tuần" + "Báo cáo tháng". Fetch POST `/api/send-ceo-report?period=week&requesterId=<uid>`.
- **Feature 21 — BranchCompareSection** (`src/components/Analytics.js`):
  - Chi dung cho `department === 'nail'` (Hotel khong chia CN).
  - User chon 2-4 chi nhanh (checkbox pill row), mac dinh 4 CN dau tien.
  - Period: week / month / quarter / year.
  - Fetch tasks + proposals + profiles, group by `branch`. Render card grid (1-4 cot) voi: task done/total + progress bar, overdue, approved/pending de xuat, chi phi, so nhan su.
  - Auto highlight: CN co `rate` cao nhat = border xanh + badge "🏆 Tot nhat"; CN thap nhat (neu >= 2 CN) = border hong + badge "⚠ Yeu".
- **Feature 22 — TrendChartSection**:
  - Toggle: week (moi tuan 7 ngay) vs month (moi thang). Chu ky: 6/8/12.
  - Tinh buckets: [{label, total, done, overdue, rate}] cho N ky gan nhat.
  - SVG 720×220: bars = so task tao (xanh nhat), line = ty le hoan thanh % (xanh dam), Y-axis 0-100%, X-axis labels theo bucket.
  - Summary cards: Latest rate, delta vs ky dau, tong task trong khung.
- **Feature 23 — WorkHeatmapSection**:
  - Range: 7 / 30 / 90 ngay. Fetch tasks `status=done` + `completed_at IS NOT NULL`.
  - Matrix 7 (T2-CN) × 24 (0h-23h). Color scale: 5 steps tu #f9fafb -> #065f46.
  - Insights: tong task hoan thanh, ngay nang suat nhat, gio nang suat nhat.
  - Cell hover title: "Thu X H:00 — N task".
- **AdminPanel integration**: Them 3 menu item moi — "So sanh CN" (branch compare), "Xu huong" (trend), "Heatmap gio". ReportsSection them prop `isDirector` + `currentUserId` va "Gui bao cao CEO ngay" banner.
- **Build**: `next build` sach, dashboard 59.3 kB (tang ~7kB do SVG chart + heatmap).
- **Files**: 2 new (`api/send-ceo-report.js` ~280 dong, `components/Analytics.js` ~370 dong), 2 modified (`AdminPanel.js` them import + 3 menu + 3 section render + ReportsSection banner; `vercel.json` them 2 cron).
- **DEPLOYED**: commit 936c6d1, deployment dpl_7TFPBa8i2gucVTBmiME6wS5PP2yk.
- **TODO sau**: (a) setup Zalo OA + ZNS template neu muon gui qua Zalo, (b) setup `RESEND_API_KEY` + `RESEND_FROM` trong Vercel env neu muon gui email, (c) CRON_SECRET phai set de cron work.

### 2026-04-18 (late) — 4 Plan features verification + app_settings migration
- **Yeu cau user**: Plan mode — 4 feature upgrade: (1) Activity Log, (2) Permissions (TGD cau hinh), (3) Branch Management (CRUD CN), (4) Password Change (TGD reset + user tu doi).
- **Phat hien**: Tat ca 4 feature DA implement tu cac session truoc:
  - **Activity Log**: `src/lib/activityLog.js` (logActivity + ACTIONS/ACTION_LABELS/ACTION_ICONS). Tich hop trong CreateTask, TaskList, Proposals, KanbanBoard. `ActivityLogSection` trong AdminPanel (menu "Lich su"). `activity_log` table da co 16 rows (dang chay thuc).
  - **Permissions**: `AuthContext.js` co DEFAULT_PERMISSIONS + load tu `app_settings` key='permissions' + expose canCreateTask/canDeleteTask/canDeleteProposal/canApproveProposal/canManageUsers/canViewReports. `PermissionsSection` trong AdminPanel (menu "Phan quyen") voi 6 toggle.
  - **Branch Management**: `lib/branches.js` co `loadBranches(supabase)` + fallback NAIL_BRANCHES. `dashboard.js` load dynamic branches va pass `dynamicBranches` prop. `BranchesSection` trong AdminPanel (menu "Chi nhanh") — CRUD + toggle active. `branches` table da co 4 rows.
  - **Password Change**: `api/change-password.js` (verify old pwd via signInWithPassword) + `api/reset-password.js` (verify requester=director). AuthContext expose `changePassword(email, old, new)` + `resetPassword(userId, new)`. Dashboard co pw modal (click avatar → "Doi mat khau"). AdminPanel UsersSection co nut "Reset MK" per user.
- **Gap duy nhat**: `app_settings` table ton tai nhung khong co migration file document — da seed `permissions` key truoc day thu cong. 
- **Fix**: Tao `supabase-migration-2026-04-18.sql` document cau truc `app_settings` table + seed default permissions row (idempotent). Da apply migration `seed_app_settings_permissions_2026_04_18` tren Supabase taskflow project — row `permissions` seeded voi 6 key: member_create_task/admin_delete_tasks/admin_delete_proposals/admin_approve_proposals/admin_manage_users=false, member_view_reports=true.
- **Build**: `next build` sach (dashboard 59.3 kB, khong thay doi).
- **Files**: 1 new (`supabase-migration-2026-04-18.sql` — document table + seed).
- **DEPLOYED**: migration applied only (khong can redeploy — code khong thay doi).
- **Safety**: Migration chay `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING` — khong anh huong 1 row `appearance` hien co.

### 2026-04-22 — Executive Dashboard redesign cho Tong quan (viewMode=list)
- **Yeu cau user**: "tôi muốn phần giao diện ngoài Tổng quan giống như hình số 2 mà tôi gửi. ở mục danh sách. còn mục kanban giữ nguyên" + "xóa 2 dòng chữ nail - 4 chi nhánh và hotel - 4 chi nhánh đi luôn" (sidebar).
- **Thay doi**: Thay toan bo UI "Danh sach" cua tab Tong quan bang Executive Dashboard theo design reference (`design-tasks-flow/project/components/dashboard.jsx`). Kanban giu nguyen khong doi.
- **Executive header**: hien thi date mono uppercase (Thu X · dd.mm.yyyy), greeting "Chào, {Giám đốc|Kế toán|Quản lý|Ten}.", summary "Hôm nay có N task cần bạn để mắt và M đề xuất đợi duyệt", 2 button "Xem báo cáo" (→ tab performance) + "Tạo task mới" (→ tab create).
- **4 KPI cards**: Task dang mo (delta so voi tuan truoc), Hoan thanh tuan nay (delta% so voi tuan truoc), Tre han (delta), De xuat cho duyet. Moi card co number 28px + DeltaBadge (arrow up/down) + sparkline 10 cot (9 xam, cot cuoi mau accent/warn/danger).
- **Focus list "Can chu y hom nay"** (left, 1.6fr): top 5 task sap xep theo pinned + urgency score. Header co 3 pill dem so task: "Tre N" (danger), "Hom nay N" (warn), "Tuan nay N" (accent). Moi row hien: pin icon (neu pinned), status dot (circle filled theo status), title + metadata (#id · branch · file count), deadline pill (Trễ Nd / Hôm nay / Ngày mai / Còn Nd / dd/mm), avatar stack. Click row → switch sang Kanban + set focusTaskId. Footer co link "Xem toàn bộ task →" (switch sang Kanban).
- **Health score card** (right top): SVG circle 72×72 voi progress = healthScore/100. healthScore = onTimeRate*0.5 + completionRate*0.5. Color: >80 accent, >60 warn, else danger. Label: "Vận hành tốt"/"Cần chú ý"/"Cần cải thiện". Delta so voi tuan truoc.
- **Assignee ranking card** (right bottom): top 4 member theo rate = done/total, sap xep desc. Row hien: #rank, avatar, name, progress bar 60px (rate%), text "done/total".
- **Data layer** (dashboard.js): them `pendingProposalsCount` state + fetch trong fetchData. Tinh openTasks/doneThisWeek/donePrevWeek/overdueTasks, sparkDone/sparkOpen/sparkOverdue/sparkProp (10 ngay), deltaDoneWeek/deltaDoneWeekPct/deltaOpen/deltaOverdue, focusTasks (top 5 by taskUrgency), focusCounts, healthScore/healthLast/healthDelta, memberStats (top 4).
- **Helper components** (trong Dashboard): Sparkline, DeltaBadge, AvatarChip — dung lai cho KPI row + focus list + ranking.
- **Sidebar cleanup**: xoa 2 dong "{dept} · {N} chi nhánh" o subtitle sidebar (user yeu cau).
- **Build**: `next build` sach. Dashboard bundle 61.6 kB (tang ~2kB tu 59.3 kB).
- **Files**: 1 modified (`src/pages/dashboard.js`).

### 2026-04-22 (p.m.) — Greeting personalization + Performance tab redesign
- **Yeu cau user #1**: "chữ chào giám đốc này là ai cũng có hay là nó sẽ lấy theo tên của người dùng? hãy lấy theo tên của người dùng. Ví dụ người dùng tên Nguyễn Ngọc Phương thì sẽ tự động là Chào Nguyễn Ngọc Phương".
- **Fix greeting**: `dashboard.js` executive header — thay logic "role-based greeting" (Giam doc/Ke toan/Quan ly/firstName) bang `const roleGreeting = profile?.name || 'bạn';` → luon hien ten day du cua user.
- **DEPLOYED #1**: commit 725880d, dpl_2478baMbLunSNkN7TGPUHBc2eosy.

- **Yeu cau user #2**: "chõ phần đánh giá này. có giao diện nào nhìn đẹp hơn không? hãy nghiên cứu và thiết kế lại để nhìn trực quan hơn và gọn hơn" (kem anh tab Danh gia hien tai).
- **Nghien cuu**: doc design reference `design-tasks-flow/project/components/proposals_perf_analytics.jsx` → table-based layout voi rank medal, avatar, score mono, grade pill, progress bar, onTime %, sparkline SVG, overdue pill.
- **Thay doi Performance.js** (rewrite hoan toan ~370 dong):
  - **Header**: title "Đánh giá hiệu suất" + subtitle dem N nhan su trong ky. Row phai co 4 pill period (Tuần/Tháng/Quý/Năm) — active = bg accent-soft + border accent + color accent, con lai card bg. Custom range: 2 input date + nut "Bỏ chọn".
  - **Summary strip** (4 cards): (1) Nhan su danh gia = count, (2) Diem trung binh = avg score mau theo threshold (>=70 accent / >=50 warn / else danger), (3) Da hoan thanh + dong phu "N tre han" (mau danger), (4) Top performer = avatar + ten + grade badge + score mono.
  - **Table card** grid-template-columns: `44px 1fr 60px 56px 1fr 72px 108px 60px 28px`. Columns:
    - `#` (medal 🥇🥈🥉 cho top 3, `#N` mono cho con lai, 15px font)
    - `Nhan su` (Avatar 30px + name 13px bold + position 11px muted)
    - `Diem` (18px mono, mau theo grade tone)
    - `Hang` (pill bg gradeBg + color gradeColor: A+>=85, A>=70, B>=60, C>=50, D<50)
    - `Hoan thanh` (thin progress bar 100px height 3px + "done/total" mono)
    - `Dung han` (% mau theo threshold >=80 accent / >=60 warn / else danger)
    - `Xu huong` (Sparkline SVG 104×24, polyline + dot cuoi, stroke theo tone)
    - `Tre` (pill danger "Ndays" hoac dash)
    - chevron rotate 180 khi expanded
  - **Mobile responsive**: 1 row compact, avatar + name/position ben trai, score 20px mono + grade pill ben phai. Click vẫn expand.
  - **Expandable**: click row → hien 4 extra KPI nho (Dang lam / Cho phan hoi / Ti le xong % / TB xong ngay/task) + khoi AI feedback left-border 3px tone = grade tone + text muted ink2.
  - **Sparkline component** (bottom of file): 8 buckets chia deu ky, rate per bucket (done/total). Polyline + dot cuoi cung highlight.
  - **CSS variables**: dung --accent, --warn, --danger, --ink, --ink2, --muted, --bg-soft, --line, --card-bg, --gradeBg (a/b/c/d), --gradeColor (a/b/c/d).
- **Build**: `next build` sach. Dashboard bundle 61.6 kB (khong doi — Performance.js chunk rieng).
- **Files**: 1 modified (`src/components/Performance.js` +266/-102 dong).
