// Clobber proxy — Cloudflare Worker
// CORS bridge between the PWA and Hertfordshire Libraries' Spydus system.
// Credentials live here in Cloudflare secrets, never in the browser.
//
// Required secrets (set via: npx wrangler secret put <NAME>):
//   SPYDUS_BASE_URL  e.g. https://herts.spydus.co.uk
//   ACCOUNTS         JSON array: [{ "name": "Alice", "cardNumber": "...", "pin": "..." }]
//
// ⚠️  VERIFY THE SPYDUS AUTH FLOW before relying on this:
//     Inspect the Spydus Library app's traffic or the OPAC login to confirm
//     the exact endpoint, POST fields, and cookie name. The implementation
//     below is based on the known Spydus API pattern — it may need adjustment.

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsPreflightResponse();

    const url = new URL(request.url);

    switch (url.pathname) {
      case '/loans':   return handleLoans(env);
      case '/health':  return new Response('ok');
      default:         return new Response('Not found', { status: 404 });
    }
  },
};

// ---------------------------------------------------------------------------

async function handleLoans(env) {
  let accounts;
  try {
    accounts = JSON.parse(env.ACCOUNTS);
  } catch {
    return corsResponse(JSON.stringify({ error: 'ACCOUNTS secret is not valid JSON' }), 500);
  }

  const results = await Promise.allSettled(
    accounts.map(account => fetchLoansForAccount(env.SPYDUS_BASE_URL, account))
  );

  const loans = [];
  const errors = [];

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      loans.push(...result.value);
    } else {
      errors.push({ account: accounts[i].name, error: result.reason?.message });
    }
  }

  const body = JSON.stringify({ loans, errors, fetchedAt: new Date().toISOString() });
  return corsResponse(body);
}

// ---------------------------------------------------------------------------

async function fetchLoansForAccount(baseUrl, { name, cardNumber, pin }) {
  // Step 1: authenticate
  // ⚠️  Confirm this endpoint and POST fields by inspecting Spydus app traffic.
  const loginRes = await fetch(`${baseUrl}/cgi-bin/spydus.exe/MSGTRN/WPAC/LOGINB`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: cardNumber, password: pin }),
    redirect: 'manual',
  });

  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Auth failed for ${name} — no session cookie returned`);
  }

  // Extract the session cookie value to forward
  const sessionCookie = setCookie.split(';')[0];

  // Step 2: fetch current loans
  // ⚠️  Verify this path against actual Spydus API docs or traffic capture.
  const loansRes = await fetch(
    `${baseUrl}/circulation/1.0/patrons/id/${cardNumber}/loans/current`,
    { headers: { Cookie: sessionCookie } }
  );

  if (!loansRes.ok) {
    throw new Error(`Loans fetch failed for ${name}: HTTP ${loansRes.status}`);
  }

  const data = await loansRes.json();

  // ⚠️  KEY RISK: confirm data.loans[*].isbn is actually ISBN-13.
  //     If it's a bib/item ID instead, add a catalogue lookup here to resolve it.
  //     The whole reconciliation depends on matching ISBN-13 on both sides.
  return (data.loans ?? []).map(loan => ({
    isbn:      loan.isbn ?? null,
    title:     loan.title ?? loan.titleStatement ?? '',
    dueDate:   loan.dueDate ?? loan.due_date ?? null,
    borrower:  name,
  }));
}

// ---------------------------------------------------------------------------

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age':       '86400',
    },
  });
}
