import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import initSqlJs from "sql.js";
import worker from "../cloudflare/worker.js";

const CLIENT_ID = "craft-google-client-id";
const CLIENT_SECRET = "craft-google-client-secret";

function encodeBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function makeDatabase() {
  const accounts = new Map();
  const identities = new Map();
  return {
    accounts,
    identities,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes("FROM account_google_identities")) {
                const record = identities.get(values[0]);
                return record ? { username: record.username } : null;
              }
              if (query.includes("FROM accounts WHERE email")) {
                return [...accounts.values()].find(row => row.email === values[0]) || null;
              }
              if (query.includes("FROM accounts WHERE username")) {
                return accounts.get(values[0]) || null;
              }
              if (query.includes("FROM account_tenants")) return null;
              throw new Error(`Unexpected first query: ${query}`);
            },
            async all() {
              if (query.includes("FROM account_tenants")) return { results: [] };
              throw new Error(`Unexpected all query: ${query}`);
            },
            async run() {
              if (query.includes("INSERT OR IGNORE INTO accounts")) {
                const [username, password_salt, password_hash, email, created_at] = values;
                if (accounts.has(username) || [...accounts.values()].some(row => row.email === email)) {
                  return { meta: { changes: 0 } };
                }
                accounts.set(username, { username, password_salt, password_hash, email, created_at });
                return { meta: { changes: 1 } };
              }
              if (query.includes("INSERT INTO account_google_identities")) {
                const [google_sub, username, email, created_at] = values;
                if (identities.has(google_sub)) throw new Error("Google identity already linked.");
                identities.set(google_sub, { google_sub, username, email, created_at });
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected run query: ${query}`);
            }
          };
        }
      };
    }
  };
}

function makeEnv() {
  const values = new Map();
  return {
    DB: makeDatabase(),
    GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
    TENANTS: {
      async get(key, type) {
        const value = values.get(key);
        if (value == null) return null;
        return type === "json" ? JSON.parse(value) : value;
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    },
    values
  };
}

async function signedIdToken(privateKey, kid, claims) {
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

async function beginGoogleSignIn(env, mode = "login", headers = {}) {
  const response = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ mode })
  }), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  const authorization = new URL(result.authorization_url);
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("redirect_uri"), "https://rrobin.co.ke/api/auth/google/callback");
  assert.equal(authorization.searchParams.get("scope"), "openid email");
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  return { authorization, completionSecret: result.completion_secret };
}

test("Google OAuth creates and signs in a Craft account after validating Google's signed identity", async () => {
  const env = makeEnv();
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  jwk.kid = "test-google-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/token") {
      const body = new URLSearchParams(options.body);
      assert.equal(body.get("client_id"), CLIENT_ID);
      assert.equal(body.get("client_secret"), CLIENT_SECRET);
      assert.equal(body.get("grant_type"), "authorization_code");
      const idToken = await signedIdToken(keyPair.privateKey, jwk.kid, {
        aud: CLIENT_ID,
        iss: "https://accounts.google.com",
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        sub: "google-subject-123",
        nonce: currentNonce,
        email: "owner@example.com",
        email_verified: true
      });
      return Response.json({ id_token: idToken });
    }
    if (url.href === "https://www.googleapis.com/oauth2/v3/certs") {
      return Response.json({ keys: [jwk] }, {
        headers: { "Cache-Control": "public, max-age=3600" }
      });
    }
    throw new Error(`Unexpected Google request: ${url.href}`);
  };

  let currentNonce = "";
  try {
    const { authorization, completionSecret } = await beginGoogleSignIn(env);
    currentNonce = authorization.searchParams.get("nonce");
    const state = authorization.searchParams.get("state");
    const callback = await worker.fetch(new Request(
      `https://rrobin.co.ke/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`
    ), env);
    assert.equal(callback.status, 303);
    const callbackUrl = new URL(callback.headers.get("Location"));
    assert.equal(callbackUrl.origin, "https://rrobin.co.ke");
    const callbackParams = new URLSearchParams(callbackUrl.hash.split("?")[1]);
    const ticket = callbackParams.get("google_ticket");
    assert.ok(ticket);
    assert.equal(env.DB.accounts.size, 1);
    assert.equal(env.DB.identities.size, 1);
    const username = env.DB.identities.get("google-subject-123").username;
    assert.match(username, /^g-owner-/);
    assert.equal(env.DB.accounts.get(username).email, "owner@example.com");

    const rejectedSecret = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, completion_secret: "incorrect-secret" })
    }), env);
    assert.equal(rejectedSecret.status, 401);
    const ticketStorageKey = [...env.values.keys()].find(key => key.startsWith("google-auth-ticket:"));
    assert.ok(ticketStorageKey);

    const completed = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, completion_secret: completionSecret })
    }), env);
    const account = await completed.json();
    assert.equal(completed.status, 200);
    assert.equal(account.username, username);
    assert.equal(account.email, "owner@example.com");
    assert.equal(account.google_linked, false);
    assert.ok(account.session_token);
    assert.equal(env.values.has(ticketStorageKey), false);

    const replay = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, completion_secret: completionSecret })
    }), env);
    assert.equal(replay.status, 401);

    const { authorization: secondAuthorization, completionSecret: secondCompletionSecret } = await beginGoogleSignIn(env);
    currentNonce = secondAuthorization.searchParams.get("nonce");
    const secondCallback = await worker.fetch(new Request(
      `https://rrobin.co.ke/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(secondAuthorization.searchParams.get("state"))}`
    ), env);
    const secondUrl = new URL(secondCallback.headers.get("Location"));
    const secondTicket = new URLSearchParams(secondUrl.hash.split("?")[1]).get("google_ticket");
    const secondComplete = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: secondTicket, completion_secret: secondCompletionSecret })
    }), env);
    assert.equal((await secondComplete.json()).username, username);
    assert.equal(env.DB.accounts.size, 1);
    assert.equal(env.DB.identities.size, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google OAuth refuses to silently merge an existing Craft account by email", async () => {
  const env = makeEnv();
  env.DB.accounts.set("existing-craft-user", {
    username: "existing-craft-user",
    email: "owner@example.com"
  });
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  jwk.kid = "test-google-key-existing";
  let nonce = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.hostname === "oauth2.googleapis.com") {
      const idToken = await signedIdToken(keyPair.privateKey, jwk.kid, {
        aud: CLIENT_ID,
        iss: "accounts.google.com",
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        sub: "unlinked-google-subject",
        nonce,
        email: "owner@example.com",
        email_verified: true
      });
      return Response.json({ id_token: idToken });
    }
    if (url.href === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [jwk] });
    throw new Error(`Unexpected Google request: ${url.href}`);
  };
  try {
    const { authorization } = await beginGoogleSignIn(env);
    nonce = authorization.searchParams.get("nonce");
    const callback = await worker.fetch(new Request(
      `https://rrobin.co.ke/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(authorization.searchParams.get("state"))}`
    ), env);
    const redirect = new URL(callback.headers.get("Location"));
    const params = new URLSearchParams(redirect.hash.split("?")[1]);
    assert.equal(params.get("google_error"), "existing_account");
    assert.equal(env.DB.accounts.size, 1);
    assert.equal(env.DB.identities.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google OAuth reports missing credentials and rejects linking without a Craft session", async () => {
  const env = makeEnv();
  delete env.GOOGLE_OAUTH_CLIENT_ID;
  const unconfigured = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "login" })
  }), env);
  assert.equal(unconfigured.status, 503);

  env.GOOGLE_OAUTH_CLIENT_ID = CLIENT_ID;
  const unauthorizedLink = await worker.fetch(new Request("https://rrobin.co.ke/api/auth/google/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "link" })
  }), env);
  assert.equal(unauthorizedLink.status, 401);
});

