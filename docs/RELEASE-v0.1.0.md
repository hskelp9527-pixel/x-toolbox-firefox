X 三合一首个验收版：发稿安排、每日输出环、记得 @ 共用可拖动的小入口和底部抽屉。

- 成功安排 X 定时稿后自动记录，支持核对 X 已加载的安排列表。
- 本人关注页未回关高亮，名单同样标记；可关闭高亮、重置当天扫描并重新扫描。
- 头像、昵称、@用户名一起保存；单个或多选直接加入原输入框，自动补空格并保留原生撤销。
- Pixel / iPhone 尺寸对照预览已区分整屏与网页区域。

集中验证：15 项后台与手机身份测试、真实加载扩展的桌面浏览器联测、10 项预览检查均通过；Firefox 官方检查零错误零警告，Firefox 158.0.1 临时安装成功。对抗性代码复核 8.6/10。

包的用途：

- `x-toolbox-firefox-unsigned.zip`：解压后在桌面 Firefox 的 `about:debugging` 临时载入 manifest.json。
- `x-toolbox-firefox-unsigned.xpi`：同内容的未签名 XPI。安卓稳定版安装仍需 Mozilla 签名；Android 真机交互待用户验收。
- `x-toolbox-chromium.zip`：解压后在 Windows Chrome / Edge 开发者模式加载，用于桌面验收。
- `SHA256SUMS.txt`：包校验值。

安装时建议暂时停用旧三个插件，刷新 X 后验收。旧联系人可从原插件导出 JSON，再在三合一「记得 → 备份」导入；旧插件数据不会自动迁移。三合一不自动发帖、关注、取关或滚动。

源码、安装步骤与验收范围见仓库 README、docs/INSTALL.md 和 docs/ACCEPTANCE.md。
