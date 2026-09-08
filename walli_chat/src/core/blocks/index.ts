import { assistantBlockDefinition } from "./assistant-block";
import { registerBlock } from "../block-registry";
import { assetsGroupBlockDefinition } from "./assets-group-block";
import { codeBlockDefinition } from "./code-block";
import { customBlockDefinition } from "./custom-block";
import { editBlockDefinition } from "./edit-block";
import { imageBlockDefinition } from "./image-block";
import { inlineBlockDefinition } from "./inline-block";
import { loadingBlockDefinition } from "./loading-block";
import { ruleBlockDefinition } from "./rule-block";
import {
  errorBlockDefinition,
  reasoningBlockDefinition,
  startBlockDefinition,
  toolCallBlockDefinition,
} from "./stream-block";
import { systemBlockDefinition } from "./system-block";
import { tableBlockDefinition } from "./table-block";

registerBlock(assistantBlockDefinition);
registerBlock(assetsGroupBlockDefinition);
registerBlock(codeBlockDefinition);
registerBlock(customBlockDefinition);
registerBlock(editBlockDefinition);
registerBlock(imageBlockDefinition);
registerBlock(inlineBlockDefinition);
registerBlock(systemBlockDefinition);
registerBlock(ruleBlockDefinition);
registerBlock(tableBlockDefinition);
registerBlock(loadingBlockDefinition);
registerBlock(startBlockDefinition);
registerBlock(reasoningBlockDefinition);
registerBlock(errorBlockDefinition);
registerBlock(toolCallBlockDefinition);

export { assetsGroupBlockDefinition };
export { codeBlockDefinition };
export { customBlockDefinition };
export { createEditBlockMarkdown, editBlockDefinition } from "./edit-block";
export { imageBlockDefinition };
export { inlineBlockDefinition };
export { loadingBlockDefinition };
export { ruleBlockDefinition };
export { tableBlockDefinition };
export { startBlockDefinition };
export { reasoningBlockDefinition };
export { errorBlockDefinition };
export { toolCallBlockDefinition };
export { createSystemMessage, systemBlockDefinition } from "./system-block";

export {
  assistantBlockDefinition,
  createAssistantBlockDefinition,
  type AssistantBlockMeta,
} from "./assistant-block";
