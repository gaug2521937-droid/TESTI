export default function ProfilePage() {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#fff', fontSize: '24px' }}>Профиль пользователя</h1>

      <div style={{
        background: '#333',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h2 style={{ color: '#fff' }}>Демо данные</h2>
        <p style={{ color: '#aaa' }}>Ставок: 100</p>
        <p style={{ color: '#aaa' }}>Винрейт: 45%</p>
      </div>

      <div style={{
        background: '#333',
        padding: '20px',
        borderRadius: '8px'
      }}>
        <h3 style={{ color: '#fff' }}>Последние ставки</h3>
        <div style={{ color: '#0f0' }}>Выигрыш #77: +200</div>
        <div style={{ color: '#f00' }}>Проигрыш #13: -50</div>
      </div>
    </div>
  );
}
