# BoostEffectFontGenerator

这是一个 **STG Boost（spacetypegenerator.com/boost）本地复刻版**：UI、参数面板、3D 字形挤出与动画逻辑均来自你下载的 `STG _v.Boost.html` / `STG _v.Boost_files/*`（已迁移到本仓库）。

> 说明：你下载包里**不包含**原站的 `boost_resources/`（字体与 transparency 背景图），因此要做到“视觉完全一致”，需要你把这些资源补齐到本仓库的 `boost_resources/` 目录（见 `boost_resources/README.md`）。

## 本地预览

静态站点，需要起本地 HTTP 服务（否则部分浏览器对 `loadFont` 有限制）：

```bash
# 示例：在项目根目录
npx --yes serve .
```

浏览器打开提示的地址即可。

## GitHub Pages

1. 仓库 **Settings → Pages**：Source 选部署分支（如 `main`），文件夹选 **`/`（root）**。
2. 站点根路径为 `https://<用户名>.github.io/<仓库名>/`，本项目全部使用**相对路径**，无需改代码。

## 字体放哪里、怎么换（原版复刻路径）

- **资源目录**：`boost_resources/`
- **放置方式**：把字体文件（`.ttf`/`.otf`）与 `transparency.png` 放入 `boost_resources/`，文件名需要与原版一致
- **列表位置**：原版字体加载逻辑写死在 `js/boost/sketch_boost.js` 的 `preload()` 里（`tFont[...] = loadFont("boost_resources/xxx.ttf")`）

## 代码入口

- **页面**：`index.html`
- **样式**：`css/style.css`
- **原版脚本（本地）**：`js/boost/*`
- **外部依赖（CDN）**：p5 / opentype / jquery / jquery-ui / h264 encoder（在 `index.html` 里引入）

