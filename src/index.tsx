import { definePlugin, type ProviderForm } from "@tau/plugins";
import { upload, validate } from "./upload";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

const form: ProviderForm = {
  groups: [
    {
      title: "账号",
      description: "在阿里云控制台的 AccessKey 管理中获取",
      fields: [
        { key: "accessKeyId", label: "AccessKey ID", type: "text" },
        { key: "accessKeySecret", label: "AccessKey Secret", type: "secret" },
      ],
    },
    {
      title: "存储位置",
      description: "返回的资源地址须能公开访问；插件不会修改存储桶权限",
      fields: [
        { key: "bucket", label: "Bucket", type: "text", summary: true },
        {
          key: "region",
          label: "区域",
          type: "text",
          placeholder: "oss-cn-hangzhou",
          summary: true,
        },
        { key: "pathPrefix", label: "目录", type: "text", optional: true, placeholder: "uploads" },
        {
          key: "publicBaseUrl",
          label: "公开地址前缀",
          type: "url",
          optional: true,
          description: "使用自定义域名或 CDN 时填写",
        },
      ],
    },
  ],
  beforeSave: async values => {
    validate(values);
    return values;
  },
};

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.upload.register({
        id: context.pluginId,
        name: __PLUGIN_META__.name,
        upload: (file, config, signal?: AbortSignal) =>
          upload(
            (input, init) => {
              const sourceSignal =
                init?.signal ?? (input instanceof Request ? input.signal : undefined);
              return context.fetch(input, {
                ...init,
                signal: AbortSignal.any([
                  context.signal,
                  ...(signal ? [signal] : []),
                  ...(sourceSignal ? [sourceSignal] : []),
                ]),
              });
            },
            file,
            config
          ),
      });
      context.settings.register({ id: "upload", title: __PLUGIN_META__.name, target: "upload", form });
    },
  }),
});
