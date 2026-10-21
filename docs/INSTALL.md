# 桌面验收与手机安装

## Firefox 桌面

1. 解压 `x-toolbox-firefox-unsigned.zip`。
2. 打开 `about:debugging#/runtime/this-firefox`。
3. 点击「临时载入附加组件」，选择解压后的 `manifest.json`。
4. 暂时停用旧的三个单独插件，刷新 X 页面；右侧出现「◷ 随手箱」。
5. 临时插件在 Firefox 重启后失效，重新载入即可。

## Chrome / Edge 桌面

解压 `x-toolbox-chromium.zip`，在扩展管理页开启开发者模式，选择「加载已解压的扩展程序」。它与 Firefox 包实现相同，用来方便 Windows 桌面验收。

## 安卓 Firefox

Firefox 清单包含 Android 支持声明，并通过官方检查；当前 ZIP/XPI **没有 Mozilla 签名**，不能当成安卓稳定版的一键安装包。需要用 Mozilla 开发者账号提交 AMO 自分发签名，或用 Firefox Android 调试环境临时载入后验收。

签名可按官方 [签名与分发说明](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) 操作。用 `web-ext sign` 时通过环境变量提供个人 API 凭据，不把凭据放进项目或压缩包。签名后的 XPI 再传手机安装。

安卓 Chrome、iPhone Chrome 与 X App 不能安装本扩展。原型中的 iPhone 尺寸只是排版对照。

## 验收重点

- 平时只有一个小按钮；拖动松手后不误展开，刷新后位置保留。
- 在 X 原生页面成功安排定时稿，抽屉自动新增记录；失败的提交不会记入。
- 第一次核对定时列表可能另开 X 的安排页，保留原来的输入草稿。
- 「进度」在自己的「正在关注」页扫描已加载的人，未回关显示浅红背景；他人的关注页不高亮。
- 「重置扫描」使旧扫描失效，并立即重新扫描当前已加载的名单；不自动滚动、不取关。
- 「记得」扫描后选择收藏；头像和昵称来自已加载的 X 区块。点输入框旁的小 @，再点人名或多选加入。
- 旧三个插件的数据各在自己的存储区，本插件不会自动读取它们。旧联系人可以导出 JSON 后在「记得 → 备份」导入；进度和安排可重新浏览相应页面扫描。
