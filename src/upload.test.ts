import { expect, it, vi } from "vitest";
import { upload } from "./upload";
const config = {
  accessKeyId: "test-only",
  accessKeySecret: "test-only",
  bucket: "test-bucket",
  region: "oss-cn-hangzhou",
  pathPrefix: "images",
};
const file = {
  name: "a b.png",
  mimeType: "image/png",
  content: new Uint8Array([0, 255]),
};
it("实际浏览器SDK使用V4签名并经宿主传输，不写入私有ACL", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response("", { status: 200 }));
  const url = await upload(fetch, file, config);
  expect(url).toContain(
    "test-bucket.oss-cn-hangzhou.aliyuncs.com/images/a%20b.png",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  const request = fetch.mock.calls[0][1]!;
  const headers = new Headers(request.headers);
  expect(headers.get("authorization")).toMatch(
    /^OSS4-HMAC-SHA256 Credential=test-only\/\d{8}\/cn-hangzhou\/oss\/aliyun_v4_request,Signature=[a-f0-9]{64}$/,
  );
  expect(headers.get("x-oss-content-sha256")).toBe("UNSIGNED-PAYLOAD");
  expect(headers.get("content-type")).toBe("image/png");
  expect(headers.has("x-oss-object-acl")).toBe(false);
  expect(
    new Uint8Array(await new Response(request.body).arrayBuffer()),
  ).toEqual(file.content);
});
it("支持公开域名且失败不返回URL", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(""));
  await expect(
    upload(fetch, file, { ...config, publicBaseUrl: "https://cdn.test" }),
  ).resolves.toBe("https://cdn.test/images/a%20b.png");
  fetch.mockResolvedValue(
    new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 }),
  );
  await expect(upload(fetch, file, config)).rejects.toThrow();
});
