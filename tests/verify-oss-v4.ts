import { createHash, createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";

/** 按官方协议独立校验上传签名，不调用 SDK 的签名实现。 */
export function verifyOssV4(
  request: IncomingMessage,
  bucket: string,
  region: string,
  accessKeyId: string,
  secret: string,
): boolean {
  const match = /^OSS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/oss\/aliyun_v4_request,Signature=([a-f0-9]{64})$/.exec(
    request.headers.authorization ?? "",
  );
  if (!match) return false;
  const [, keyId, date, signRegion, signature] = match;
  const timestamp = request.headers["x-oss-date"];
  const url = new URL(request.url ?? "/", "http://localhost");
  if (
    keyId !== accessKeyId ||
    signRegion !== region ||
    typeof timestamp !== "string" ||
    !/^\d{8}T\d{6}Z$/.test(timestamp) ||
    !timestamp.startsWith(date) ||
    request.method !== "PUT" ||
    url.search ||
    request.headers["x-oss-content-sha256"] !== "UNSIGNED-PAYLOAD"
  ) return false;
  const encode = (value: string) =>
    encodeURIComponent(value).replace(
      /[!'()*]/g,
      char => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
    );
  const canonicalHeaders = Object.keys(request.headers)
    .filter(name => name === "content-type" || name === "content-md5" || name.startsWith("x-oss-"))
    .sort()
    .map(name => `${name}:${String(request.headers[name]).trim()}\n`)
    .join("");
  const canonical = [
    request.method,
    ["", bucket, ...decodeURIComponent(url.pathname).slice(1).split("/")].map(encode).join("/"),
    "",
    canonicalHeaders,
    "",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const scope = `${date}/${region}/oss/aliyun_v4_request`;
  const stringToSign = [
    "OSS4-HMAC-SHA256",
    timestamp,
    scope,
    createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");
  let signingKey: Buffer = Buffer.from("aliyun_v4" + secret);
  for (const value of [date, region, "oss", "aliyun_v4_request"])
    signingKey = createHmac("sha256", signingKey).update(value).digest();
  return createHmac("sha256", signingKey).update(stringToSign).digest("hex") === signature;
}
