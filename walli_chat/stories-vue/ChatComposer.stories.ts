import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";
import { defineComponent, h, nextTick, onMounted, ref } from "vue";
import {
  WalliChatComposer,
  type WalliChatComposerExpose,
  type WalliChatComposerMenuItem,
} from "../src/vue";
import { mockTranscription, mockUpload } from "../stories/ChatComposer.stories";
import { source } from "./source";

type Args = { disabled: boolean; placeholder: string; value: string };
const menuItems: readonly WalliChatComposerMenuItem[] = [
  { icon: Paperclip, title: "Add files", onClick: () => console.info("Add files") },
  { icon: Search, title: "Search the web", onClick: () => console.info("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.info("Insert image") },
  {
    icon: FileSpreadsheet,
    title: "Insert spreadsheet",
    onClick: () => console.info("Insert spreadsheet"),
  },
];
const stage = (child: ReturnType<typeof h>) =>
  h("div", { style: { boxSizing: "border-box", minHeight: "380px", padding: "210px 0 40px" } }, [
    child,
  ]);
const wrap = (child: ReturnType<typeof h>) =>
  h("div", { style: { margin: "40px auto", maxWidth: "760px" } }, [child]);
const propsFor = (args: Args, value: ReturnType<typeof ref<string>>) => ({
  ...args,
  value: value.value,
  "onUpdate:value": (next: string) => (value.value = next),
});

const ComposerDemo = defineComponent({
  props: { disabled: Boolean, placeholder: String, value: String, features: Boolean },
  setup(props) {
    const value = ref(props.value ?? "");
    return () =>
      wrap(
        h(WalliChatComposer, {
          ...propsFor(props as Args, value),
          menuItems: props.features ? menuItems.slice(1) : [],
          onUploadImages: props.features ? mockUpload : undefined,
          onTranscribe: props.features ? mockTranscription : undefined,
          onSubmit: (markdown: string, text: string, assets: unknown[]) =>
            console.info("Submitted from Vue Storybook", { markdown, text, assets }),
        }),
      );
  },
});
const ActionMenuDemo = defineComponent({
  props: { disabled: Boolean, placeholder: String, value: String },
  setup(props) {
    const composer = ref<WalliChatComposerExpose>();
    const value = ref(props.value ?? "");
    onMounted(async () => {
      await nextTick();
      await composer.value?.element?.updateComplete;
      composer.value?.element?.shadowRoot
        ?.querySelector<HTMLButtonElement>('button[aria-label="Add"]')
        ?.click();
    });
    return () =>
      stage(
        wrap(
          h(WalliChatComposer, {
            ref: composer,
            ...propsFor(props as Args, value),
            menuItems,
          }),
        ),
      );
  },
});
const AttachmentsDemo = defineComponent({
  props: { disabled: Boolean, placeholder: String, value: String },
  setup(props) {
    const composer = ref<WalliChatComposerExpose>();
    const value = ref(props.value ?? "");
    onMounted(async () => {
      await nextTick();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" rx="32" fill="#7c3aed"/><text x="50%" y="50%" fill="white" font-size="42" text-anchor="middle">Walli preview</text></svg>`;
      const image = new File([svg], "walli-preview.svg", { type: "image/svg+xml" });
      const file = new File(
        ["Product,Quantity,Amount\nWalli Pro,12,2388"],
        "quarterly-report.csv",
        { type: "text/csv" },
      );
      const upload = composer.value?.insertAssets([
        { file: image, type: "image" },
        { file, type: "file" },
      ]);
      if (!upload) return;
      let progress = 0;
      const timer = window.setInterval(() => {
        progress = Math.min(100, progress + 10);
        upload.setProgress(image, progress);
        upload.setProgress(file, Math.min(progress, 60));
        if (progress === 60)
          upload.setResult(file, { error: new Error("Simulated upload failure") });
        if (progress === 100) {
          clearInterval(timer);
          upload.setResult(image, { url: URL.createObjectURL(image) });
        }
      }, 400);
    });
    return () => wrap(h(WalliChatComposer, { ref: composer, ...propsFor(props as Args, value) }));
  },
});

const meta = {
  title: "Vue/Chat Composer",
  component: WalliChatComposer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "Vue versions of every walli-chat-composer demo." } },
  },
  args: { disabled: false, placeholder: "Message", value: "" },
  render: (args) => ({
    components: { ComposerDemo },
    setup: () => ({ args }),
    template: `<ComposerDemo v-bind="args" />`,
  }),
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;

const allFeaturesCode = `<script setup lang="ts">
import { ref } from "vue";
import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";
import { WalliChatComposer } from "walli_chat/vue";
import "walli_chat/theme.css";

const value = ref("");
const menuItems = [
  { icon: Paperclip, title: "Add files", onClick: () => console.log("Add files") },
  { icon: Search, title: "Search the web", onClick: () => console.log("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.log("Image") },
  { icon: FileSpreadsheet, title: "Insert spreadsheet", onClick: () => console.log("Spreadsheet") },
];

async function uploadImages(files, setProgress, setResult) {
  await Promise.all(files.map((file) => new Promise((resolve) => {
    let progress = 0;
    const timer = window.setInterval(() => {
      progress = Math.min(100, progress + 10);
      setProgress(file, progress);
      if (progress === 100) {
        window.clearInterval(timer);
        setResult(file, { url: URL.createObjectURL(file) });
        resolve();
      }
    }, 180);
  })));
}

async function transcribe({ stream, finished, signal }) {
  await stream;
  const { audio } = await finished;
  await new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, 800);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
  console.log("Recorded bytes", audio.size);
  return "This is a simulated transcription returned by Storybook.";
}
</script>

<template>
  <WalliChatComposer
    v-model:value="value"
    :upload-images-title="menuItems[0].title"
    :menu-items="menuItems.slice(1)"
    :on-upload-images="uploadImages"
    :on-transcribe="transcribe"
    @submit="(markdown, text, assets) => console.log({ markdown, text, assets })"
  />
</template>`;

const draftCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChatComposer } from "walli_chat/vue";

const value = ref("Can you summarize this conversation?");
</script>

<template>
  <WalliChatComposer
    v-model:value="value"
    placeholder="Message"
    @submit="markdown => console.log(markdown)"
  />
</template>`;

const disabledCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChatComposer } from "walli_chat/vue";

const value = ref("");
</script>

<template>
  <WalliChatComposer
    v-model:value="value"
    disabled
    placeholder="Message"
  />
</template>`;

const transcriptionCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChatComposer } from "walli_chat/vue";

const value = ref("");

async function transcribe({ stream, finished, signal }) {
  await stream;
  const { audio } = await finished;
  await new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, 800);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
  console.log("Recorded bytes", audio.size);
  return "This is a simulated transcription returned by Storybook.";
}
</script>

<template>
  <WalliChatComposer
    v-model:value="value"
    transcribing-text="Transcribing"
    :on-transcribe="transcribe"
    @submit="markdown => console.log(markdown)"
  />
</template>`;

const actionMenuCode = `<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";
import { WalliChatComposer } from "walli_chat/vue";

const composer = ref();
const value = ref("");
const menuItems = [
  { icon: Paperclip, title: "Add files", onClick: () => console.log("Add files") },
  { icon: Search, title: "Search the web", onClick: () => console.log("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.log("Insert image") },
  { icon: FileSpreadsheet, title: "Insert spreadsheet", onClick: () => console.log("Insert spreadsheet") },
];

onMounted(async () => {
  await nextTick();
  await composer.value.element.updateComplete;
  composer.value.element.shadowRoot
    .querySelector('button[aria-label="Add"]')
    ?.click();
});
</script>

<template>
  <WalliChatComposer
    ref="composer"
    v-model:value="value"
    :menu-items="menuItems"
  />
</template>`;

const attachmentsCode = `<script setup lang="ts">
import { onMounted, ref } from "vue";
import { WalliChatComposer } from "walli_chat/vue";

const composer = ref();
const value = ref("");

onMounted(() => {
  const svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
    <rect width="100%" height="100%" rx="32" fill="#7c3aed" />
  </svg>\`;
  const image = new File([svg], "walli-preview.svg", { type: "image/svg+xml" });
  const spreadsheet = new File(
    ["Product,Quantity,Amount\\nWalli Pro,12,2388"],
    "quarterly-report.csv",
    { type: "text/csv" },
  );
  const upload = composer.value.insertAssets([
    { file: image, type: "image" },
    { file: spreadsheet, type: "file" },
  ]);
  let progress = 0;
  const timer = window.setInterval(() => {
    progress = Math.min(100, progress + 10);
    upload.setProgress(image, progress);
    upload.setProgress(spreadsheet, Math.min(progress, 60));
    if (progress === 60) {
      upload.setResult(spreadsheet, { error: new Error("Simulated upload failure") });
    }
    if (progress === 100) {
      window.clearInterval(timer);
      upload.setResult(image, { url: URL.createObjectURL(image) });
    }
  }, 400);
});
</script>

<template>
  <WalliChatComposer ref="composer" v-model:value="value" />
</template>`;

export const AllFeatures: Story = {
  render: (args) => ({
    components: { ComposerDemo },
    setup: () => ({ args }),
    template: `<div style="box-sizing:border-box;min-height:380px;padding:210px 0 40px"><ComposerDemo v-bind="args" features /></div>`,
  }),
  parameters: source(allFeaturesCode),
};
export const WithDraft: Story = {
  args: { value: "Can you summarize this conversation?" },
  parameters: source(draftCode),
};
export const Disabled: Story = {
  args: { disabled: true },
  parameters: source(disabledCode),
};
export const WithTranscription: Story = {
  render: (args) => ({
    components: { WalliChatComposer },
    setup() {
      const value = ref(args.value);
      return { args, mockTranscription, value };
    },
    template: `<div style="margin:40px auto;max-width:760px"><WalliChatComposer v-model:value="value" v-bind="args" transcribing-text="Transcribing" :on-transcribe="mockTranscription" @submit="markdown => console.info(markdown)" /></div>`,
  }),
  parameters: source(transcriptionCode),
};
export const WithActionMenu: Story = {
  render: (args) => ({
    components: { ActionMenuDemo },
    setup: () => ({ args }),
    template: `<ActionMenuDemo v-bind="args" />`,
  }),
  parameters: source(actionMenuCode),
};
export const WithAttachments: Story = {
  render: (args) => ({
    components: { AttachmentsDemo },
    setup: () => ({ args }),
    template: `<AttachmentsDemo v-bind="args" />`,
  }),
  parameters: source(attachmentsCode),
};
