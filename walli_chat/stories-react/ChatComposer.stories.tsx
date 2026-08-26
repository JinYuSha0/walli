import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  WalliChatComposer,
  type WalliChatComposerProps,
  type WalliChatComposerRef,
} from "../src/react";
import { demoMenuItems, mockTranscription, mockUpload } from "../stories/ChatComposer.stories";
import { source } from "./source";
import { exampleSources } from "./code-examples";

type Args = Pick<WalliChatComposerProps, "disabled" | "placeholder" | "value">;

function ComposerDemo({
  disabled = false,
  placeholder = "Message",
  value: initialValue = "",
  ...props
}: Args & Partial<WalliChatComposerProps>) {
  const [value, setValue] = useState(initialValue);
  return (
    <div style={{ margin: "40px auto", maxWidth: 760 }}>
      <WalliChatComposer
        {...props}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onValueChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: "React/Chat Composer",
  component: WalliChatComposer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "React versions of every walli-chat-composer demo." } },
  },
  args: { disabled: false, placeholder: "Message", value: "" },
  render: (args) => (
    <ComposerDemo
      {...args}
      onSubmit={(markdown) => console.info("Submitted from React Storybook", markdown)}
    />
  ),
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const AllFeatures: Story = {
  render: (args) => (
    <ComposerStage>
      <ComposerDemo
        {...args}
        menuItems={demoMenuItems}
        onUploadImages={mockUpload}
        onTranscribe={mockTranscription}
        onSubmit={(markdown, text, assets) =>
          console.info("Submitted from React Storybook", { markdown, text, assets })
        }
      />
    </ComposerStage>
  ),
  parameters: source(exampleSources.composerAllFeatures),
};
export const WithDraft: Story = {
  args: { value: "Can you summarize this conversation?" },
  parameters: source(exampleSources.composerDraft),
};
export const Disabled: Story = {
  args: { disabled: true },
  parameters: source(exampleSources.composerDisabled),
};
export const WithTranscription: Story = {
  render: (args) => (
    <ComposerDemo
      {...args}
      transcribingText="Transcribing"
      onTranscribe={mockTranscription}
      onSubmit={(markdown) =>
        console.info("Submitted transcription from React Storybook", markdown)
      }
    />
  ),
  parameters: source(exampleSources.composerTranscription),
};
export const WithActionMenu: Story = {
  render: (args) => <ActionMenuDemo {...args} />,
  parameters: source(exampleSources.composerActionMenu),
};
export const WithAttachments: Story = {
  render: (args) => <AttachmentsDemo {...args} />,
  parameters: source(exampleSources.composerAttachments),
};

function ComposerStage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        minHeight: 380,
        padding: "210px 0 40px",
        overflow: "visible",
      }}
    >
      {children}
    </div>
  );
}

function ActionMenuDemo(args: Args) {
  const composer = useRef<WalliChatComposerRef>(null);
  const [value, setValue] = useState(args.value);
  useEffect(() => {
    const element = composer.current?.element;
    if (!element) return;
    void element.updateComplete.then(() =>
      element.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="Add"]')?.click(),
    );
  }, []);
  return (
    <ComposerStage>
      <div style={{ margin: "0 auto", maxWidth: 760 }}>
        <WalliChatComposer
          ref={composer}
          {...args}
          value={value}
          onValueChange={setValue}
          menuItems={demoMenuItems}
          onUploadImages={mockUpload}
        />
      </div>
    </ComposerStage>
  );
}

function AttachmentsDemo(args: Args) {
  const composer = useRef<WalliChatComposerRef>(null);
  const initialized = useRef(false);
  const [value, setValue] = useState(args.value);
  useEffect(() => {
    if (initialized.current) return;
    const handle = composer.current;
    if (!handle) return;
    initialized.current = true;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="100%" height="100%" rx="32" fill="url(#g)"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="42" text-anchor="middle" dominant-baseline="middle">Walli preview</text></svg>`;
    const image = new File([svg], "walli-preview.svg", { type: "image/svg+xml" });
    const spreadsheet = new File(
      ["Product,Quantity,Amount\nWalli Pro,12,2388"],
      "quarterly-report.csv",
      { type: "text/csv" },
    );
    const upload = handle.insertAssets([
      { file: image, type: "image" },
      { file: spreadsheet, type: "file" },
    ]);
    if (!upload) return;
    let progress = 0;
    const timer = window.setInterval(() => {
      progress = Math.min(100, progress + 10);
      upload.setProgress(image, progress);
      upload.setProgress(spreadsheet, Math.min(progress, 60));
      if (progress === 60)
        upload.setResult(spreadsheet, { error: new Error("Simulated upload failure") });
      if (progress === 100) {
        window.clearInterval(timer);
        upload.setResult(image, { url: URL.createObjectURL(image) });
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div style={{ margin: "40px auto", maxWidth: 760 }}>
      <WalliChatComposer ref={composer} {...args} value={value} onValueChange={setValue} />
    </div>
  );
}
