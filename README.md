# In · I need · 三合一 Firefox 扩展

发稿安排表、每日输出环、记得 @ 共用一个可拖动的小入口。默认折叠，点击展开底部抽屉，不挤动 X 原有布局。

## 真实功能

- **发稿**：成功安排 X 定时稿后自动记录时间，小入口显示最后一条待发布定时稿的时间，支持核对已加载的 X 安排列表。时间经过只表示待核实，不擅自判定已发布。
- **进度**：原创 / 回复 / 引用每日三环；本人关注页入口显示已扫描未互关人数，未回关高亮；用户在 X 原生关注页手动操作；重置当天扫描后立即重新扫描当前页面。
- **记得 @**：扫描已加载用户的头像、昵称、@用户名并选择收藏；从输入框旁 @ 或统一入口打开后，可单个、多选直接插入原编辑器，自动补空格；支持复制、昵称复制与旧联系人导入。
- **手机操作**：小入口拖动位置记忆；顶部握把拖动调整抽屉高度，点击外侧 / 标题下滑收起。联系人“已添加 / 本页扫描”可折叠，仅通过页面扫描或导入添加，去掉手动录入。

用户数据仅本机保存；发稿、进度按账号隔离。不自动发帖、关注、取关或滚动。收藏只在扩展来源面板中展示，完整收藏不交给网页 MAIN world。本人身份识别只在内存比较会话公开数字 ID；Cookie 文本不保存、不发送。

## 安装与验收

`extension/` 是正式 Firefox 源码。`dist/x-toolbox-firefox-unsigned.zip` 与 `.xpi` 是未签名验收包；`dist/x-toolbox-chromium.zip` 可供 Windows Chrome / Edge 加载。

见 [安装说明](docs/INSTALL.md) 和 [验收记录](docs/ACCEPTANCE.md)。Firefox 桌面可在 `about:debugging` 临时加载；安卓稳定版安装还需要 Mozilla 签名。Android 真机由用户验收；iPhone 尺寸预览不代表 iPhone 扩展兼容。

## 交互预览

`index.html` 是独立模拟交互版，可以直接打开或通过静态服务器访问。支持 7 个手机尺寸、系统栏与 Firefox 工具栏占位、等比缩放和整屏 / 网页区域区分。仅预览使用模拟数据，不与正式扩展存储互通。早期悬浮小窗草图保留在 sketches/002-floating-window，当前采用底部抽屉。

## 开发

`npm ci` 后运行 `npm run check`、`npm test`、`npm run package`、`npm run test:browser`。Firefox 官方检查：`npx --yes web-ext@10.8.0 lint --source-dir build/firefox --warnings-as-errors`。工作流会执行检查并输出压缩包。

来源为用户原有三个 MIT 项目：x-schedule-board 1.2.0、x-daily-rings 0.3.1、x-mention-saver 1.3.0。模块保留许可，旧项目不受此新仓库影响。


## v0.1.3

In 寓意 I need。无定时稿时默认圆形 In 入口；关注页保留未互关人数提示和页面高亮。

移除扩展内未回关名单和所有取关入口及脚本点击。用户在 X 关注页原生操作，扩展仅观察已加载的关注关系变化。
