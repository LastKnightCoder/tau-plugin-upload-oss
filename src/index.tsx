import { messages } from "./i18n";
import { form } from "./form";
import { definePlugin } from "@tau/plugins";
import { upload } from "./upload";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

export default definePlugin({
  ...__PLUGIN_META__,
  i18n: messages,
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
      context.settings.register({
        id: "upload",
        title: __PLUGIN_META__.name,
        target: "upload",
        form,
      });
    },
  }),
});
