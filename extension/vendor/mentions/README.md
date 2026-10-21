# 联系人模块来源

移植自 `E:/ClaudeCode/02-tools/x-mention-saver` v1.3.0，保留原 MIT 许可。

- `model.js`：原联系人模型转为普通 IIFE，导出 `globalThis.XMSModel`。
- `profile.js`：原已加载页面的昵称、用户名、官方头像提取实现。
- `../../modules/mentions-background.js`：队列写入 `mentionEntries`；完整收藏只接受扩展 `/panel.html` 来源读取。
- `../../modules/mentions-content.js`：原选中保存、独立编辑器入口、光标书签与插入逻辑，改为统一底部抽屉；不再创建联系人 iframe。

`textarea` 使用原生 `insertText` 保留撤销，与 contenteditable 同样拒绝不支持的原生插入，避免覆盖整个输入框。
