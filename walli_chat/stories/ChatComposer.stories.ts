import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";
import type {
  WalliChatComposerMenuItem,
  WalliChatComposerTranscriptionContext,
  WalliChatComposerUploadImagesCallback,
} from "../src/types";
import type { WalliChatComposerElement } from "../src/web-components/walli-chat-composer";
import "../src/web-components/walli-chat-composer";

type Args = {
  disabled: boolean;
  placeholder: string;
  value: string;
};

export const demoMenuItems: readonly WalliChatComposerMenuItem[] = [
  { icon: Paperclip, title: "Add files", onClick: () => console.info("Add files") },
  { icon: Search, title: "Search the web", onClick: () => console.info("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.info("Insert image") },
  {
    icon: FileSpreadsheet,
    title: "Insert spreadsheet",
    onClick: () => console.info("Insert spreadsheet"),
  },
];

const meta: Meta<Args> = {
  title: "Components/Chat Composer",
  excludeStories: /^[a-z]/,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "The message input used to compose and submit chat messages.",
      },
    },
  },
  args: {
    disabled: false,
    placeholder: "Message",
    value: "",
  },
  render: ({ disabled, placeholder, value }) => html`
    <div style="box-sizing:border-box;min-height:360px;padding:220px 0 60px;overflow:visible">
      <div style="margin:0 auto;max-width:760px">
        <walli-chat-composer
          .disabled=${disabled}
          .placeholder=${placeholder}
          .value=${value}
          .menuItems=${demoMenuItems.slice(1)}
          .onUploadImages=${mockUpload}
          .onTranscribe=${mockTranscription}
          .onSubmit=${(message: string) => console.info("Submitted from Storybook", message)}
        ></walli-chat-composer>
      </div>
    </div>
  `,
};

export default meta;
type Story = StoryObj<Args>;

export const AllFeatures: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The default Composer example exposes file upload, custom actions, voice transcription, and message submission.",
      },
      source: {
        code: `<walli-chat-composer placeholder="Message"></walli-chat-composer>

<script type="module">
  import "@walli/chat";
  import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";

  const composer = document.querySelector("walli-chat-composer");

  const menuItems = [
    {
      icon: Paperclip,
      title: "Add files",
      onClick: () => console.log("Add files"),
    },
    {
      icon: Search,
      title: "Search the web",
      onClick: () => console.log("Search"),
    },
    {
      icon: ImagePlus,
      title: "Insert image",
      onClick: () => console.log("Insert image"),
    },
    {
      icon: FileSpreadsheet,
      title: "Insert spreadsheet",
      onClick: () => console.log("Insert spreadsheet"),
    },
  ];
  composer.menuItems = menuItems.slice(1);

  composer.onUploadImages = async (files, setProgress, setResult) => {
    await Promise.all(files.map((file, index) =>
      new Promise((resolve) => {
        let progress = 0;
        const timer = window.setInterval(() => {
          progress = Math.min(100, progress + 10 + index * 2);
          setProgress(file, progress);

          if (progress === 100) {
            window.clearInterval(timer);
            setResult(file, { url: URL.createObjectURL(file) });
            resolve();
          }
        }, 180);
      }),
    ));

    return (removedFile) => {
      console.log("Removed uploaded file", removedFile.name);
    };
  };

  composer.onTranscribe = async ({ stream, finished, signal }) => {
    await stream;
    const { audio } = await finished;

    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(resolve, 800);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });

    console.log("Recorded audio", {
      bytes: audio.size,
      type: audio.type,
    });
    return "This is a simulated transcription.";
  };

  composer.onSubmit = (markdown, text, assets) => {
    console.log("Submitted message", {
      markdown,
      text,
      assets,
    });
  };
</script>`,
      },
    },
  },
};

export const WithDraft: Story = {
  args: { value: "Can you summarize this conversation?" },
  parameters: {
    docs: {
      source: {
        code: `<walli-chat-composer></walli-chat-composer>

<script type="module">
  document.querySelector("walli-chat-composer").value =
    "Can you summarize this conversation?";
</script>`,
      },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    docs: {
      source: {
        code: `<walli-chat-composer disabled></walli-chat-composer>`,
      },
    },
  },
};

export const WithTranscription: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A real microphone recording flow with a mocked transcription response. Allow microphone access, record, then stop or send the transcription.",
      },
      source: {
        code: `<walli-chat-composer></walli-chat-composer>

<script type="module">
  const composer = document.querySelector("walli-chat-composer");
  composer.transcribingText = "Transcribing";
  composer.onTranscribe = async ({ stream, finished, signal }) => {
    await stream;
    const { audio } = await finished;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 800);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    });
    console.log("Recorded audio", { bytes: audio.size, type: audio.type });
    return "This is a simulated transcription returned by Storybook.";
  };
</script>`,
      },
    },
  },
  render: ({ disabled, placeholder, value }) => html`
    <div style="margin:40px auto;max-width:760px">
      <walli-chat-composer
        .disabled=${disabled}
        .placeholder=${placeholder}
        .value=${value}
        .transcribingText=${"Transcribing"}
        .onTranscribe=${mockTranscription}
        .onSubmit=${(markdown: string) =>
          console.info("Submitted transcription from Storybook", markdown)}
      ></walli-chat-composer>
    </div>
  `,
};

