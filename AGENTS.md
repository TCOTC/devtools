# AGENTS

思源笔记插件。包管理只用 pnpm（`packageManager` 为 `pnpm@11.22.0`），不要用 npm / yarn。不要用 `pnpm dev` 验证程序，该命令只留给开发者本机手动跑。

## 克隆

`vendor/vconsole` 是 [Tencent/vConsole](https://github.com/Tencent/vConsole) 的 git 子模块，跟踪 `dev` 分支。普通 `git clone` 不会检出子模块内容，目录会是空的，随后 `pnpm install` 会失败。

```bash
git clone --recurse-submodules <本仓库 URL>
```

已经 clone、但当时没带子模块：

```bash
git submodule update --init --recursive
```

不要单独再 clone 一份 vConsole 覆盖 `vendor/vconsole`。

## 常用命令

| 命令                   | 作用                                                      |
| ---------------------- | --------------------------------------------------------- |
| `pnpm install`         | 安装依赖；vConsole 未构建或子模块 commit 变化时会自动构建 |
| `pnpm build`           | 生产构建，产出 `dist/` 与 `package.zip`                   |
| `pnpm typecheck`       | `tsc --noEmit`                                            |
| `pnpm lint`            | ESLint                                                    |
| `pnpm format`          | dprint 格式化                                             |
| `pnpm build:vconsole`  | 强制重编当前子模块里的 vConsole                           |
| `pnpm update:vconsole` | 拉取官方 `dev` 最新 commit，再强制重编                    |

`import VConsole from "vconsole"` 走 `file:vendor/vconsole`，不要改回 npm 上的 `vconsole@3.15.1`。官方 npm 仍停在 3.15.1，本仓库用的是未发版的 `3.16.0-alpha` 源码构建产物。

## vConsole 子模块

* 入口是官方构建结果 `vendor/vconsole/dist/vconsole.min.js`。仓库不提交 `dist/`，由 `scripts/build-vconsole.mjs` 按子模块 commit 按需生成。
* 不要把 `vendor/vconsole` 加进 pnpm workspace。官方构建依赖声明不完整，脚本在子模块内独立 `pnpm install`（shamefully-hoist）。
* 不要手改 `vendor/vconsole` 源码，除非明确要给上游提补丁。日常更新用 `pnpm update:vconsole`，然后把子模块指针的变更一并提交。
* 子模块未检出时，脚本会提示先执行 `git submodule update --init --recursive`。
* CI checkout 必须带 `submodules: recursive`。

## 代码约定

* 格式化用 dprint，不要改 `vendor/vconsole`。
* 新增注释：中文与英文、文本与数字之间加空格；保留中文全角标点（如 `“”`）。
* 不要删改与本次逻辑无关的原有注释。
* 不要用脚本改写文件内容；构建脚本只负责调用官方构建。
