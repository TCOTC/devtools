import {
    Constants,
    fetchPost,
    getFrontend,
    Menu,
    Plugin,
    showMessage,
} from "siyuan";
import VConsole from "vconsole";
import type zhCN from "./i18n/zh-CN.json";
import "./index.scss";

/** 工作区文件 API 中的插件目录 */
const PLUGIN_DIR_API_PATH = "/data/plugins";
/** 工作区文件 API 中的插件存储目录 */
const PLUGIN_STORAGE_DIR_API_PATH = "/data/storage/petal";

/** 日志与网络记录默认上限为 1000，这里加倍 */
const VCONSOLE_MAX_ITEM_NUMBER = 2000;

let vConsoleInstance: VConsole | undefined;
/** 右下角绿色开关按钮是否可见 */
let vConsoleSwitchVisible = false;

const isMobileFrontend = () => {
    const frontend = getFrontend();
    return frontend === "mobile" || frontend === "browser-mobile";
};

const isDesktopClientFrontend = () => {
    const frontend = getFrontend();
    return frontend === "desktop" || frontend === "desktop-window";
};

const joinDataPath = (...segments: string[]): string => {
    const dataDir = window.siyuan.config.system.dataDir ?? "";
    if (!dataDir) {
        return "";
    }
    const sep = dataDir.includes("\\") ? "\\" : "/";
    return [dataDir, ...segments].join(sep);
};

const getElectron = () => {
    try {
        return window.require?.("electron");
    } catch {
        return undefined;
    }
};

const ensureWorkspaceDir = (apiPath: string): Promise<void> => {
    return new Promise((resolve) => {
        const formData = new FormData();
        formData.append("path", apiPath);
        formData.append("isDir", "true");
        fetchPost("/api/file/putFile", formData, () => resolve(), undefined, () => resolve());
    });
};

const openLocalPath = async (filePath: string, fallbackMessage: string): Promise<void> => {
    if (!filePath) {
        showMessage(fallbackMessage);
        return;
    }
    const electron = getElectron();
    if (electron?.ipcRenderer) {
        electron.ipcRenderer.send(Constants.SIYUAN_CMD, {
            cmd: "openPath",
            filePath,
        });
        return;
    }
    if (electron?.shell?.openPath) {
        const error = await electron.shell.openPath(filePath);
        if (!error) {
            return;
        }
    }
    try {
        await navigator.clipboard.writeText(filePath);
    } catch {
        // 浏览器可能拒绝剪贴板写入，路径仍会随消息展示
    }
    showMessage(`${fallbackMessage}\n${filePath}`);
};

const toggleVConsoleSwitch = () => {
    if (!vConsoleInstance) {
        const theme = window.siyuan.config.appearance.mode === 1 ? "dark" : "light";
        vConsoleInstance = new VConsole({
            theme,
            pluginOrder: ["default", "element", "network", "storage", "system"],
            disableLogScrolling: true,
            log: {maxLogNumber: VCONSOLE_MAX_ITEM_NUMBER},
            network: {maxNetworkNumber: VCONSOLE_MAX_ITEM_NUMBER},
        });
        vConsoleSwitchVisible = true;
        return;
    }
    if (vConsoleSwitchVisible) {
        vConsoleInstance.hideSwitch();
        vConsoleInstance.hide();
        vConsoleSwitchVisible = false;
        return;
    }
    vConsoleInstance.showSwitch();
    vConsoleSwitchVisible = true;
};

const destroyVConsole = () => {
    vConsoleInstance?.destroy();
    vConsoleInstance = undefined;
    vConsoleSwitchVisible = false;
};

export default class DevToolsPlugin extends Plugin {
    declare i18n: typeof zhCN;

    private isMobile = false;
    private isDesktopClient = false;

    onload() {
        this.isMobile = isMobileFrontend();
        this.isDesktopClient = isDesktopClientFrontend();
        this.registerCommands();

        console.log(this.displayName, "plugin loaded");
    }

    onLayoutReady() {
        this.registerTopBars();

        console.log(this.displayName, "plugin layout ready");
    }

    onunload() {
        destroyVConsole();

        console.log(this.displayName, "plugin unloaded");
    }

