# 仲恺产品家族整合 / Zhongkai Family

## 一个入口，三种主体验，保留沥林的独立镇域世界

整合只在导航、用户上下文与跨层说明上合流。**不将不同模型的结果合并计算**，也不会把沥林的S1–S6视为全区模型的校准参数。

主入口：family/index.html

| 用户意图 | 核心入口 | 场景 |
|---|---|---|
| 看见 | v3/index.html | 全息产业网络和主体关系，第一次进入 |
| 对撞 | v3/story-lab.html | 指定主体退出、两条模型路径比较和教学 |
| 研究 | v3/lab.html | A/B压力测试、蒙特卡洛、主体分析等 |
| 走进镇域 | lilin/index.html | 沥林“三线三桥一张图”；20主体21关系，S1–S6自由使用 |
| 企业与证据 | v3/inflow.html、trust.html、observations.html、measurement.html、verification.html | 专业工具按需进入 |
| 兼容历史 | v2/、zhongkai_simulator.html、v3/portal-classic.html | 不删除，不重写模型 |

所有这些页面仍保留原来的URL和代码结构；统一产品家族导航是一层轻量可撤回的入口。

### 事实/数据边界

- 区域模型基准：examples/world_seed_zhongkai.json，41主体71关系；采用原来的 Sim 与研究数据模型。
- 沥林独立模型：lilin/index.html，20主体21关系、六个情景和教师研究视图。**密码门槛已取消，S4均衡参照无需口令。** 来源是业主已有的单文件教师端。
- 两个数据基准之间**没有被验证的同一主体直接映射**（无完全一致的实体名）。已知沥林属于仲恺高新区，仅构成“地域包含”关系，不构成跨模型统计等式。
- 仲恺全区与沥林镇域的情景参数、风险分数、边权重、收益指标保持独立，禁止数值相加、因果外推或直接改写。
- “链主退出”是模型条件性实验，不意味着现实企业实际搬迁。
- Root model.js、hot.json、life.json 和豆包日更Skills管线完全不改；今天抓到新闻不代表模型要自动更新。
- A/B/C/D证据分级存在版本差异时必须通过标注来源和类型解释，而不是盲目合并标签。

### 跨页面探索协议

family/handoff.js 提供小型、经校验的纯输入协议：
  v、kind（exit/shock/explore/research/town）、seed、pop、tick、已在白名单内的目标主体/冲击、可选已公开主体名称与 source。

- 看见页面的公开主体可以携带名称进入下一个页面，页面只定位原有主体，不新增关系。
- 选中的受支持链主可以接续故事实验的原生 scenario URL，仍由 story-lab-core.js 校验和执行。
- 从故事实验进入专业台只预填种子/受支持的冲击名称，不自动运行；专业台的“链主外迁”与指定公司退出不等同。
- 沥林跳回仲恺携带 town 上下文和来源提示，**不携带沥林模型输出和参数**。
- 参数和情景 URL 不含私人企业材料、个人档案或密钥。不要通过分享链接传输未公开资料。
- family/worlds.json 为全区与镇域元数据台账；并非声称不同模拟模型已经科学统一。

### 部署、回滚与兼容

在发布前，运行 Node 和浏览器两层测试：

    node tests/verify.js
    node --test tests/family_integration.cjs
    python3 -m http.server 8765

在另一终端运行（需安装 Playwright Chromium）：

    node tests/family_browser.cjs

验收：从家族首页真实41/71缩略图点 TCL华星 → 全息版已选中主体 → 故事实验自动带入 TCL华星条件 → 研究工作台 → 沥林S4无需口令 → 返回仲恺并显示镇域跨尺度提示。

CI: .github/workflows/family-verify.yml 记录全部单元和浏览器测试，并上传PC/手机截图。

无需改动 Root model.js/hot.json/life.json 即可回滚：撤销 family 目录、lilin 页面及对各 HTML 插入的导航脚本即可恢复原页面。初期统一门户部署在 /family/；根目录首页仍保留旧导航，未授权覆盖正式入口时不改默认根站。
