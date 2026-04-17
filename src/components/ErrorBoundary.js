import { Component } from 'react';

// Error Boundary: hiển thị thông báo lỗi thay vì màn hình trắng toàn app
// khi 1 component con crash. Dùng inline styles để không phụ thuộc CSS đã load.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] caught:', error, errorInfo);
    if (typeof window !== 'undefined') {
      // Lưu error toàn cục để user có thể mở DevTools xem ngay cả khi UI crash
      window.__LAST_ERROR__ = { error, errorInfo, at: new Date().toISOString() };
    }
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || '';
      const compStack = this.state.errorInfo?.componentStack || '';

      return (
        <div style={{ minHeight: '100vh', padding: 20, background: '#fef2f2', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ maxWidth: 720, margin: '20px auto', background: '#fff', borderRadius: 12, padding: 24, borderLeft: '4px solid #dc2626', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚠</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#dc2626' }}>Có lỗi khi tải phần này</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>Đã bắt lỗi để tránh crash toàn bộ app. Chụp ảnh nội dung bên dưới gửi cho dev để xử lý.</p>
              </div>
            </div>

            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#991b1b' }}>Thông báo lỗi:</p>
              <pre style={{ margin: '6px 0 0', fontSize: 12, color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Consolas, monospace' }}>{msg}</pre>
            </div>

            {compStack && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 12, color: '#444', cursor: 'pointer', fontWeight: 600 }}>Component stack (vị trí crash)</summary>
                <pre style={{ marginTop: 8, background: '#f3f4f6', borderRadius: 8, padding: 12, fontSize: 11, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Consolas, monospace', maxHeight: 200, overflow: 'auto' }}>{compStack}</pre>
              </details>
            )}

            {stack && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 12, color: '#444', cursor: 'pointer', fontWeight: 600 }}>Stack trace JS</summary>
                <pre style={{ marginTop: 8, background: '#f3f4f6', borderRadius: 8, padding: 12, fontSize: 11, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Consolas, monospace', maxHeight: 250, overflow: 'auto' }}>{stack}</pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={this.reset} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: '#2D5A3D', border: 'none', cursor: 'pointer' }}>Thử lại</button>
              <button onClick={this.reload} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#444', background: '#f3f4f6', border: 'none', cursor: 'pointer' }}>Tải lại trang</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
