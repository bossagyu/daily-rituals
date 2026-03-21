// supabase/functions/send-reminders/web-push.ts
// Web Push implementation using VAPID (RFC 8292) and Web Push Encryption (RFC 8291)
// Uses Deno's crypto.subtle API for all cryptographic operations.

type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

// --- Base64url helpers ---

function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padding);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function textEncode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// --- VAPID JWT (RFC 8292) ---

async function importVapidPrivateKey(
  privateKeyBase64url: string,
  publicKeyBase64url: string,
): Promise<CryptoKey> {
  // VAPID keys are raw P-256 keys.
  // privateKey is 32 bytes (scalar d), publicKey is 65 bytes (uncompressed point).
  const privateKeyBytes = base64urlDecode(privateKeyBase64url);
  const publicKeyBytes = base64urlDecode(publicKeyBase64url);

  // Extract x, y from uncompressed public key (0x04 || x || y)
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64urlEncode(x),
    y: base64urlEncode(y),
    d: base64urlEncode(privateKeyBytes),
  };

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64url: string,
  publicKeyBase64url: string,
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const TWELVE_HOURS = 12 * 60 * 60;
  const payload = {
    aud: audience,
    exp: now + TWELVE_HOURS,
    sub: subject,
  };

  const headerB64 = base64urlEncode(textEncode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(textEncode(JSON.stringify(payload)));
  const signingInput = textEncode(`${headerB64}.${payloadB64}`);

  const key = await importVapidPrivateKey(privateKeyBase64url, publicKeyBase64url);

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signingInput,
  );

  // crypto.subtle returns DER-encoded signature; VAPID JWT needs raw r||s (64 bytes)
  const signature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = base64urlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Convert a DER-encoded ECDSA signature to raw r||s format (64 bytes).
 * Some implementations return raw directly; handle both cases.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  const RAW_SIGNATURE_LENGTH = 64;
  const COMPONENT_LENGTH = 32;

  // If already raw format (64 bytes), return as-is
  if (der.length === RAW_SIGNATURE_LENGTH) {
    return der;
  }

  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  const DER_SEQUENCE_TAG = 0x30;
  const DER_INTEGER_TAG = 0x02;

  if (der[0] !== DER_SEQUENCE_TAG) {
    throw new Error('Invalid DER signature');
  }

  let offset = 2; // skip SEQUENCE tag + length

  if (der[offset] !== DER_INTEGER_TAG) {
    throw new Error('Invalid DER signature: expected INTEGER tag for r');
  }
  offset++;
  const rLen = der[offset];
  offset++;
  const rBytes = der.slice(offset, offset + rLen);
  offset += rLen;

  if (der[offset] !== DER_INTEGER_TAG) {
    throw new Error('Invalid DER signature: expected INTEGER tag for s');
  }
  offset++;
  const sLen = der[offset];
  offset++;
  const sBytes = der.slice(offset, offset + sLen);

  // Pad or trim to 32 bytes each
  const r = padOrTrimTo32(rBytes);
  const s = padOrTrimTo32(sBytes);

  return concatUint8Arrays(r, s);

  function padOrTrimTo32(component: Uint8Array): Uint8Array {
    if (component.length === COMPONENT_LENGTH) {
      return component;
    }
    if (component.length > COMPONENT_LENGTH) {
      // Leading zero padding from DER encoding
      return component.slice(component.length - COMPONENT_LENGTH);
    }
    // Pad with leading zeros
    const padded = new Uint8Array(COMPONENT_LENGTH);
    padded.set(component, COMPONENT_LENGTH - component.length);
    return padded;
  }
}

// --- Web Push Encryption (RFC 8291, aes128gcm content encoding) ---

async function hkdfDerive(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);

  // Extract
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', key, salt.length > 0 ? salt : new Uint8Array(32)));
  // Actually HKDF extract is HMAC(salt, ikm), let me fix the order
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt.length > 0 ? salt : new Uint8Array(32),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const prkCorrect = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));

  // Expand
  const prkKey = await crypto.subtle.importKey(
    'raw',
    prkCorrect,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const infoWithCounter = concatUint8Arrays(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, infoWithCounter));

  return okm.slice(0, length);
}

