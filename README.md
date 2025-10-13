# DeepLink 扩展

DeepLink 是一个 Visual Studio Code 扩展，可以复制当前打开文件的路径，并生成可在 VS Code 中打开的 Markdown 深链，非常适合在个人笔记（如 Obsidian、Notion 等）中引用源代码。

## 功能

- **复制深链**：为当前文件生成包含行列信息的 Markdown 深链，点击后可直接在 VS Code 中跳转到对应位置。

  示例：
  
  `[file.yaml:12:5](vscode://file//Users/username/repo/src/config/file.yaml:12:5)`

## 使用方法

1. 在 Visual Studio Code 中打开一个文件。
2. 按 ⇧⌘P（或您的快捷键）输入 `deeplink` 运行命令。
3. 扩展会复制带有当前光标行列的 Markdown 深链到剪贴板。
4. 将深链粘贴到您的文档或应用中即可。

## 当前版本

- 0.0.4

## 项目来源

- 原始项目地址：[https://github.com/eysteinbye/vs-deeplink](https://github.com/eysteinbye/vs-deeplink)

## 依赖要求

- Visual Studio Code

## 扩展设置

- 此扩展当前没有可配置的设置。

## 已知问题

- 目前暂无已知问题。
