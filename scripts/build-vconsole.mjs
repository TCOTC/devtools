import {spawnSync} from "node:child_process";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vconsoleDir = path.join(rootDir, "vendor", "vconsole");
const distDir = path.join(vconsoleDir, "dist");
const distJs = path.join(distDir, "vconsole.min.js");
const distDts = path.join(distDir, "vconsole.min.d.ts");
const stampFile = path.join(distDir, ".devtools-build-rev");
const ifNeeded = process.argv.includes("--if-needed");

if (process.env.DEVTOOLS_BUILDING_VCONSOLE === "1") {
    console.log("已在构建 vConsole，跳过嵌套调用");
    process.exit(0);
}
process.env.DEVTOOLS_BUILDING_VCONSOLE = "1";

const run = (command, args, cwd = rootDir, capture = false) => {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: process.env,
        shell: true,
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    if (result.status !== 0) {
        if (capture && result.stderr) {
            process.stderr.write(result.stderr);
        }
        process.exit(result.status ?? 1);
    }
    return result.stdout?.trim() ?? "";
};

if (!existsSync(path.join(vconsoleDir, "package.json"))) {
    console.error("vendor/vconsole 未检出。请先执行：git submodule update --init --recursive");
    process.exit(1);
}

const revision = run("git", ["rev-parse", "HEAD"], vconsoleDir, true);
const stampMatches = existsSync(stampFile) && readFileSync(stampFile, "utf8").trim() === revision;
if (ifNeeded && existsSync(distJs) && existsSync(distDts) && stampMatches) {
    console.log(`vConsole ${revision.slice(0, 7)} 的 dist 已存在，跳过构建`);
    process.exit(0);
}

// 官方仓库按 npm 扁平 node_modules 编写，未声明 terser-webpack-plugin、部分 Babel 插件等。
// 在子模块内独立安装并 hoist，避免污染插件 workspace，同时让这些隐式依赖可被解析。
run("pnpm", [
    "--dir",
    vconsoleDir,
    "--ignore-workspace",
    "install",
    "--config.shamefully-hoist=true",
    "--config.lockfile=false",
    "--config.strict-dep-builds=false",
    "--ignore-scripts",
]);
run("pnpm", ["--dir", vconsoleDir, "--ignore-workspace", "run", "build"]);
run("pnpm", ["--dir", vconsoleDir, "--ignore-workspace", "run", "build:typings"]);
mkdirSync(distDir, {recursive: true});
writeFileSync(stampFile, `${revision}\n`);
