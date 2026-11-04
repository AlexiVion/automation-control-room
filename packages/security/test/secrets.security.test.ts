import {randomBytes} from "node:crypto";
import {describe,expect,it} from "vitest";
import {encryptSecret,decryptSecret,rewrapSecret,scrubLogData} from "../src/secrets.js";
describe("encryption of scoped credentials and structured logs",()=>{
  const oldKey=randomBytes(32),newKey=randomBytes(32);
  const old=encryptSecret("super-secret-token-value","ws1","credential1","key-v1",oldKey);
  const keys=(keyId:string)=>keyId==="key-v1"?oldKey:keyId==="key-v2"?newKey:undefined;
  it("encrypts with authenticated envelope and random nonce",()=>{
    expect(JSON.stringify(old)).not.toContain("super-secret-token-value");
    expect(decryptSecret(old,"ws1","credential1",keys)).toBe("super-secret-token-value");
    expect(encryptSecret("super-secret-token-value","ws1","credential1","key-v1",oldKey).nonce)
      .not.toBe(old.nonce);
  });
  it("rejects wrong workspace, credential, key or ciphertext tampering",()=>{
    expect(()=>decryptSecret(old,"ws2","credential1",keys)).toThrow();
    expect(()=>decryptSecret(old,"ws1","credential2",keys)).toThrow();
    expect(()=>decryptSecret(old,"ws1","credential1",()=>newKey)).toThrow();
    const tampered={...old,ciphertext:Buffer.from("tampered","utf8").toString("base64")};
    expect(()=>decryptSecret(tampered,"ws1","credential1",keys)).toThrow();
  });
  it("rewraps under new key version while preserving scope and plaintext",()=>{
    const rotated=rewrapSecret(old,"ws1","credential1",keys,"key-v2",newKey);
    expect(rotated.keyId).toBe("key-v2");
    expect(decryptSecret(rotated,"ws1","credential1",keys)).toBe("super-secret-token-value");
    expect(()=>decryptSecret(rotated,"ws1","credential1",()=>oldKey)).toThrow();
  });
  it("redacts key fields, authorization and bearer strings in nested logs",()=>{
    const redacted=scrubLogData({
      authorization:"Bearer super-secret-token-value",
      nested:{password:"pass123",apiKey:"sk-abcdefghijk",message:"Bearer anothersecret"},
      traceId:"req-demo"
    }) as any;
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.nested.password).toBe("[REDACTED]");
    expect(redacted.nested.apiKey).toBe("[REDACTED]");
    expect(redacted.nested.message).toBe("Bearer [REDACTED]");
    expect(redacted.traceId).toBe("req-demo");
  });
});
