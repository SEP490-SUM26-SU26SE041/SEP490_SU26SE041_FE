import React from 'react';

// Client-side pagination. Dùng cho các danh sách đã được load toàn bộ về FE.
// Props:
//   - page: trang hiện tại (1-indexed)
//   - pageSize: số item / trang
//   - total: tổng số item
//   - onPageChange(newPage): callback khi đổi trang
//   - onPageSizeChange?: optional - cho phép đổi pageSize
//   - pageSizeOptions?: mảng [10, 20, 50, 100]
//   - className?: tùy chỉnh layout ngoài
//   - showInfo?: true để hiện "Hiển thị X-Y / Tổng Z"

const defaultPageSizes = [10, 20, 50, 100];

const Pagination = ({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = defaultPageSizes,
  className = '',
  showInfo = true,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  // Tạo danh sách nút số trang (tối đa 7 ô: 1 ... X Y Z ... N)
  const pageNumbers = [];
  const windowSize = 2;
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > windowSize + 2) pageNumbers.push('…');
    for (
      let i = Math.max(2, safePage - windowSize);
      i <= Math.min(totalPages - 1, safePage + windowSize);
      i++
    ) {
      pageNumbers.push(i);
    }
    if (safePage < totalPages - windowSize - 1) pageNumbers.push('…');
    pageNumbers.push(totalPages);
  }

  const go = (p) => {
    if (p < 1 || p > totalPages || p === safePage) return;
    onPageChange?.(p);
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 py-3 ${className}`}>
      {showInfo && (
        <p className="text-xs text-on-surface-variant">
          {total === 0 ? 'Không có dữ liệu' : (
            <>Hiển thị <b className="text-on-surface">{start}–{end}</b> / Tổng <b className="text-on-surface">{total}</b></>
          )}
        </p>
      )}
      <div className="flex items-center gap-1">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange?.(1); }}
            className="text-[11px] px-2 py-1 border border-outline-variant rounded-md bg-white mr-2"
          >
            {pageSizeOptions.map(s => <option key={s} value={s}>{s}/trang</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={() => go(safePage - 1)}
          disabled={safePage <= 1}
          className="px-2.5 py-1 text-xs font-bold rounded-md border border-outline-variant bg-white hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ‹ Trước
        </button>
        {pageNumbers.map((p, idx) => (
          p === '…' ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-on-surface-variant">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              className={`min-w-[32px] px-2 py-1 text-xs font-bold rounded-md border ${
                p === safePage
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white border-outline-variant hover:bg-surface-container'
              }`}
            >
              {p}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => go(safePage + 1)}
          disabled={safePage >= totalPages}
          className="px-2.5 py-1 text-xs font-bold rounded-md border border-outline-variant bg-white hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Sau ›
        </button>
      </div>
    </div>
  );
};

export default Pagination;
