import { useState } from "react";
import { definePlugin, type PluginSettingsProps } from "@tau/plugins";
import { Button, Input } from "@tau/ui";
import { upload, validate } from "./upload";
import "./styles.css";
declare const __PLUGIN_META__: { id: string; name: string; version: string };
const fields: readonly (readonly [string, string, string?])[] = [
  ["accessKeyId", "Access Key ID"],
  ["accessKeySecret", "Access Key Secret", "password"],
  ["bucket", "Bucket"],
  ["region", "Region"],
  ["pathPrefix", "路径前缀（可选）"],
  ["publicBaseUrl", "公开地址前缀（可选）"],
];

function Settings({ uploadConfig, context }: PluginSettingsProps) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const value = uploadConfig?.value;
    const initial: Record<string, string> = {};
    if (value && typeof value === "object" && !Array.isArray(value))
      for (const [key, item] of Object.entries(value))
        if (typeof item === "string") initial[key] = item;
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  if (!uploadConfig) return <p>请在资源存储设置中配置。</p>;
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      validate(form);
      context.signal.throwIfAborted();
      await uploadConfig.save(form);
      if (!context.signal.aborted) setMessage("已保存并选为上传目标");
    } catch (error) {
      if (!context.signal.aborted)
        setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      if (!context.signal.aborted) setSaving(false);
    }
  };
  return (
    <div className="tau-upload-settings">
      {fields.map(([key, label, type]) => (
        <label key={key}>
          <span>{label}</span>
          <Input
            aria-label={label}
            type={type ?? "text"}
            value={form[key] ?? ""}
            autoComplete="off"
            onChange={(event) =>
              setForm((value) => ({ ...value, [key]: event.target.value }))
            }
          />
        </label>
      ))}

      <p>返回的资源地址须能公开访问；插件不会自动修改桶或仓库权限。</p>
      <Button loading={saving} onClick={() => void save()}>
        保存并使用
      </Button>
      <p role="status">{message}</p>
    </div>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.upload.register({
        id: context.pluginId,
        name: __PLUGIN_META__.name,
        upload: (file, config, signal?: AbortSignal) => upload((input, init) => {
          const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
          return context.fetch(input, {
            ...init,
            signal: AbortSignal.any([context.signal, ...(signal ? [signal] : []), ...(sourceSignal ? [sourceSignal] : [])]),
          });
        }, file, config),
      });
      context.settings.register({
        id: "upload",
        title: __PLUGIN_META__.name,
        target: "upload",
        component: Settings,
      });
    },
  }),
});
