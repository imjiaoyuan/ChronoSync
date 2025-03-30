# ChronoSync

Sync with Time's Pulse. 一个简单的 RSS 阅读器，支持文章抓取和分类管理。

## 功能特点

- 支持文章分类管理
- 文章支持时间排序和分类展示
- 每两个小时抓取一次

## 使用方法

1. Fork 本仓库

2. 修改配置文件：
   - `config/github.yml`: 设置 GitHub
   - `config/labels.yml`: 设置文章分类和抓取数量限制
   - `feed.list`: 添加你想订阅的 RSS 源

3. 启用 GitHub Actions：
   - 进入仓库的 Settings > Actions > General
   - 在 "Workflow permissions" 部分选择 "Read and write permissions"
   - 点击 "Save" 保存设置

## 注意事项

uBlock Origin 插件会拦截 cdn.bootcdn.net 域名导致页面无法正常加载，需要手动将其添加到白名单。