# QuarkPanTool

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue)](https://www.python.org/downloads/)
![GitHub Repo stars](https://img.shields.io/github/stars/lu10221/QuarkPanTool?style=social)

QuarkPanTool 是夸克网盘批量操作工具。本仓库基于 [ihmily/QuarkPanTool](https://github.com/ihmily/QuarkPanTool) 扩展，保留命令行程序，并新增连接本地 Python 服务的 Web 工作台。

## 功能

- **Web 工作台**：批量解析分享链接并转存，下载自己网盘的分享链接，浏览网盘目录、新建或删除文件夹及文件，批量重命名、创建分享链接，并查看任务记录。
- **命令行程序**：批量转存、分享、下载、切换保存目录、创建文件夹，以及通过浏览器登录。
- **外观设置**：Web 界面提供六套主题、壁纸、透明度与毛玻璃调节；设置保存在当前浏览器中。

Web 与命令行共用本机的账号 Cookie，但操作入口和支持的选项并不完全相同。Web 下载目前仅支持自己网盘的分享链接；其他分享请先转存到自己的网盘。

## 启动 Web 工作台

需要 Python 3.11 和 Node.js/npm。在终端运行：

```powershell
git clone https://github.com/lu10221/QuarkPanTool.git
cd QuarkPanTool
python -m pip install -r requirements.txt
cd web
npm ci
npm run build
cd ..
python web_app.py
```

打开 [http://127.0.0.1:8765/](http://127.0.0.1:8765/)。服务只监听本机；默认端口是 `8765`，可通过 `QUARK_PORT` 环境变量调整。修改前端代码后，需要重新运行 `npm run build` 才能更新 Python 服务展示的页面。

首次使用时，在 Web 界面的“账号设置”中粘贴夸克网盘 Cookie，先测试连通性，再保存配置。也可以按下文的命令行登录流程生成 Cookie，Web 工作台下次打开时会读取它。Web 页面目前没有“打开浏览器登录”按钮。

在“转存与下载”中粘贴真实分享链接，可在链接同一行或下一行填写四位提取码，也可直接使用 `https://pan.quark.cn/s/分享ID?pwd=1234` 格式。“填入测试链接”按钮提供的只是格式示例，不代表有效资源。

## 使用命令行

```powershell
python -m playwright install firefox
python quark.py
```

首次运行会打开 Firefox 登录窗口；完成登录后回到终端按 Enter，Cookie 将保存在 `config/cookies.txt`。也可以单独运行 `python quark_login.py` 完成登录。批量转存或批量下载时，将分享链接一行一个写入 `url.txt`，然后在菜单中选择相应操作。有提取码的链接可写为 `https://pan.quark.cn/s/分享ID?pwd=1234`。

## 本地数据与测试

- Cookie 保存在本机的 `config/cookies.txt`，命令行配置位于 `config/config.json`，浏览器登录资料位于 `web_browser_data/`；这些路径已被 Git 忽略。Cookie 是账号凭据，请勿粘贴到 Issue、提交记录或公开日志。
- 下载文件保存在 `downloads/`；Web 任务状态只保留在当前服务进程中，刷新页面也会丢失页面上的任务记录。
- 删除和批量重命名会修改真实网盘内容，请先核对选中的目录及文件。

```powershell
python -m unittest discover -s tests -q
cd web
npm run build
```

## 原版界面

下图展示原项目的命令行界面：

![原版命令行界面](./images/Snipaste_2024-09-23_19-02-03.jpg)

## 许可证

本项目遵循 [Apache-2.0 许可证](./LICENSE)。原项目作者与更多历史说明见 [ihmily/QuarkPanTool](https://github.com/ihmily/QuarkPanTool)。

**免责声明**：本工具仅供学习和研究使用，请勿用于非法目的。由使用本工具引起的任何法律责任，与本工具作者无关。
