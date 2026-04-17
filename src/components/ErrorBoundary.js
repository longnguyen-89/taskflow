import { Component } from 'react';

// Error Boundary: hiển thị thông báo lỗi thay vì màn hình trắng toàn app
// khi 1 component con crash. Giúp debug production issues.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Log ra console để người dùng copy gửi lại cho dev
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || '';
      const compStack = this.state.errorInfo?.componentStack || '';
      return (
        <div className="max-w-2xl mx-auto mt-4">
          <div className="card p-5 border-l-4" style={{ borderLeftColor: '#dc2626' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-xl">⚠</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-base" style={{ color: '#dc2626' }}>Có lỗi khi tải phần này</h3>
                <p className="text-xs text-gray-600 mt-1">Đã bắt lỗi để tránh crash toàn bộ app. Gửi nội dung bên dưới cho dev để xử lý nhanh.</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-red-800 mb-1">Thông báo lỗi:</p>
              <pre className="text-[11px] text-red-900 whitespace-pre-wrap break-words font-mono">{msg}</pre>
            </div>
            {stack && (
              <details className="mb-3">
                <summary className="text-xs text-gray-600 cursor-pointer font-medium">Chi tiết stack trace</summary>
                <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-[10px] text-gray-700 whitespace-pre-wrap break-words font-mono max-h-60 overflow-auto">{stack}</pre>
              </details>
            )}
            {compStack && (
              <details className="mb-3">
                <summary className="text-xs text-gray-600 cursor-pointer font-medium">Component stack</summary>
                <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-[10px] text-gray-700 whitespace-pre-wrap break-words font-mono max-h-60 overflow-auto">{compStack}</pre>
              </details>
            )}
            <div className="flex gap-2">
              <button onClick={this.reset} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#2D5A3D' }}>Thử lại</button>
              <button onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Tải lại trang</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
