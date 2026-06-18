// Barcode scanning — native BarcodeDetector API (Chrome Android, primary target).
//
// ⚠️  Library books carry TWO barcodes:
//      1. ISBN EAN-13 (starts with 978 or 979) — we want this one.
//      2. The library's own item barcode (Code39 / Codabar) — ignore it.
//
// We filter by format and validate the 978/979 prefix + EAN-13 checksum.
// If BarcodeDetector is ever missing, throw early with a clear message rather
// than silently loading a fallback library — add zxing when it's actually needed.

const ISBN_PREFIXES = ['978', '979'];

export function isBarcodeApiAvailable() {
  return 'BarcodeDetector' in window;
}

/**
 * Scan a video element for an ISBN-13.
 * Resolves with the ISBN string as soon as one is detected.
 */
export function scanIsbn(videoEl) {
  if (!isBarcodeApiAvailable()) {
    throw new Error('BarcodeDetector not available — use Chrome on Android');
  }
  const detector = new BarcodeDetector({ formats: ['ean_13'] });
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const codes = await detector.detect(videoEl);
        const hit = codes.find(c => isValidIsbn13(c.rawValue));
        if (hit) { clearInterval(interval); resolve(hit.rawValue); }
      } catch (err) { clearInterval(interval); reject(err); }
    }, 200);
  });
}

/** Open the rear camera. Returns the MediaStream; caller stops it when done. */
export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }, audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach(t => t.stop());
}

function isValidIsbn13(value) {
  if (typeof value !== 'string' || value.length !== 13) return false;
  if (!ISBN_PREFIXES.some(p => value.startsWith(p))) return false;
  const digits = value.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}
