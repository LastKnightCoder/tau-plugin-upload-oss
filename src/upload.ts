import OSS from "ali-oss";
import type { JsonValue, UploadFile } from "@tau/plugins";
import { readConfig, objectKey, publicUrl } from "./config";
import { createTransport } from "./transport";

export const validate = (value: JsonValue) =>
  readConfig(value, ["accessKeyId", "accessKeySecret", "bucket", "region"]);

export async function upload(
  fetch: typeof globalThis.fetch,
  file: UploadFile,
  value: JsonValue,
): Promise<string> {
  const config = validate(value);
  const options: OSS.Options & { urllib: ReturnType<typeof createTransport> } =
    {
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      region: config.region,
      authorizationV4: true,
      secure: true,
      urllib: createTransport(fetch),
    };
  const client = new OSS(options);
  const key = objectKey(config.pathPrefix, file.name);
  const putOptions: OSS.PutObjectOptions & { disabledMD5: boolean } = {
    disabledMD5: false,
    timeout: 5 * 60 * 1000,
    mime: file.mimeType || "application/octet-stream",
  };
  const result = await client.put(
    key,
    new Blob([new Uint8Array(file.content)]),
    putOptions,
  );
  return config.publicBaseUrl
    ? publicUrl(config.publicBaseUrl, key)
    : result.url;
}