    private registerCommands() {
        this.addCommand({
            langKey: "reloadUI",
            hotkey: "",
            callback: () => {
                this.reloadUI();
            },
        });
        if (this.isDesktopClient) {
            this.addCommand({
                langKey: "openPluginDir",
                hotkey: "",
                callback: () => {
                    void this.openPluginDir();
                },
            });
            this.addCommand({
                langKey: "openPluginStorageDir",
                hotkey: "",
                callback: () => {
                    void this.openPluginStorageDir();
                },
            });
        }
        if (!this.isMobile) {
            this.addCommand({
                langKey: "toggleDevTools",
                hotkey: "",
                callback: () => {
                    this.toggleDevTools();
                },
            });
        }
        // 移动端开发者工具只在移动端注册
        if (this.isMobile) {
            this.addCommand({
                langKey: "toggleDevTools",
                hotkey: "",
                callback: () => {
                    toggleVConsoleSwitch();
                },
            });
        }
    }

    private registerTopBars() {
        if (this.isMobile) {
            this.addTopBar({
                icon: "iconRefresh",
                title: this.i18n.reloadUI,
                callback: () => {
                    this.reloadUI();
                },
            });
            // 单独一个按钮，只在移动端注册
            this.addTopBar({
                icon: "iconBug",
                title: this.i18n.toggleDevTools,
                callback: () => {
                    toggleVConsoleSwitch();
                },
            });
            return;
        }

        const topBarElement = this.addTopBar({
            icon: "iconBug",
            title: this.displayName,
            position: "right",
            callback: () => {
                this.openMenu(this.getTopBarRect(topBarElement));
            },
        });
    }

    private reloadUI() {
        fetchPost("/api/ui/reloadUI", {}, undefined, undefined, () => {
            showMessage(`${this.displayName}: ${this.i18n.reloadUIFailed}`);
        });
    }

    private async openPluginDir() {
        await ensureWorkspaceDir(PLUGIN_DIR_API_PATH);
        await openLocalPath(joinDataPath("plugins"), this.i18n.openDirFailed);
    }

    private async openPluginStorageDir() {
        await ensureWorkspaceDir(PLUGIN_STORAGE_DIR_API_PATH);
        await openLocalPath(joinDataPath("storage", "petal"), this.i18n.openDirFailed);
    }

    private toggleDevTools() {
        const electron = getElectron();
        if (!electron?.ipcRenderer) {
            showMessage(`${this.displayName}: ${this.i18n.toggleDevToolsFailed}`);
            return;
        }
        electron.ipcRenderer.send(Constants.SIYUAN_CMD, "toggleDevTools");
    }

    private getCommandHotkey(langKey: string) {
        return this.commands.find((item) => item.langKey === langKey)?.customHotkey;
    }

    private getTopBarRect(topBarElement: Element) {
        let rect = topBarElement.getBoundingClientRect();
        if (rect.width === 0) {
            rect = document.querySelector("#barMore")?.getBoundingClientRect() ?? rect;
        }
        if (rect.width === 0) {
            rect = document.querySelector("#barPlugins")?.getBoundingClientRect() ?? rect;
        }
        return rect;
    }

    private openMenu(rect: DOMRect) {
        const menu = new Menu(`${this.name}TopBar`);
        menu.addItem({
            icon: "iconRefresh",
            label: this.i18n.reloadUI,
            accelerator: this.getCommandHotkey("reloadUI"),
            click: () => {
                this.reloadUI();
            },
        });
        if (this.isDesktopClient) {
            menu.addItem({
                icon: "iconFolder",
                label: this.i18n.openPluginDir,
                accelerator: this.getCommandHotkey("openPluginDir"),
                click: () => {
                    void this.openPluginDir();
                },
            });
            menu.addItem({
                icon: "iconDatabase",
                label: this.i18n.openPluginStorageDir,
                accelerator: this.getCommandHotkey("openPluginStorageDir"),
                click: () => {
                    void this.openPluginStorageDir();
                },
            });
        }
        menu.addItem({
            icon: "iconBug",
            label: this.i18n.toggleDevTools,
            accelerator: this.getCommandHotkey("toggleDevTools"),
            click: () => {
                this.toggleDevTools();
            },
        });
        menu.open({
            x: rect.right,
            y: rect.bottom,
            isLeft: true,
        });
    }
}
