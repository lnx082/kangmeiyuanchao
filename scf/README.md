# 腾讯云部署指南（SCF + COS + 函数 URL）

把云端 API 从 Cloudflare Worker 迁移到腾讯云，原因：`*.workers.dev` 域名在国内无法稳定访问。
本方案**不需要域名**（使用云函数自带的"函数 URL"地址，国内可直连），
数据量极小（几 KB 的 JSON），基本全程免费额度内。

> ⚠️ **重要变更**：腾讯云 **API 网关已于 2025-06-30 停止服务**，2024-07-01 起不再支持新建
> "API 网关触发器"。本指南改用官方替代方案 **函数 URL（Function URL）**，
> 参考 <https://cloud.tencent.com/document/product/583/96099>。
> `scf/index.js` 同时兼容"函数 URL"与"API 网关"两种事件格式，代码无需改动。

## 本次部署记录（无敏感信息，可随时对照）

| 项目 | 值 |
| --- | --- |
| COS 存储桶 | `kmyc-data-1490480930` |
| COS 地域（控制台显示“北京”） | `ap-beijing` |
| 云函数名称 / 地域 | `kmyc-api` / 北京（须与 COS 同地域） |
| 对外访问方式 | **函数 URL**（免鉴权 + 开启 CORS） |
| 函数 URL 地址 | `https://1490480930-1axi29hdyw.ap-beijing.tencentscf.com` |
| 前端 `.env` | `VITE_API_BASE=https://1490480930-1axi29hdyw.ap-beijing.tencentscf.com` |

## 整体结构

```
前端页面 ──GET/PUT──▶ https://<函数URL地址>/api/battles
                            │
                       函数 URL（Function URL：免鉴权 + CORS）
                            │
                        云函数 SCF（本目录 index.js）
                            │
                       COS 对象存储（battles.json，唯一数据源）
```

## 〇、注册与实名（首次使用，约 5 分钟）

1. 打开 <https://cloud.tencent.com/> → 右上角**免费注册** → 微信/QQ 扫码或邮箱注册
2. 登录后点右上角**头像 → 实名认证 → 个人认证**，微信扫码 + 身份证完成认证
   （未实名无法使用 COS 与云函数；认证通常几分钟内通过）
3. 免费额度内使用**不需要充值**；若控制台提示需余额，按提示处理即可（一般不会）

## 一、准备（约 5 分钟）

1. 注册/登录腾讯云并完成**实名认证**（个人即可）
2. 控制台右上角 → 访问管理（CAM）→ **访问密钥 → API 密钥管理** → 新建密钥
   - 得到 `SecretId` 和 `SecretKey`（⚠️ 只放进云函数环境变量，**不要**写进前端代码或公开仓库）
   - 可选更安全做法：CAM 里创建“子用户”，仅授予该 COS 桶的读写权限，用子用户密钥

## 二、创建 COS 存储桶（约 3 分钟）

1. 控制台搜索进入 **对象存储 COS** → 存储桶列表 → **创建存储桶**
   - 名称：如 `kmyc-data`（全球唯一，会带 appid 后缀，如 `kmyc-data-1490480930`）
   - 地域：选离你近的，如 **北京 ap-beijing**
   - 访问权限：**私有读写**（数据只通过云函数访问，不公开）
2. 创建后记录两样东西：
   - 存储桶名称（含 appid，形如 `kmyc-data-1490480930`）
   - 地域代码（**北京 = `ap-beijing`**，不是中文）

## 三、创建云函数（约 5 分钟）

1. 控制台搜索进入 **云函数 SCF** → 函数服务 → **新建**
   - 创建方式：**从头开始**
   - 函数名称：`kmyc-api`
   - 地域：**与 COS 桶一致**（北京）
   - 运行环境：**Node.js 18**（16 亦可）
2. 代码：两种方式任选其一
   - **推荐**：函数代码 → 选择“**本地上传 zip 包**” → 上传本目录的 [kmyc-api.zip](kmyc-api.zip)
   - 或：把 [index.js](index.js) 的全部内容粘贴到在线编辑器的 `index.js` 中
   - 入口函数保持默认 `index.main_handler`
3. **环境变量**（函数配置页 → 环境变量）：
   | 变量名 | 值 |
   | --- | --- |
   | `COS_BUCKET` | `kmyc-data-1490480930`（你的桶名，含 appid） |
   | `COS_REGION` | `ap-beijing`（北京） |
   | `COS_SECRET_ID` | 第一步的 SecretId |
   | `COS_SECRET_KEY` | 第一步的 SecretKey |
   | `CORS_MODE` | （可选）`platform` 默认，函数不添加 CORS 头由平台添加；若跨域仍报错改成 `function` 让函数自己加 |
4. 执行超时时间建议改成 **10 秒**；点**完成**；若之后改过代码，点**部署**使其生效

> 状态显示“正常”即代表已部署成功，不需要再点部署（部署按钮只在改代码后需要）。

## 四、开启函数 URL（替代已下线的 API 网关，约 3 分钟）

1. 进入函数 `kmyc-api` 详情页 → 找 **函数 URL**（可能在“函数管理 / 触发管理”下的独立标签页；
   不同版本控制台位置略有差异）
