import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { validateMediaUrl, bearerToken, validateFirebaseClaims, deviceTier, allowance, RESERVE_DOWNLOAD_SQL, START_QUOTA_SQL, safeFilename } from "../app/lib/server-core.ts";

test("media inputs reject credentials, private hosts, IP encodings and non-HTTPS links", () => {
  for (const value of ["nope", "http://youtube.com/watch?v=x", "https://user:pass@youtube.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://2130706433/x", "https://0x7f000001/x", "https://[::1]/x", "https://api.internal/x", "https://127.0.0.1.nip.io/x", "https://youtube.com:8443/x"]) {
    assert.throws(() => validateMediaUrl(value), {status: 400}, value);
  }
  assert.equal(validateMediaUrl(" https://www.youtube.com/watch?v=abc#section "), "https://www.youtube.com/watch?v=abc");
});

test("missing and malformed Firebase tokens are rejected before any service call", () => {
  assert.throws(() => bearerToken(new Request("https://clip7.test/api/quota")), {status: 401});
  assert.throws(() => bearerToken(new Request("https://clip7.test/api/quota", {headers:{authorization:"Bearer not-a-token"}})), {status:401});
});

test("Firebase claims must match project, issuer, expiry and Google provider", () => {
  const now = 1000000;
  const valid = {sub:"u123",aud:"clip-sevan",iss:"https://securetoken.google.com/clip-sevan",iat:900,auth_time:900,exp:1100,firebase:{sign_in_provider:"google.com"}};
  assert.equal(validateFirebaseClaims(valid, now).uid, "u123");
  for (const extra of [{aud:"other-project"}, {iss:"https://example.com"}, {exp:1000}, {iat:2000}, {auth_time:2000}, {sub:""}, {firebase:{sign_in_provider:"anonymous"}}]) {
    assert.throws(() => validateFirebaseClaims({...valid,...extra}, now), {status:401});
  }
});

test("device allowances match the owner's 25 mobile / 35 desktop policy", () => {
  assert.equal(allowance(deviceTier("Mozilla Android 14 Mobile")),25);
  assert.equal(allowance(deviceTier("Mozilla iPhone")),25);
  assert.equal(allowance(deviceTier("Mozilla Windows NT 10.0 Win64")),35);
});

test("actual reservation SQL prevents overbooking, duplicate accounting and failed-attempt charges", () => {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../drizzle/",import.meta.url);
  for (const filename of readdirSync(dir).filter(x => x.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(filename,dir),"utf8"));
  db.prepare("INSERT INTO quota_windows(uid,device,allowance,generation,used) VALUES('mobile-user','mobile',25,1,0)").run();
  const reserve = db.prepare(RESERVE_DOWNLOAD_SQL);
  const insert = n => reserve.run(`record-${n}`, `key-${n}`, "youtube.com", "A real title", "format-1", "720p", 12345, "mobile-user", 1, "mobile-user", 1).changes;
  for (let n=0;n<25;n++) assert.equal(insert(n),1);
  assert.equal(insert(25),0,"a concurrent-style extra request cannot reserve the 26th credit");
  assert.equal(insert(0),0,"replaying the same idempotency key cannot consume another credit");
  db.prepare("UPDATE download_records SET status='failed' WHERE id='record-0'").run();
  assert.equal(insert(26),1,"failed pre-stream requests free their reservation");
  assert.equal(db.prepare("SELECT used,started_at FROM quota_windows WHERE uid='mobile-user'").get().used,0);
  const start = db.prepare(START_QUOTA_SQL);
  assert.equal(start.run(77777,"mobile-user",1,"record-1","mobile-user").changes,1);
  db.prepare("UPDATE download_records SET status='started' WHERE id='record-1'").run();
  assert.equal(start.run(88888,"mobile-user",1,"record-1","mobile-user").changes,0);
  const result = db.prepare("SELECT used,started_at FROM quota_windows WHERE uid='mobile-user'").get();
  assert.equal(result.used,1);
  assert.equal(result.started_at,77777,"the 48h window begins when the first stream is initiated");
  assert.equal(insert(27),0,"a started request plus reservations still occupy only the allowed capacity");
  db.close();
});

test("attachment filenames cannot inject paths or headers", () => {
  assert.equal(safeFilename("../../bad\r\nfile", "mp4").includes("/"),false);
  assert.equal(safeFilename("title", "evil\r\nx"),"title.bin");
});
