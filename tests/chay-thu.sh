#!/bin/bash
# Chạy phép thử xác thực API trên BẢN SAO của repo, môi trường sạch (env -i):
# không nạp .env.local (khoá production), không mạng thật (fetch bị chặn, Supabase giả).
#   bash tests/chay-thu.sh            → chạy phép thử trên mã hiện tại
#   bash tests/chay-thu.sh --dot-bien → thử 7 đột biến, mỗi cái phải làm phép thử ĐỎ
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

copy_repo() {  # $1 = thư mục đích
  mkdir -p "$1"
  cp -R "$REPO/src" "$REPO/tests" "$1/"
}

run_tests() {  # $1 = gốc bản sao; in kết quả ra $1/ket-qua.txt, trả mã thoát của node
  ( cd "$1" && env -i PATH="/usr/bin:/bin" HOME="$1" TASKFLOW_ROOT="$1" \
      "$NODE" --import ./tests/hooks.mjs --test --test-reporter=spec tests/api-auth.test.mjs ) > "$1/ket-qua.txt" 2>&1
}

if [ "${1:-}" != "--dot-bien" ]; then
  copy_repo "$TMP/goc"
  run_tests "$TMP/goc"; rc=$?
  cat "$TMP/goc/ket-qua.txt"
  echo "=== mã thoát phép thử: $rc"
  exit $rc
fi

# ── Đột biến: mỗi dòng = file | chuỗi gốc | chuỗi thay ──
# Chuỗi gốc phải có trong file (không có = đột biến không áp được → báo lỗi, không im lặng bỏ qua).
MUTANTS=(
  "src/lib/apiAuth.js|.eq('id', user.id)|.eq('id', req.body?.requesterId || req.query?.requesterId || user.id)|1 tin lại requesterId trong body/query"
  "src/lib/apiAuth.js|  if (!token) {|  if (false) {|2a bỏ kiểm token (phần 1)"
  "src/lib/apiAuth.js|  if (profile.active === false) {|  if (false) {|3 bỏ kiểm hồ sơ bị khoá"
  "src/pages/api/send-push.js|  if (!isCronRequest(req)) {|  if (!isCronRequest(req) \&\& req.headers['x-api-key'] !== process.env.NEXT_PUBLIC_CRON_SECRET) {|4 send-push nhận lại khoá công khai"
  "src/pages/api/reset-password.js|  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được reset mật khẩu' });||5 reset-password bỏ kiểm TGĐ"
  "src/pages/api/set-user-active.js|  if (!allowed) return res.status(403).json({ error: 'Không có quyền quản lý tài khoản' });||6 set-user-active bỏ kiểm quyền Quản lý"
  "src/pages/api/generate-recurring.js|  if (!isCronRequest(req)) {|  if (!isCronRequest(req) \&\& !req.headers['user-agent']?.includes('vercel-cron')) {|7 tin lại User-Agent vercel-cron"
)
# Đột biến 2 cần 2 chỗ: không token VÀ token sai đều phải lọt → thêm phần 2 vào cùng bản sao.
EXTRA_2="src/lib/apiAuth.js|  if (authErr || !user) {|  if (false) {"
EXTRA_2B="src/lib/apiAuth.js|.eq('id', user.id)|.eq('id', user?.id ?? req.body?.requesterId)"

apply_mut() {  # $1 = gốc, $2 = "file|gốc|thay"
  local f old new
  IFS='|' read -r f old new _ <<< "$2"
  OLD="$old" NEW="$new" perl -0pi -e 'BEGIN{$o=$ENV{OLD};$n=$ENV{NEW};$n=~s/\\&/&/g} $c += s/\Q$o\E/$n/; END{exit($c?0:3)}' "$1/$f"
}

fail=0; n=0
for m in "${MUTANTS[@]}"; do
  n=$((n+1))
  label="${m##*|}"
  d="$TMP/dot-bien-$n"
  copy_repo "$d"
  if ! apply_mut "$d" "$m"; then echo "LỖI: không áp được đột biến [$label] — chuỗi gốc không còn trong file"; fail=1; continue; fi
  if [[ "$label" == 2a* ]]; then
    apply_mut "$d" "$EXTRA_2" || { echo "LỖI: không áp được phần 2 của [$label]"; fail=1; continue; }
    apply_mut "$d" "$EXTRA_2B" || { echo "LỖI: không áp được phần 3 của [$label]"; fail=1; continue; }
  fi
  run_tests "$d"; rc=$?
  so_do=$(grep -c "^✖" "$d/ket-qua.txt")
  if [ $rc -ne 0 ]; then
    echo "BẮT ĐƯỢC  đột biến $label  → phép thử đỏ ($so_do dòng ✖)"
  else
    echo "LỌT       đột biến $label  → phép thử vẫn XANH (phép thử yếu!)"; fail=1
  fi
done
echo "=== đột biến: $n, lọt: $( [ $fail -eq 0 ] && echo 0 || echo '≥1 (xem trên)')"
exit $fail
