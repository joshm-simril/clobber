// Barcode scanning — BarcodeDetector API with zxing-js fallback.
//
// ⚠️  Library books carry TWO barcodes:
//      1. ISBN EAN-13 (starts with 978 or 979) — we want this one.
//      2. The library's own item barcode (Code39 / Codabar) — ignore it.
//
// We filter by format and validate the 978/979 prefix + EAN-13 checksum.

const ISBN_PREFIXES = ['978', '979'];
const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/esm/index.js';

export function isBarcodeApiAvailable() {
  return 'BarcodeDetector' in window;
}

/**
 * Start scanning a video element for an ISBN-13.
 * Resolves with the ISBN string as soon as one is detected.
 * Rejects on camera/detection error.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<string>} ISBN-13 digits
 */
export function scanIsbn(videoEl) {
  return isBarcodeApiAvailable()
    ? scanWithNativeApi(videoEl)
    : scanWithZxing(videoEl);
}

/**
 * Open the rear camera and stream it into a video element.
 * Returns the MediaStream (caller must stop tracks when done).
 */
export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach(t => t.stop());
}

// --- Internal ---

function scanWithNativeApi(videoEl) {
  const detector = new BarcodeDetector({ formats: ['ean_13'] });
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const codes = await detector.detect(videoEl);
        const hit = codes.find(c => isValidIsbn13(c.rawValue));
        if (hit) {
          clearInterval(interval);
          resolve(hit.rawValue);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 200);
  });
}

async function scanWithZxing(videoEl) {
  const { BrowserMultiFormatReader } = await import(ZXING_CDN);
  const reader = new BrowserMultiFormatReader();
  const result = await new Promise((resolve, reject) => {
    reader.decodeFromVideoElement(videoEl, (result, err) => {
      if (result) resolve(result);
      else if (err && !(err.name === 'NotFoundException')) reject(err);
    });
  });
  const text = result.getText();
  if (!isValidIsbn13(text)) throw new Error(`Not a valid ISBN-13: ${text}`);
  return text;
}

function isValidIsbn13(value) {
  if (typeof value !== 'string' || value.length !== 13) return false;
  if (!ISBN_PREFIXES.some(p => value.startsWith(p))) return false;
  return ean13ChecksumValid(value);
}

function ean13ChecksumValid(ean) {
  const digits = ean.split('').map(Number);
  const sum = digits.slice(0, 12).reduce(
    (acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0
  );
  return (10 - (sum % 10)) % 10 === digits[12];
}
