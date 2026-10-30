import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, expect, it } from "vitest";
import { verifyOssV4 } from "../tests/verify-oss-v4";
import { upload } from "./upload";

const config = {
  accessKeyId: "test-key",
  accessKeySecret: "test-secret",
  bucket: "test-bucket",
  region: "oss-cn-chengdu",
  pathPrefix: "uploads",
};
const content = new Uint8Array([0, 255, 1, 128]);
let server: Server, endpoint: string;
let region: string;
const received: { key: string; content: Buffer; mime: string | undefined; valid: boolean }[] = [];
const destinations: string[] = [];
const fetch: typeof globalThis.fetch = (input, init) => {
  const url = new URL(String(input));
  destinations.push(url.origin);
  return globalThis.fetch(endpoint + url.pathname + url.search, init);
};

beforeEach(async () => {
  received.length = 0;
  destinations.length = 0;
  region = "cn-chengdu";
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const valid = verifyOssV4(request, config.bucket, region, config.accessKeyId, config.accessKeySecret);
    received.push({
      key: decodeURIComponent(new URL(request.url!, endpoint).pathname.slice(1)),
      content: body,
      mime: request.headers["content-type"],
      valid,
    });
    const fail = (code: string, message: string) => {
      response.writeHead(403, { "content-type": "application/xml", "x-oss-request-id": "test-request" });
      response.end(`<Error><Code>${code}</Code><Message>${message}</Message><RequestId>test-request</RequestId></Error>`);
    };
    if (request.headers.authorization?.startsWith("OSS "))
      return fail("AccessDenied", "V1 signature is forbidden.");
    if (!valid) return fail("SignatureDoesNotMatch", "Signature does not match.");
    if (request.headers["content-md5"] !== createHash("md5").update(body).digest("base64"))
      return fail("InvalidDigest", "Content MD5 does not match.");
    response.setHeader("ETag", '"test"');
    response.end();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("测试服务器未启动");
  endpoint = "http://127.0.0.1:" + address.port;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it.each([
  ["oss-cn-chengdu", "cn-chengdu", "截图 中文 #+%!'().png"],
  ["oss-cn-hangzhou", "cn-hangzhou", "a b.png"],
])("%s 使用真实浏览器SDK向仅接受V4的服务上传，签名与二进制校验通过", async (sdkRegion, signRegion, name) => {
  region = signRegion;
  const url = await upload(fetch, { name, mimeType: "image/png", content }, { ...config, region: sdkRegion });
  expect(new URL(url).hostname).toBe(`${config.bucket}.${sdkRegion}.aliyuncs.com`);
  expect(decodeURIComponent(new URL(url).pathname)).toBe(`/uploads/${name}`);
  expect(received).toEqual([{ key: `uploads/${name}`, content: Buffer.from(content), mime: "image/png", valid: true }]);
});

it("公开域名仅用于返回链接，空目录和缺省MIME仍可正确签名上传", async () => {
  const url = await upload(fetch, { name: "附件.bin", mimeType: "", content }, {
    ...config,
    pathPrefix: "",
    publicBaseUrl: "https://cdn.test/resources/",
  });
  expect(url).toBe("https://cdn.test/resources/%E9%99%84%E4%BB%B6.bin");
  expect(destinations).toEqual(["https://test-bucket.oss-cn-chengdu.aliyuncs.com"]);
  expect(received).toEqual([{ key: "附件.bin", content: Buffer.from(content), mime: "application/octet-stream", valid: true }]);
});

it("密钥错误时服务端独立验签拒绝，不返回地址或降级为V1", async () => {
  await expect(upload(fetch, { name: "a.png", mimeType: "image/png", content }, {
    ...config,
    accessKeySecret: "wrong-secret",
  })).rejects.toThrow("Signature does not match");
  expect(received).toHaveLength(1);
  expect(received[0].valid).toBe(false);
});

it("签名后MIME被改写时服务端独立验签拒绝", async () => {
  const changedFetch: typeof globalThis.fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "text/plain");
    return fetch(input, { ...init, headers });
  };
  await expect(upload(changedFetch, { name: "a.png", mimeType: "image/png", content }, config))
    .rejects.toThrow("Signature does not match");
  expect(received).toHaveLength(1);
  expect(received[0].valid).toBe(false);
});
