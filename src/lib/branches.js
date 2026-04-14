// Danh sách chi nhánh Nail. Hotel không chia chi nhánh (chỉ 1 cơ sở).
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

export function branchLabel(id) {
  return BRANCH_LABEL[id] || id || '';
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
