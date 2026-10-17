# V3.17 中国企业授权调查服务（可选）

这是与 GitHub Pages 静态站分离的 **Node.js 22+** 只读 API 代理。只有完成服务商授权、设置受信任认证网关和前端显式同意后才允许联网调用。**代码中不包含可用 API Key，也未替用户注册/购买数据服务。**

## 资料来源与接口边界

- 官方商业接口示例：天眼查开放平台 [企业基本信息（含主要人员）接口 ID 365](https://open.tianyancha.com/open/365)，文档列明 `GET https://open.api.tianyancha.com/services/v4/open/baseinfoV3`，需在请求头设置服务商账户 `Authorization` token。以实际购买权限和接口文档为准；其他商业接口或参数形状不在当前实现范围。
- 代理只发送明确授权的 **企业名称**，只取名称、登记状态、注册地址、经营范围、网址与统一社会信用代码。忽略接口可能返回的手机号、法定代表人、邮箱和董监高。
- **不把注册地等于实际经营地**，不把检索记录当作仲恺招商签约证明。数据商不是第二个独立的官方来源；同一数据商不同页面不算两组独立来源。
- 默认仅浏览器查询同源 `v3/data/company-evidence.json` 中两家有溯源的示范企业；也可以使用国内搜索入口复制公开介绍，仍由用户校正。20 个合成企业测试只用于确保程序不误判，**不是 20 家真实企业验证**。

## 后端需要的环境变量（均通过部署平台的私密配置设置）

```bash
TYC_ENTERPRISE_ENDPOINT=https://open.api.tianyancha.com/services/v4/open/baseinfoV3
TYC_TOKEN=<仅服务端存储的授权令牌>
INVESTIGATION_ALLOWED_ORIGIN=https://zhanglingshare.github.io
INVESTIGATION_GATEWAY_TOKEN=<来自可信网关、至少16位的独立随机服务端密钥>
HOST=127.0.0.1
PORT=8787
```

启动：`node services/company-investigation/server.mjs`。必须部署在仅受信任的网关能够连接的内部地址，**不得把 8787 端口直接暴露公网**。服务在密钥缺失或供应商域名不匹配时返回 503，不尝试调用付费 API。供应商网址固定允许 `open.api.tianyancha.com` 的 HTTPS `/services/` 路径，用户请求不能更改目标 URL；单 IP 每分钟最多 12 次，POST JSON 2KB 上限、上游 9 秒超时、不储存历史查询或个人信息。

**反向代理必须先认证使用者及授权额度，清除任何用户提供的 `X-Internal-Investigation-Gateway` 头，再在内部请求上注入服务端安全密钥。** 后端只接受符合 `INVESTIGATION_ALLOWED_ORIGIN` 的前端浏览器请求，但 CORS/Origin 不能单独算作用户身份验证。需要在网关层限制可用用户、收费调用总额、日配额并开启独立审计（不记录敏感查询内容）。

## 前端启用（默认关闭）

只有管理员完成授权、密钥、认证网关、跨域及浏览器同意流程后，才修改 `v3/company-investigation-config.js` 的 `apiUrl` 为自己的 HTTPS 网关地址（以 `/api/company-investigate` 结尾）。**前端配置绝不能包含供应商 token 或内部网关密钥。** 浏览器仅在用户勾选“同意查询”且点击“生成调查报告”后发送公司名称。使用认证网关会话 cookie，需配置严格域、Secure、SameSite 与 CSRF/Origin 约束，避免跨站滥用。公开静态站 GitHub Pages 并不自带 Node 后端；仅合并前端代码不会部署这个代理。

## API

- `GET /api/investigation-health`：返回 `configured` 布尔量和模式，不返回密钥或企业数据。
- `POST /api/company-investigate`：`{"name":"完整公司名称","consent":true}`；必须来自可信认证网关。返回 `documents`，每条带 `companyName`、字段与独立来源元数据；返回的经营地点若无单独证明，**绝不根据工商注册地址填入**。
- 有权限限制或超额费用风险时直接返回错误，不使用免费爬虫或滥用第三方页面绕过授权。

## 模块验收

运行 `node v3/tests/company-investigation.spec.cjs`、`node v3/tests/company-investigation-server.spec.mjs`，以及需要安装 Playwright/Chrome 的 `node v3/tests/company-investigation-smoke.cjs`。所有 API 测试均使用模拟响应，不使用实际付费额度；真实接口字段、授权许可、网络可达性需要在明确授权后做独立联调与验收。
