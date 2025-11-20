---
"@huaguang/block-crawler": minor
---

重构：将 .env 文件位置改为 .crawler/域名/ 目录

**重大改进：**

凭据配置现在存放在 `.crawler/{域名}/.env` 中，与 `auth.json` 在同一目录。

**优势：**
- **按域名隔离**：每个站点有自己的凭据文件，互不干扰
- **更好的组织**：凭据和认证状态在同一目录，管理更方便
- **更可靠**：不需要复杂的文件查找逻辑，路径明确
- **更安全**：凭据文件自动在 `.gitignore` 中被忽略（整个 `.crawler/` 目录）

**迁移指南：**

之前的方式（项目根目录的 `.env`）：
```
project/
  .env                    # ❌ 旧位置
  .crawler/
    flyonui.com/
      auth.json
```

新的方式（按域名分组）：
```
project/
  .crawler/
    flyonui.com/
      .env               # ✅ 新位置
      auth.json
    untitledui.com/
      .env               # ✅ 新位置
      auth.json
```

**文件格式（.crawler/flyonui.com/.env）：**
```env
# FlyonUI 登录凭据
EMAIL=your-email@example.com
PASSWORD=your-password
```

**重要变更：变量名简化**
- ❌ 旧格式：`FLYONUI_EMAIL` / `FLYONUI_PASSWORD`（需要域名前缀）
- ✅ 新格式：`EMAIL` / `PASSWORD`（统一变量名）
- 因为 .env 文件已在域名目录下，无需前缀区分

**代码无需修改：**
```typescript
// API 使用方式完全不变
.auth({
  loginUrl: "https://flyonui.com/auth/login",
  redirectUrl: "https://flyonui.com/*"
})
```

框架会自动从 `.crawler/flyonui.com/.env` 读取凭据。