2. 点击 **启用 / 添加 / 编辑**，按下表配置（字段名与控制台"新建函数 URL"一致）：
   | 配置项 | 值 | 说明 |
   | --- | --- | --- |
   | 别名/版本 | 别名：默认流量 | 默认即可 |
   | **公网访问** | **启用** | 不启用浏览器访问不了；"仅供测试"是免责声明，个人小站够用 |
   | 内网访问 | 启用/关闭皆可 | 只影响腾讯云内网调用 |
   | **CORS** | **启用** | 跨域必需 |
   | Allow-Origin | `*` | 允许所有来源 |
   | Allow-Methods | `GET, PUT, OPTIONS` | 也可填 `*` |
   | Allow-Headers | `Content-Type` | 也可填 `*` |
   | Expose-Headers | `*` | ⚠️ 不能留空，留空保存会报 `InvalidParameterValue.Cors: (Invalid ExposeHeaders: )` |
   | **Allow-Credentials** | ⚠️ **关闭（不要启用）** | `Allow-Origin: *` 与凭据同时启用会被浏览器直接拒绝；前端不带 Cookie |
   | Max-Age | `600` | 预检缓存秒数 |
   | **授权类型** | **开放** | 选 CAM 鉴权会让前端请求 401（静态页面无法做腾讯云签名） |
   | **参数兼容** | **启用** | 保持 API 网关格式的事件，正好匹配函数解析逻辑 |
3. 保存后控制台会给出函数 URL，形如 `https://<一串标识>.scf.<region>.tencentcs.com`
   （以控制台实际显示为准）
4. 若界面里有“响应模式 / 集成响应”之类的选项，**保持默认开启**即可

> 📌 看不到“函数 URL”入口或字段对不上：截图发我，我按你的控制台版本给具体点法。

## 五、验证（浏览器直接打开）

```
https://<你的函数URL>/api/battles
```

- 首次应为：`{"battles":[],"updatedAt":0,"count":0}`（COS 里还没有数据，前端启动同步时会自动推上去）
- 返回 HTML 或控制台报错页 → 检查函数 URL 是否启用、鉴权是否为免鉴权
- 返回 `{"error":"COS GET 失败: HTTP 403"}` → 密钥或环境变量有问题（见常见问题）

## 六、切换前端

1. 项目根目录 `.env` 追加一行（参考 `.env.example`）：

   ```
   VITE_API_BASE=https://<你的函数URL>
   ```

2. 重新构建/启动前端：`npm run dev`（本地预览）或 `npm run build` 后部署 dist/
   （Vite 只在启动时读取 `.env`，改完必须重启 dev server 或重新构建）
3. 打开页面 → 新增/编辑战役保存 → 应提示 **“☁️ 已保存并同步到云端”**
4. 换浏览器/无痕窗口验证数据已从云端拉取

> 首次使用：COS 里还没有数据，前端启动同步时会自动把本地数据推上去（`syncBattles` 的“远程为空→推送本地”逻辑）。

## 费用说明

- **COS**：新用户约 6 个月免费额度（50GB 标准存储 + 流量）；之后一个几 KB 的 JSON，存储费约 0.1 元/GB/月 → 几乎为 0
- **云函数 SCF**：每月免费额度（调用次数 + 资源使用量），本用途每天几次调用，远在免费额度内
- **函数 URL**：不额外计费（用的是云函数的调用额度）
- 只要不超免费额度就不扣费；即便超出，这类用量按量计费也是几分钱级别

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 浏览器打不开函数 URL | 检查函数 URL 是否**已启用**、鉴权是否为**免鉴权**；地域与函数是否一致 |
| 前端提示“云端同步失败” | F12 → Network 看 PUT 请求状态：非 2xx 时看响应 body 里的 `error` 字段 |
| 返回 `COS GET 失败: HTTP 403` | SecretId/SecretKey 填错、环境变量名写错、或子用户无该桶权限 |
| 返回 `COS GET 失败: HTTP 403` / `SignatureDoesNotMatch` | 代码已自动适配签名方法名大小写并清理环境变量首尾空格与引号；若仍失败，错误信息里的 `sha1(HttpString)` 与 COS 回显的 `StringToSign` 可直接比对：两者一致说明是 **SecretKey 填错**（重新复制粘贴），不一致说明请求头/路径有差异 |
| 返回 `COS GET 失败: HTTP 404` | 正常（首次还没有数据，函数会当作空数据返回） |
| 返回 400 `Invalid payload` | 请求体不是合法 JSON，或 `battles` 不是数组（前端正常调用不会出现） |
| 跨域报错（CORS） | ① 确认 Allow-Origin 为 `*`、方法含 `GET,PUT,OPTIONS`、**Allow-Credentials 必须关闭**；② 若报 "Access-Control-Allow-Origin contains multiple values"，把函数环境变量 `CORS_MODE` 设为 `function` 并部署 |
| 报 401 / 需要鉴权 | 函数 URL 的**授权类型**必须是"开放"，不能选 CAM 鉴权 |
| 保存函数 URL 报 `InvalidParameterValue.Cors` | CORS 各字段不允许留空：Expose-Headers 填 `*`、Allow-Headers 填 `Content-Type`（或 `*`）、Allow-Origin 填 `*` |
| 返回的是 `{"statusCode":200,...}` 原文而不是数据 | 函数 URL 的“集成响应”被关掉了，改成开启；或把该现象截图发我调整代码 |

## 原 Cloudflare Worker 何去何从

前端切换后不再请求 workers.dev。可保留（不花钱）作为备份，也可在 Cloudflare 控制台删除。
`workers/src/index.ts` 与 `scf/index.js` 接口完全一致（GET/PUT `/api/battles`），随时可互相切换。

## 参考资料

- 函数 URL 概述：<https://cloud.tencent.com/document/product/583/96099>
- 创建函数 URL：<https://cloud.tencent.com/document/product/583/100227>
- COS 免费额度：<https://cloud.tencent.com/document/product/436/6240>
- 云函数新手指引：<https://cloud.tencent.com/document/product/583/54786>
- COS 请求签名算法：<https://cloud.tencent.com/document/product/436/7778>
