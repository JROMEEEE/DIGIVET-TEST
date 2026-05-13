import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const MAROON = '#7B1B2E';

export default function QrScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode double-invoke
    if (startedRef.current) return;
    startedRef.current = true;

    const scanner = new Html5Qrcode('qr-scanner-box');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          scanner.stop().then(() => onScan(decoded)).catch(() => onScan(decoded));
        },
        () => {} // suppress per-frame scan failures
      )
      .catch(() => {
        setError('Camera access denied. Please allow camera permissions and try again.');
      });

    return () => {
      scanner.isScanning && scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error ? (
        <div style={{ background: '#fff5f5', border: '1px solid #ffcccc', color: '#cc0000', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      ) : (
        <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
          Point your camera at your DIGIVET QR code
        </p>
      )}

      <div
        id="qr-scanner-box"
        style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#000' }}
      />

      <button
        onClick={onClose}
        style={{ width: '100%', background: 'transparent', border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '0.7rem', fontSize: '0.88rem', cursor: 'pointer', color: '#555', fontWeight: 500 }}
      >
        Cancel
      </button>
    </div>
  );
}