export const WithActionMenu: Story = {
  parameters: {
    docs: {
      description: {
        story: "The extra-action menu displays all four configured menu items.",
      },
      source: {
        code: `<script type="module">
  import { Search, ImagePlus, FileSpreadsheet, Paperclip } from "lucide";

  const composer = document.querySelector("walli-chat-composer");
  composer.menuItems = [
    { icon: Paperclip, title: "Add files", onClick: () => {} },
    { icon: Search, title: "Search the web", onClick: () => {} },
    { icon: ImagePlus, title: "Insert image", onClick: () => {} },
    { icon: FileSpreadsheet, title: "Insert spreadsheet", onClick: () => {} },
  ];
</script>`,
      },
    },
  },
  render: ({ disabled, placeholder, value }) => html`
    <div style="box-sizing:border-box;min-height:380px;padding:250px 0 60px;overflow:visible">
      <div style="margin:0 auto;max-width:760px">
        <walli-chat-composer
          ${ref((element) => initializeActionMenuStory(element))}
          .disabled=${disabled}
          .placeholder=${placeholder}
          .value=${value}
          .menuItems=${demoMenuItems}
        ></walli-chat-composer>
      </div>
    </div>
  `,
};

export const WithAttachments: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Programmatically inserted image and file attachments, using the same API as the demo.",
      },
      source: {
        code: `const image = new File([svg], "walli-preview.svg", {
  type: "image/svg+xml",
});
const spreadsheet = new File([csv], "quarterly-report.csv", {
  type: "text/csv",
});

const { setProgress, setResult } = composer.insertAssets([
  { file: image, type: "image" },
  { file: spreadsheet, type: "file" },
]);

let progress = 0;
const timer = window.setInterval(() => {
  progress = Math.min(100, progress + 10);
  setProgress(image, progress);
  setProgress(spreadsheet, Math.min(progress, 60));

  if (progress === 60) {
    setResult(spreadsheet, { error: new Error("Simulated upload failure") });
  }

  if (progress === 100) {
    window.clearInterval(timer);
    setResult(image, { url: URL.createObjectURL(image) });
  }
}, 400);`,
      },
    },
  },
  render: ({ disabled, placeholder, value }) => html`
    <div style="margin:40px auto;max-width:760px">
      <walli-chat-composer
        ${ref((element) => initializeAttachmentStory(element))}
        .disabled=${disabled}
        .placeholder=${placeholder}
        .value=${value}
      ></walli-chat-composer>
    </div>
  `,
};

function initializeAttachmentStory(element: Element | undefined): void {
  if (!(element instanceof HTMLElement) || element.localName !== "walli-chat-composer") return;
  const composer = element as WalliChatComposerElement;
  if (composer.dataset.storyAssets === "ready") return;
  composer.dataset.storyAssets = "ready";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="100%" height="100%" rx="32" fill="url(#g)"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="42" text-anchor="middle" dominant-baseline="middle">Walli preview</text></svg>`;
  const image = new File([svg], "walli-preview.svg", { type: "image/svg+xml" });
  const spreadsheet = new File(
    ["Product,Quantity,Amount\nWalli Pro,12,2388"],
    "quarterly-report.csv",
    { type: "text/csv" },
  );
  const { setProgress, setResult } = composer.insertAssets([
    { file: image, type: "image" },
    { file: spreadsheet, type: "file" },
  ]);
  let progress = 0;
  const timer = window.setInterval(() => {
    if (!composer.isConnected) {
      window.clearInterval(timer);
      return;
    }
    progress = Math.min(100, progress + 10);
    setProgress(image, progress);
    setProgress(spreadsheet, Math.min(progress, 60));
    if (progress === 60) {
      setResult(spreadsheet, { error: new Error("Simulated upload failure") });
    }
    if (progress === 100) {
      window.clearInterval(timer);
      setResult(image, { url: URL.createObjectURL(image) });
    }
  }, 400);
}

function initializeActionMenuStory(element: Element | undefined): void {
  if (!(element instanceof HTMLElement) || element.localName !== "walli-chat-composer") return;
  const composer = element as WalliChatComposerElement;
  if (composer.dataset.storyMenu === "open") return;
  composer.dataset.storyMenu = "open";
  void composer.updateComplete.then(() => {
    composer.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="Add"]')?.click();
  });
}

export const mockUpload: WalliChatComposerUploadImagesCallback = async (
  files,
  setProgress,
  setResult,
) => {
  await Promise.all(
    files.map(
      (file, index) =>
        new Promise<void>((resolve) => {
          let progress = 0;
          const timer = window.setInterval(() => {
            progress = Math.min(100, progress + 10 + index * 2);
            setProgress(file, progress);
            if (progress === 100) {
              window.clearInterval(timer);
              setResult(file, { url: URL.createObjectURL(file) });
              resolve();
            }
          }, 180);
        }),
    ),
  );
};

export async function mockTranscription({
  stream,
  finished,
  signal,
}: WalliChatComposerTranscriptionContext): Promise<string> {
  await stream;
  const { audio } = await finished;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 800);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
  console.info("Recorded audio in Storybook", { bytes: audio.size, type: audio.type });
  return "This is a simulated transcription returned by Storybook.";
}
