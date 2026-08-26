# 本项目使用的 Pretext API

本项目只在 `src/markdown-chat.model.ts` 中使用 Pretext。它的核心作用是让聊天列表的虚拟滚动可以提前确定高度：在真正创建 DOM 之前，先计算出每条消息的高度、位置和总滚动高度。

这样 `walli-chat` 就不需要对每条消息做 DOM 测量，也不需要依赖 `getBoundingClientRect()` 来猜高度。

## `@chenglou/pretext`

### `prepareWithSegments(text, font, options?)`

把一段文本预处理成 Pretext 可以测量和排版的数据结构。

当前用途：

- 处理 fenced code block，也就是 markdown 里的 ``` 代码块。
- 处理列表 marker，比如 `•`、`1.`、checkbox 符号。

为什么需要它：

- 代码块需要按照 `pre-wrap` 规则换行，并提前算出行数。
- 列表 marker 需要知道准确宽度，才能把列表正文往右推到正确位置。

### `measureLineStats(prepared, width)`

在指定宽度下测量普通文本或预格式文本的换行结果。

当前用途：

- 给代码块计算 `lineCount` 和 `maxLineWidth`。

为什么需要它：

- 代码块高度可以提前算出来：

```ts
lineCount * CODE_LINE_HEIGHT + CODE_BLOCK_PADDING_Y * 2;
```

- 虚拟列表可以在渲染 DOM 之前知道消息高度。

### `layoutWithLines(prepared, width, lineHeight)`

把已经准备好的文本真正排成一行一行的布局结果。

当前用途：

- 渲染代码块时，拿到每一行的文本和位置。

为什么需要它：

- `measureLineStats` 解决“这个代码块多高”。
- `layoutWithLines` 解决“每一行具体画在哪里”。

### `measureNaturalWidth(prepared)`

测量一段文本在不换行情况下的自然宽度。

当前用途：

- 测量列表 marker 的宽度。

为什么需要它：

- 列表 marker 宽度会参与缩进计算。
- 这样 bullet、数字列表、checkbox 列表的正文可以稳定对齐。

### 类型：`LayoutLine`、`PreparedTextWithSegments`

这些是 Pretext 提供的 TypeScript 类型。

当前用途：

- `PreparedTextWithSegments` 存在代码块的 prepared 数据里。
- `LayoutLine` 用来描述代码块渲染时每一行的布局结果。

## `@chenglou/pretext/rich-inline`

### `prepareRichInline(items)`

把一组富文本 inline 片段预处理成 Pretext 的 rich inline flow。

当前用途：

- 段落
- 标题
- 链接
- 加粗、斜体、删除线
- inline code
- inline 图片 chip
- 其他 markdown inline 内容

为什么需要它：

- 同一行里不同片段可以有不同字体、样式、断行规则和额外宽度。
- 比如普通文字、链接、inline code 可以一起参与精确换行计算。

### `measureRichInlineStats(flow, width)`

在指定宽度下测量 rich inline flow 的换行结果。

当前用途：

- 给普通段落、标题等 inline block 计算行数和最大使用宽度。

为什么需要它：

- 消息气泡高度依赖段落换行后的总行数。
- user 消息气泡可以根据内容宽度收缩。
- assistant 消息可以占满整条 assistant lane。

### `walkRichInlineLineRanges(flow, width, callback)`

遍历 rich inline flow 在指定宽度下产生的每一行 range。

当前用途：

- 在 materialize 阶段遍历 inline block 的每一行。

为什么需要它：

- 前面测量阶段只关心高度和宽度。
- 真正渲染可见消息时，需要知道每一行包含哪些 fragment。
- 这个 API 用来把“测量结果”推进到“可渲染行”的阶段。

### `materializeRichInlineLineRange(flow, range)`

把某一行 range 转成具体可渲染的 fragment。

当前用途：

- 生成 `InlineFragmentLayout[]`，交给 `walli-message` 渲染。
- 每个 fragment 会携带 className、链接 href、图片信息、文本和前置间距。

为什么需要它：

- `walli-message` 不负责 markdown 解析，也不负责文本排版。
- 它只消费已经算好的 fragment，然后按确定的位置创建 DOM。

### 类型：`PreparedRichInline`

Pretext rich inline 的 prepared 数据类型。

当前用途：

- 存在 prepared inline block 的 `flow` 字段里。

## 整体流程

当前聊天渲染链路是：

1. `marked` 把 markdown 解析成 token。
2. 项目代码把 token 归一化成 prepared chat block。
3. Pretext 预处理普通文本、代码块和 rich inline flow。
4. `buildConversationFrame` 计算每条消息的高度、`top`、`bottom` 和总高度。
5. `findVisibleRange` 根据 `scrollTop` 和 viewport 高度找出可见消息范围。
6. `materializeMessageBlocks` 用 Pretext layout API 把可见消息转成具体可渲染的 block/line/fragment。
7. `walli-message` 根据这些 layout 数据创建 DOM。

## 总结

Pretext 在这里不是 markdown parser，也不是 UI renderer。

它主要负责两件事：

- 在不读取 DOM 的情况下，提前测量文本布局。
- 把测量结果转成稳定的行和 fragment，供 Web Component 渲染。

这就是当前虚拟滚动能提前知道 `totalHeight` 的基础。
