# PROOF · 目标追踪 App

AI驱动的目标追踪系统，支持手机安装为PWA。

---

## 🚀 部署步骤（10分钟上线）

### 第一步：上传到 GitHub

1. 打开 [github.com](https://github.com) 并登录
2. 点右上角 **+** → **New repository**
3. 名字填 `goal-tracker`，选 **Public**，点 **Create repository**
4. 把这个文件夹里的所有文件上传（拖拽到页面上）
5. 点 **Commit changes**

### 第二步：部署到 Vercel（免费）

1. 打开 [vercel.com](https://vercel.com) → 用 GitHub 账号登录
2. 点 **Add New Project**
3. 找到你的 `goal-tracker` 仓库，点 **Import**
4. 框架选 **Vite**（会自动检测）
5. 点 **Deploy** → 等待约1分钟

部署完成后你会得到一个链接，如：`https://goal-tracker-xxx.vercel.app`

### 第三步：手机安装为App

**iPhone (Safari)：**
1. 用 Safari 打开你的链接
2. 点底部分享按钮 □↑
3. 选「添加到主屏幕」
4. 点「添加」→ 桌面就有图标了！

**Android (Chrome)：**
1. 用 Chrome 打开链接
2. 点右上角菜单 ⋮
3. 选「添加到主屏幕」或「安装应用」

---

## 📱 功能说明

- **自定义目标**：填写名称、描述、目标分数
- **记录进展**：每次记录后AI严格评估贡献度（0-60分）
- **AI评估**：严格理性风格，给出评分、分析、建议
- **数据持久化**：存在手机本地，不会丢失
- **离线可用**：安装后无网络也能查看历史记录

---

## ⚠️ 注意

AI评估功能需要网络连接（调用 Anthropic API）。
数据存在本地 localStorage，清除浏览器缓存会丢失数据。
