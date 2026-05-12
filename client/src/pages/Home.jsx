import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

function Home() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    apiFetch('/api/health')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ status: 'error' }));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>DIGIVET Online</h1>
      <p>Veterinary Management System</p>
      {status && (
        <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '6px' }}>
          {JSON.stringify(status, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default Home;
