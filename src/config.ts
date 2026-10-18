import type { JsonValue } from "@tau/plugins";

export function readConfig(value: JsonValue, required: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("上传配置无效");
  const config: Record<string, string> = {};
  for (const [key, item] of Object.entries(value))
    if (typeof item === "string") config[key] = item;
  for (const key of required)
    if (!config[key]?.trim()) throw new Error(`请填写配置项：${key}`);
  if (config.publicBaseUrl) {
    const url = new URL(config.publicBaseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash)
      throw new Error("公开地址须为不含查询参数的 HTTP(S) 地址");
  }
  return config;
}
export const objectKey = (prefix: string | undefined, name: string) =>
  [prefix?.replace(/^\/+|\/+$/g, ""), name].filter(Boolean).join("/");
export const encodedPath = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");
export const publicUrl = (base: string, key: string) =>
  base.replace(/\/+$/, "") + "/" + encodedPath(key);
