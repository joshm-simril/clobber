// Clobber tag firmware — Seeed XIAO nRF52840
// Adafruit nRF52 Arduino core (bluefruit.h)
//
// UUIDs must match docs/gatt-spec.md exactly.

#include <bluefruit.h>
#include <InternalFileSystem.h>

// --- GATT UUIDs (see docs/gatt-spec.md) ---
const char* CLOBBER_SVC_UUID  = "c10bbe12-0000-0000-0000-000000000001";
const char* BUZZ_CHAR_UUID    = "c10bbe12-0000-0000-0000-000000000002";
const char* ISBN_CHAR_UUID    = "c10bbe12-0000-0000-0000-000000000003";

// --- Pin assignments ---
// D0 = P0.02 on XIAO nRF52840; adjust to your wiring.
// Drive via transistor (2N7002 / BC817) — GPIO cannot source enough current.
#define BUZZER_PIN        D0
#define BATSENSE_PIN      A0   // battery divider mid-point

// --- Timing ---
#define BUZZ_DEFAULT_MS   500
#define ADV_FAST_MS       100  // 100 ms during first 30 s
#define ADV_SLOW_MS       1000 // 1 s idle
#define ADV_FAST_TIMEOUT  30   // seconds before slowing down

// --- GATT objects ---
BLEService        clobberSvc(CLOBBER_SVC_UUID);
BLECharacteristic buzzChar(BUZZ_CHAR_UUID);
BLECharacteristic isbnChar(ISBN_CHAR_UUID);
BLEBas            battSvc;

// --- State ---
char storedIsbn[14] = "";  // 13 ASCII digits + NUL

// --- Forward declarations ---
void onBuzzWrite(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len);
void onIsbnWrite(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len);
void buzz(uint16_t ms);
void updateAdvName();
void loadIsbn();
void saveIsbn();
uint8_t readBatteryPercent();

// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // TODO: power — disable the XIAO's onboard SPI flash or it alone drains
  //       a CR2032 in weeks.  Pull P0.25 (CS) high and cut its power rail,
  //       or call flash.end() / powerDown() before any sleep.

  loadIsbn();

  Bluefruit.begin();
  Bluefruit.setTxPower(4);         // dBm; lower for coin-cell saves
  updateAdvName();

  // Standard battery service
  battSvc.begin();
  battSvc.write(readBatteryPercent());

  // Clobber service
  clobberSvc.begin();

  // Buzz characteristic — write-only, open, 1 byte
  buzzChar.setProperties(CHR_PROPS_WRITE | CHR_PROPS_WRITE_WO_RESP);
  buzzChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  buzzChar.setFixedLen(1);
  buzzChar.setWriteCallback(onBuzzWrite);
  buzzChar.begin();

  // ISBN characteristic — read + write, open, up to 13 bytes
  isbnChar.setProperties(CHR_PROPS_READ | CHR_PROPS_WRITE);
  isbnChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
  isbnChar.setMaxLen(13);
  isbnChar.setWriteCallback(onIsbnWrite);
  isbnChar.begin();
  if (strlen(storedIsbn) > 0) {
    isbnChar.write((uint8_t*)storedIsbn, 13);
  }

  // Advertising
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addService(clobberSvc);
  Bluefruit.Advertising.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(
    MS_TO_UNITS(ADV_FAST_MS, UNIT_0_625_MS),
    MS_TO_UNITS(ADV_SLOW_MS, UNIT_0_625_MS)
  );
  Bluefruit.Advertising.setFastTimeout(ADV_FAST_TIMEOUT);
  Bluefruit.Advertising.start(0);

  // Identify beep on boot so you know the tag is alive
  buzz(150);
}

void loop() {
  // Yield to SoftDevice; nRF52 SD handles sleep between events.
  // TODO: tune with sd_app_evt_wait() and SYSTEM_OFF for deeper sleep.
  waitForEvent();
}

// ---------------------------------------------------------------------------
// Callbacks

void onBuzzWrite(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
  uint16_t ms = BUZZ_DEFAULT_MS;
  if (len > 0 && data[0] > 0) ms = (uint16_t)data[0] * 100;
  buzz(ms);
}

void onIsbnWrite(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
  if (len != 13) return;  // reject anything that isn't exactly 13 bytes
  memcpy(storedIsbn, data, 13);
  storedIsbn[13] = '\0';
  saveIsbn();
  updateAdvName();
  isbnChar.write((uint8_t*)storedIsbn, 13);
  buzz(100);  // short confirm beep — tells you which tag just got assigned
}

// ---------------------------------------------------------------------------
// Helpers

void buzz(uint16_t ms) {
  // For a piezo transducer: replace with analogWriteFrequency + analogWrite.
  // For a magnetic buzzer via transistor: simple on/off is fine.
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}

void updateAdvName() {
  char name[22];
  if (strlen(storedIsbn) == 13) {
    // Last 4 digits of ISBN-13 as the suffix
    snprintf(name, sizeof(name), "CLB-%.4s", storedIsbn + 9);
  } else {
    snprintf(name, sizeof(name), "CLB-unset");
  }
  Bluefruit.setName(name);
}

uint8_t readBatteryPercent() {
  // Divider: two 1MΩ resistors → Vbat/2 on BATSENSE_PIN.
  // CR2032: 3.0 V fresh, ~2.0 V depleted.
  int raw = analogRead(BATSENSE_PIN);
  float vMid = raw * (3.3f / 1023.0f);
  float vBat = vMid * 2.0f;
  float pct = (vBat - 2.0f) / (3.0f - 2.0f) * 100.0f;
  return (uint8_t)constrain(pct, 0, 100);
}

// ---------------------------------------------------------------------------
// NVS / flash persistence

static const char* ISBN_FILE = "/isbn.txt";

void loadIsbn() {
  InternalFS.begin();
  File f = InternalFS.open(ISBN_FILE, FILE_O_READ);
  if (f && f.size() == 13) {
    f.read((uint8_t*)storedIsbn, 13);
    storedIsbn[13] = '\0';
  }
  if (f) f.close();
}

void saveIsbn() {
  InternalFS.begin();
  InternalFS.remove(ISBN_FILE);
  File f = InternalFS.open(ISBN_FILE, FILE_O_WRITE);
  if (f) {
    f.write((uint8_t*)storedIsbn, 13);
    f.close();
  }
}
