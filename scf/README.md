# 腾讯云部署指南（SCF + COS + API 网关）

把云端 API 从 Cloudflare Worker 迁移到腾讯云，原因：`*.workers.dev` 域名在国内无法稳定访问。
本方案**不需要域名**（使用 API 网关默认域名 `*.apigw.tencentcs.com`，国内可直连），
数据量极小（几 KB 的 JSON），基本全程免费额度内。

## 整体结构

```
前端页面 ──GET/PUT──▶ https://service-xxxx-xxxx.gz.apigw.tencentcs.com/api/battles
                           │
                      API 网关触发器
                           │
                      云函数 SCF（本目录 index.js）
                           │
                      COS 对象存储（battles.json，唯一数据源）
```

## 一、准备（约 5 分钟）

1. 注册/登录 [腾讯云](https://cloud.tencent.com/) 并完成**实名认证**（个人即可）
2. 控制台右上角 → 访问管理（CAM）→ **访问密钥 → API 密钥管理** → 新建密钥
   - 得到 `SecretId` 和 `SecretKey`（⚠️ 只放进云函数环境变量，**不要**写进前端代码或公开仓库）
   - 可选更安全做法：CAM 里创建"子用户"，仅授予该 COS 桶的读写权限，用子用户密钥

## 二、创建 COS 存储桶（约 3 分钟）

1. 控制台搜索进入 **对象存储 COS** → 存储桶列表 → **创建存储桶**
   - 名称：如 `kmyc-data`（全球唯一，会带 appid 后缀，如 `kmyc-data-1250000000`）
   - 地域：选离你近的，如 **广州 ap-guangzhou**（华东选 ap-shanghai）
   - 访问权限：**私有读写**（数据只通过云函数访问，不公开）
2. 创建后记录两样东西：
   - 存储桶名称（含 appid，形如 `kmyc-data-1250000000`）
   - 地域（形如 `ap-guangzhou`）

## 三、创建云函数（约 5 分钟）

1. 控制台搜索进入 **云函数 SCF** → 函数服务 → **新建**
   - 创建方式：**从头开始**
   - 函数名称：`kmyc-api`
   - 地域：与 COS 桶一致（广州）
   - 运行环境：**Node.js 18**（16 亦可）
2. 代码：把本目录 [index.js](index.js) 的全部内容粘贴到 `index.js`（入口函数保持 `main_handler`）
3. **环境变量**（函数配置页 → 环境变量）：
   | 变量名 | 值 |
   | --- | --- |
   | `COS_BUCKET` | `kmyc-data-1250000000`（你的桶名） |
   | `COS_REGION` | `ap-guangzhou` |
   | `COS_SECRET_ID` | 第一步的 SecretId |
   | `COS_SECRET_KEY` | 第一步的 SecretKey |
4. 点击**完成**，然后 **部署**

## 四、创建 API 网关触发器（约 5 分钟）

1. 云函数详情页 → **触发管理** → **创建触发器**
   - 触发方式：**API 网关触发**
   - API 服务：**新建 API 服务**（服务名随意，如 `kmyc`）
   - 路径：`/api/battles`
   - 请求方法：**ANY**
   - 鉴权方式：**免鉴权**（公开读取接口；写入也无敏感数据）
   - 是否启用 CORS：**勾选启用**（跨域必需）
2. 提交后 → 到 **API 网关控制台** → 该服务 → **发布服务**（发布到 release 环境）
3. 发布后得到访问地址：`https://service-xxxx-xxxx.gz.apigw.tencentcs.com`
   - ⚠️ 完整 API 地址 = 该域名 + `/api/battles`
   - 控制台里"API 网关 → 服务 → 前端配置"也能看到默认域名

## 五、验证（浏览器直接打开）

```
https://service-xxxx-xxxx.gz.apigw.tencentcs.com/api/battles
```

- 首次应为：`{"battles":[],"updatedAt":0,"count":0}`（COS 里还没有数据，前端启动同步时会自动推上去）
- 浏览器能打开 → 成功；打不开 → 检查地域/发布状态/路径

## 六、切换前端

1. 项目根目录创建 `.env`（参考 `.env.example`），加入：

   ```
   VITE_API_BASE=https://service-xxxx-xxxx.gz.apigw.tencentcs.com
   ```

2. 重新构建/启动前端：`npm run dev`（本地预览）或 `npm run build` 后部署 dist/
3. 打开页面 → 新增/编辑战役保存 → 应提示 **"☁️ 已保存并同步到云端"**
4. 换浏览器/无痕窗口验证数据已从云端拉取

> 首次使用：COS 里还没有数据，前端启动同步时会自动把本地数据推上去（`syncBattles` 的"远程为空→推送本地"逻辑）。

## 费用说明

- **COS**：新用户约 6 个月免费额度（50GB 标准存储 + 流量）；之后一个几 KB 的 JSON，存储费约 0.1 元/GB/月 → 几乎为 0
- **云函数 SCF**：每月免费额度（调用次数 + 资源使用量），本用途每天几次调用，远在免费额度内
- **API 网关**：有免费调用额度，同样用不完
- 只要不超免费额度就不扣费；即便超出，这类用量按量计费也是几分钱级别

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 浏览器打不开接口 | 检查 API 是否**发布**到 release 环境；地域是否一致；路径是否为 `/api/battles` |
| 前端提示"云端同步失败" | F12 → Network 看 PUT 请求状态：非 2xx 看返回的 error 字段 |
| 返回 `COS GET 失败: HTTP 403` | SecretId/SecretKey 错误，或子用户无该桶权限，或签名环境变量没配全 |
| 返回 500 `error` 带 JSON 解析错 | 触发器的请求方法没选 ANY，或路径不匹配 |
| 跨域报错 | 确认触发器勾选了"启用 CORS"（函数响应头里也已自带 CORS 头，双保险） |

## 原 Cloudflare Worker 何去何从

前端切换后不再请求 workers.dev。可保留（不花钱）作为备份，也可在 Cloudflare 控制台删除。
`workers/src/index.ts` 与 `scf/index.js` 接口完全一致（GET/PUT `/api/battles`），随时可互相切换。

## 参考资料

- COS 免费额度：<https://cloud.tencent.com/document/product/436/6240>
- 云函数新手指引：<https://cloud.tencent.com/document/product/583/54786>
- COS 请求签名算法：<https://cloud.tencent.com/document/product/436/7778>
