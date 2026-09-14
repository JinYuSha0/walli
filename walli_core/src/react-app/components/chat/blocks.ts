import "@wallilabs/chat-blocks/theme.css";
import { registerBlock } from "@wallilabs/chat/react";
import {
  recommendedRepliesBlockDefinition,
  noticeBlockDefinition,
  confirmationCardBlockDefinition,
} from "@wallilabs/chat-blocks";

// Both the editor preview and the public chat use the same block registry.
registerBlock(recommendedRepliesBlockDefinition);
registerBlock(noticeBlockDefinition);
registerBlock(confirmationCardBlockDefinition);
