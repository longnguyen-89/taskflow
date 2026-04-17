// Danh sách chi nhánh Nail (hardcoded fallback). Hotel không chia chi nhánh.
export const NAIL_BRANCHES = [
  { id: 'ben_cat', label: 'Bến Cát' },
  { id: 'thuan_an', label: 'Thuận An' },
  { id: 'thu_dau_mot', label: 'Thủ Dầu Một' },
  { id: 'vsip', label: 'VSIP' },
];

export const BRANCH_LABEL = {
  ben_cat: 'Bến Cát',
  thuan_an: 'Thuận An',
  thu_dau_mot: 'Thủ Dầu Một',
  vsip: 'VSIP',
};

export function branchLabel(id, dynamicBranches) {
  // Guard: khi ham duoc dung lam callback cho Array.prototype.map,
  // tham so thu 2 se la index (number), khong phai array. Kiem tra Array.isArray
  // de tranh crash "t.find is not a function".
  if (Array.isArray(dynamicBranches)) {
    const found = dynamicBranches.find(b => b.id === id);
    if (found) return found.label;
  }
  return BRANCH_LABEL[id] || id || '';
}

// Load danh sach chi nhanh tu DB. Fallback ve hardcoded neu DB rong hoac loi.
export async function loadBranches(supabase) {
  try {
    const { data } = await supabase.from('branches').select('*').eq('active', true).order('sort_order');
    if (data && data.length > 0) return data.map(b => ({ id: b.id, label: b.label, department: b.department }));
  } catch (e) { /* fallback */ }
  return NAIL_BRANCHES;
}

// Các chi nhánh mà 1 profile được phép truy cập.
// - Director/Accountant: tất cả 4 chi nhánh (return null = no filter)
// - Hotel staff: [] (department='hotel' đã tách, không dùng branch)
// - Khác (admin/member nail): profile.branches
export function userBranches(profile) {
  if (!profile) return [];
  if (profile.role === 'director' || profile.role === 'accountant') return null; // = all
  return Array.isArray(profile.branches) ? profile.branches : [];
}