function createInfo(
  type: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array,
): Uint8Array {
  // "Content-Encoding: <type>\0" + "P-256\0" + client key length (2 bytes) + client key + server key length (2 bytes) + server key
  const label = textEncode(`Content-Encoding: ${type}\0`);
  const p256Label = textEncode('P-256\0');

  const clientKeyLen = new Uint8Array(2);
  clientKeyLen[0] = (clientPublicKey.length >> 8) & 0xff;
  clientKeyLen[1] = clientPublicKey.length & 0xff;

  const serverKeyLen = new Uint8Array(2);
  serverKeyLen[0] = (serverPublicKey.length >> 8) & 0xff;
  serverKeyLen[1] = serverPublicKey.length & 0xff;

  return concatUint8Arrays(
    label,
    p256Label,
    clientKeyLen,
    clientPublicKey,
    serverKeyLen,
    serverPublicKey,
  );
}

async function encryptPayload(
  payload: string,
  p256dhBase64url: string,
  authBase64url: string,
): Promise<{ body: Uint8Array; localPublicKeyBytes: Uint8Array }> {
  const SALT_LENGTH = 16;
  const KEY_LENGTH = 16;
  const NONCE_LENGTH = 12;
  const RECORD_SIZE = 4096;

  // 1. Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // 2. Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // 3. Export local public key (uncompressed)
  const localPublicKeyBuffer = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyBuffer);

  // 4. Import subscriber's p256dh public key
  const subscriberPublicKeyBytes = base64urlDecode(p256dhBase64url);
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // 5. ECDH key agreement
  const sharedSecretBuffer = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    localKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBuffer);

  // 6. Derive auth-info IKM (RFC 8291 Section 3.3)
  const authSecret = base64urlDecode(authBase64url);
  const authInfo = textEncode('Content-Encoding: auth\0');
  const ikm = await hkdfDerive(sharedSecret, authSecret, authInfo, 32);

  // 7. Derive content encryption key (CEK) and nonce
  const cekInfo = createInfo('aesgcm128', subscriberPublicKeyBytes, localPublicKeyBytes);
  const nonceInfo = createInfo('nonce', subscriberPublicKeyBytes, localPublicKeyBytes);

  const cek = await hkdfDerive(ikm, salt, cekInfo, KEY_LENGTH);
  const nonce = await hkdfDerive(ikm, salt, nonceInfo, NONCE_LENGTH);

  // 8. Pad and encrypt payload
  // aes128gcm record: payload + delimiter(0x02) + padding
  const payloadBytes = textEncode(payload);
  const paddedPayload = concatUint8Arrays(payloadBytes, new Uint8Array([2])); // 0x02 = final record delimiter

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM', length: 128 }, false, [
    'encrypt',
  ]);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    paddedPayload,
  );
  const encryptedPayload = new Uint8Array(encryptedBuffer);

  // 9. Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted data
  const recordSize = new Uint8Array(4);
  const dataView = new DataView(recordSize.buffer);
  dataView.setUint32(0, RECORD_SIZE, false);

  const idLen = new Uint8Array([localPublicKeyBytes.length]);

  const body = concatUint8Arrays(salt, recordSize, idLen, localPublicKeyBytes, encryptedPayload);

  return { body, localPublicKeyBytes };
}

// --- Main export ---

export async function sendWebPush(
  subscription: Subscription,
  payload: string,
  vapidKeys: VapidKeys,
): Promise<void> {
  const audience = new URL(subscription.endpoint).origin;

  // Create VAPID authorization
  const vapidToken = await createVapidJwt(
    audience,
    vapidKeys.subject,
    vapidKeys.privateKey,
    vapidKeys.publicKey,
  );

  // Encrypt the payload
  const encrypted = await encryptPayload(payload, subscription.p256dh, subscription.auth);

  const TTL_SECONDS = '86400';

  // Send the push message
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${vapidToken}, k=${vapidKeys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: TTL_SECONDS,
    },
    body: encrypted.body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(
      `Push failed: ${response.status} ${response.statusText}${responseBody ? ` - ${responseBody}` : ''}`,
    );
  }
}
