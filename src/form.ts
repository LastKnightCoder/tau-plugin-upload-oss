import { messages } from "./i18n";
import type { ProviderFormDeclaration } from "@tau/plugins";
import { validate } from "./upload";

export const form: ProviderFormDeclaration = {
  groups: [
    {
      title: messages.ref("account.title"),
      description: messages.ref("account.description"),
      fields: [
        { key: "accessKeyId", label: messages.ref("account.accessKey"), type: "text" },
        { key: "accessKeySecret", label: messages.ref("account.secret"), type: "secret" },
      ],
    },
    {
      title: messages.ref("location.title"),
      description: messages.ref("location.publicHint"),
      fields: [
        { key: "bucket", label: messages.ref("location.bucket"), type: "text", summary: true },
        {
          key: "region",
          label: messages.ref("location.region"),
          type: "text",
          placeholder: "oss-cn-hangzhou",
          summary: true,
        },
        {
          key: "pathPrefix",
          label: messages.ref("location.path"),
          type: "text",
          optional: true,
          placeholder: "uploads",
        },
        {
          key: "publicBaseUrl",
          label: messages.ref("location.publicBase"),
          type: "url",
          optional: true,
          description: messages.ref("location.publicBaseHint"),
        },
      ],
    },
  ],
  beforeSave: async values => {
    validate(values);
    return values;
  },
};
