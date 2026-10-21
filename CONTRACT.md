# 三合一模块合同

源码在 extension/。主 Agent 写 core.js、background.js、panel.html/js/css、清单和测试；子 Agent 只写自己负责的 vendor/<模块>/ 和 modules/<模块>-*.js。

## 内容层

core.js 在三个模块之前加载，提供 globalThis.XTB：

- `register(name, { snapshot(), act(action, payload) })` 注册引擎。
- `changed()` 由引擎更新后调用，通知 UI 重新读取。不通过 MAIN 发送数据。
- `open(tab, context={})` 打开扩展来源 iframe；tab 是 schedule/progress/mentions。
- `close()` 收起。
- `account()` 返回 XSBIdentity.current()。

snapshot 是本模块缓存快照，不能在轮询时增加 X 请求。act 返回可 await 的操作结果。UI 通过后台中转到内容层调用。

模块后台注册到 `globalThis.XTBBackends[name] = { handle(message, sender) }`。内容层向后台发送 `{channel:'xtb-module',module:name,...message}`，由主路由验证 X 顶层内容来源，再调用 backend.handle。注意 handle 必须自行按模块允许的操作区分内容层和扩展 UI 权限；不要把收藏 list 发回网页内容层。

## 发稿 schedule

复用原 identity/model/hook，MAIN 清单加载 identity/hook；后台串行写入 key `scheduleEntries/scheduleScans/scheduleClocks` 等避免冲突。快照 `{account,entries,scan,status,error}`；entry 沿用原模型。act 支持 refresh（quiet/interactive）、read，返回 `{ok,status?}`。真实网络成功后自动记录；时间经过不等于已发。

## 进度 progress

复用原 model/state/hook。快照 `{account,goals,day,following,scanPaused,scanEpoch,followLimitUntil,followCooldownMin,status,highlight}`；day 是当天统计，following 沿用原状态 map。act 支持 read/reset-scan（重置并立即重新扫描当前加载页，epoch 防旧批次）、toggle-highlight、settings（目标与冷却分钟）、open-following（可由 core 导航）。后台 key `progressAccounts` 等避免冲突。未回关在本人 following 页高亮、名单也高亮；关掉开关可去色，不操作关注关系。

## 联系人 mentions

复用原 model/profile 和插入光标逻辑。UI 不使用原 popup，统一到 panel.html，扩展来源判断需适配。后台键 `mentionEntries`。backend.handle 接受原 list/save/remove/import/enrich/scan/insert，list 只接受扩展 UI。后台可向同 tab 顶层发送原 `xms-scan-profiles` / `xms-insert-mentions`；内容层保留随机 composerToken 校验。

引擎快照只含 `{canInsert,composerToken,status}`，不能把完整收藏放网页。act 可支持 scan 返回已加载页面候选、prepare（根据最近输入框建立上下文）。原来额外的 @ 下拉 UI 改为 `XTB.open('mentions')`；保留选中 @ 保存小按钮、输入框旁紧凑 @ 入口。

后台主路由只允许 `/panel.html` 的扩展 iframe 在已登记 tab/token 上执行 UI 操作。panel 通过该路由调用 backend 读取收藏和处理联系人修改，或调用内容引擎动作。只有 UI 选中的 handle 可以写入 X 编辑器。
