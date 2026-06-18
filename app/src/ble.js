// Web Bluetooth helpers — thin wrappers over the Web Bluetooth API.
// ⚠️  Web Bluetooth is foreground-only. No background scanning.
//     All calls require a user gesture (button tap) to initiate.

// UUIDs must match docs/gatt-spec.md and firmware exactly.
const CLOBBER_SVC_UUID = 'c10bbe12-0000-0000-0000-000000000001';
const BUZZ_CHAR_UUID   = 'c10bbe12-0000-0000-0000-000000000002';
const ISBN_CHAR_UUID   = 'c10bbe12-0000-0000-0000-000000000003';

export function isBleAvailable() {
  return 'bluetooth' in navigator;
}

/**
 * Opens the browser's device-picker filtered to CLB- tags.
 * Returns a connected TagHandle or throws.
 */
export async function scanAndConnect() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'CLB-' }],
    optionalServices: [CLOBBER_SVC_UUID],
  });
  return connectToDevice(device);
}

/**
 * Reconnects to a previously discovered BluetoothDevice.
 */
export async function connectToDevice(device) {
  const server  = await device.gatt.connect();
  const service = await server.getPrimaryService(CLOBBER_SVC_UUID);
  const [buzzChar, isbnChar] = await Promise.all([
    service.getCharacteristic(BUZZ_CHAR_UUID),
    service.getCharacteristic(ISBN_CHAR_UUID),
  ]);
  return new TagHandle(device, server, buzzChar, isbnChar);
}

export class TagHandle {
  constructor(device, server, buzzChar, isbnChar) {
    this.device   = device;
    this.server   = server;
    this._buzz    = buzzChar;
    this._isbn    = isbnChar;
  }

  get id()   { return this.device.id; }
  get name() { return this.device.name; }

  /** Write to buzz characteristic. durationMs: 100–25500, multiples of 100. */
  async buzz(durationMs = 500) {
    const byte = Math.max(1, Math.round(durationMs / 100));
    await this._buzz.writeValueWithoutResponse(new Uint8Array([byte]));
  }

  /** Read the stored ISBN-13 from the tag. Returns '' if unassigned. */
  async readIsbn() {
    const value = await this._isbn.readValue();
    return new TextDecoder().decode(value).trim();
  }

  /**
   * Write an ISBN-13 to the tag.
   * Firmware validates length, stores to NVS, and emits a confirm beep.
   */
  async writeIsbn(isbn) {
    if (isbn.length !== 13 || !/^\d{13}$/.test(isbn)) {
      throw new Error(`Invalid ISBN-13: ${isbn}`);
    }
    const bytes = new TextEncoder().encode(isbn);
    await this._isbn.writeValueWithResponse(bytes);
  }

  disconnect() {
    if (this.server.connected) this.server.disconnect();
  }
}