test("Google identity migration preserves existing accounts and enforces one identity per Craft account", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(await readFile(new URL("../cloudflare/migrations/0004_accounts.sql", import.meta.url), "utf8"));
  db.exec(await readFile(new URL("../cloudflare/migrations/0016_account_recovery_email.sql", import.meta.url), "utf8"));
  db.exec(await readFile(new URL("../cloudflare/migrations/0017_google_account_identities.sql", import.meta.url), "utf8"));
  db.exec("INSERT INTO accounts (username, password_salt, password_hash, email, created_at) VALUES ('legacy-user', 'salt', 'hash', NULL, '2026-01-01')");
  assert.equal(db.exec("SELECT username FROM accounts WHERE username = 'legacy-user'")[0].values[0][0], "legacy-user");
  db.exec("INSERT INTO account_google_identities (google_sub, username, email, created_at) VALUES ('google-sub-1', 'legacy-user', 'verified@example.com', '2026-01-01')");
  assert.throws(() => db.exec("INSERT INTO account_google_identities (google_sub, username, email, created_at) VALUES ('google-sub-2', 'legacy-user', 'other@example.com', '2026-01-01')"));
  assert.throws(() => db.exec("INSERT INTO account_google_identities (google_sub, username, email, created_at) VALUES ('google-sub-1', 'another-user', 'verified@example.com', '2026-01-01')"));
  db.close();
});
