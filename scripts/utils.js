/**
 * utils.js - 构建系统工具函数
 * 提供 HTML 转义、交叉引用、路径辅助、公共 HTML 片段等功能
 */
const fs = require('fs');
const path = require('path');

// ============================================================
// 路径常量
// ============================================================
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = ROOT;

// ============================================================
// 数据加载
// ============================================================
function loadData() {
  return {
    siteConfig: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-config.json'), 'utf-8')),
    characters: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'characters.json'), 'utf-8')),
    chapters: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chapters.json'), 'utf-8')),
    locations: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'locations.json'), 'utf-8')),
    artifacts: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'artifacts.json'), 'utf-8')),
    quotes: JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'quotes.json'), 'utf-8')),
  };
}

// ============================================================
// 查找映射（id -> 对象）
// ============================================================
function buildLookup(data) {
  const lookup = {};
  for (const key of ['characters', 'chapters', 'locations', 'artifacts', 'quotes']) {
    for (const item of data[key]) {
      lookup[item.id] = { ...item, _type: key };
    }
  }
  return lookup;
}

// ============================================================
// 类型/路径映射
// ============================================================
const TYPE_DIR = {
  characters: 'characters',
  chapters: 'chapters',
  locations: 'locations',
  artifacts: 'artifacts',
  quotes: 'quotes',
};

const TYPE_LABEL = {
  characters: '人物',
  chapters: '章节',
  locations: '地点',
  artifacts: '法宝',
  quotes: '台词',
};

const TYPE_ICON = {
  characters: 'character',
  chapters: 'chapter',
  locations: 'location',
  artifacts: 'artifact',
  quotes: 'quote',
};

// 根据id查找实体类型
function getTypeById(id, lookup) {
  const item = lookup[id];
  return item ? item._type : null;
}

// 根据id获取名称
function getNameById(id, lookup) {
  const item = lookup[id];
  if (!item) return id;
  return item.name || item.title || item.text || id;
}

// ============================================================
// HTML 转义
// ============================================================
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// 交叉引用构建
// ============================================================
function buildCrossReferences(data) {
  const lookup = buildLookup(data);
  const refs = {}; // id -> Set of referencing ids

  function addRef(targetId, sourceId) {
    if (!targetId || !sourceId || targetId === sourceId) return;
    if (!refs[targetId]) refs[targetId] = new Set();
    refs[targetId].add(sourceId);
  }

  // 人物关系引用
  for (const char of data.characters) {
    if (char.relationships) {
      for (const rel of char.relationships) {
        addRef(rel.target, char.id);
      }
    }
    if (char.weapon) addRef(char.weapon, char.id);
    if (char.dwelling) addRef(char.dwelling, char.id);
    if (char.master && lookup[char.master]) addRef(char.master, char.id);
  }

  // 地点引用
  for (const loc of data.locations) {
    if (loc.residents) loc.residents.forEach(id => addRef(id, loc.id));
    if (loc.visitors) loc.visitors.forEach(id => addRef(id, loc.id));
    if (loc.related_locations) loc.related_locations.forEach(r => addRef(r.id, loc.id));
  }

  // 法宝引用
  for (const art of data.artifacts) {
    if (art.owner) addRef(art.owner, art.id);
  }

  // 台词引用
  for (const q of data.quotes) {
    if (q.speaker) addRef(q.speaker, q.id);
    if (q.related_characters) q.related_characters.forEach(id => addRef(id, q.id));
  }

  // 章节引用
  for (const ch of data.chapters) {
    if (ch.characters) ch.characters.forEach(id => addRef(id, ch.id));
    if (ch.locations) ch.locations.forEach(id => addRef(id, ch.id));
    if (ch.artifacts) ch.artifacts.forEach(id => addRef(id, ch.id));
    if (ch.quotes) ch.quotes.forEach(id => addRef(id, ch.id));
  }

  // 转换为数组并更新 reference_count
  for (const id of Object.keys(lookup)) {
    const refSet = refs[id] || new Set();
    lookup[id].reference_count = refSet.size;
    lookup[id].references = Array.from(refSet);
  }

  return lookup;
}

// ============================================================
// CSS / JS 引用生成
// ============================================================
function cssLink(base, file) {
  return `<link rel="stylesheet" href="${base}assets/css/${file}">`;
}

function jsScript(base, file, defer = true) {
  return `<script ${defer ? 'defer' : ''} src="${base}assets/js/${file}"></script>`;
}

// 根据页面类型返回所需 CSS
function getCSS(base, pageType) {
  const common = [
    cssLink(base, 'variables.css'),
    cssLink(base, 'reset.css'),
    cssLink(base, 'base.css'),
    cssLink(base, 'components.css'),
    cssLink(base, 'layout.css'),
    cssLink(base, 'responsive.css'),
    cssLink(base, 'overrides.css'),
  ];
  const extras = {
    home: [cssLink(base, 'home.css')],
    list: [cssLink(base, 'list.css')],
    detail: [cssLink(base, 'detail.css')],
    search: [cssLink(base, 'search.css')],
  };
  return [...common, ...(extras[pageType] || [])].join('\n  ');
}

// 根据页面类型返回所需 JS
function getJS(base, pageType) {
  const common = [jsScript(base, 'core.js')];
  const extras = {
    home: [jsScript(base, 'main.js')],
    list: [jsScript(base, 'main.js')],
    detail: [jsScript(base, 'main.js')],
    search: [jsScript(base, 'search.js')],
  };
  return [...common, ...(extras[pageType] || [])].join('\n  ');
}

// ============================================================
// HTML 片段生成
// ============================================================

// 导航栏
function renderNav(base, activeCat) {
  const cats = [
    { id: '', name: '首页', icon: 'home' },
    { id: 'characters', name: '人物', icon: 'character' },
    { id: 'chapters', name: '章节', icon: 'chapter' },
    { id: 'locations', name: '地点', icon: 'location' },
    { id: 'artifacts', name: '法宝', icon: 'artifact' },
    { id: 'quotes', name: '台词', icon: 'quote' },
    { id: 'search', name: '搜索', icon: 'search' },
  ];
  const links = cats.map(c => {
    const href = c.id === '' ? `${base}index.html`
      : c.id === 'search' ? `${base}search.html`
      : `${base}${c.id}/index.html`;
    const isActive = activeCat === c.id ? ' active' : '';
    const iconSvg = c.icon === 'home'
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg>'
      : c.icon === 'search'
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
      : '';
    return `<a href="${href}" class="nav-link${isActive}">${iconSvg}<span>${c.name}</span></a>`;
  }).join('\n      ');

  return `<header class="site-header" id="siteHeader">
    <div class="header-inner">
      <a href="${base}index.html" class="logo">
        <img src="${base}assets/images/logo.svg" alt="西游记知识库" width="32" height="32">
        <span class="logo-text">西游记知识库</span>
      </a>
      <nav class="main-nav" id="mainNav">
      ${links}
      </nav>
      <button class="hamburger" id="hamburger" aria-label="菜单">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`;
}

// 页脚
function renderFooter(base, siteConfig) {
  return `<footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <h4>西游记知识库</h4>
        <p>${esc(siteConfig.site.description)}</p>
      </div>
      <div class="footer-col">
        <h4>快速导航</h4>
        <ul>
          <li><a href="${base}characters/index.html">人物百科</a></li>
          <li><a href="${base}chapters/index.html">章节回目</a></li>
          <li><a href="${base}locations/index.html">地理路线</a></li>
          <li><a href="${base}artifacts/index.html">法宝图鉴</a></li>
          <li><a href="${base}quotes/index.html">经典台词</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>关于</h4>
        <p>本站内容基于明代吴承恩著《西游记》原著，旨在以知识库形式系统整理人物、章节、地理、法宝等信息。</p>
        <p><a href="${base}about.html">关于本站</a> · <a href="${base}search.html">全文搜索</a></p>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 西游记知识库 · 数据仅供学习研究使用</p>
    </div>
  </footer>`;
}

// 面包屑
function renderBreadcrumb(base, items) {
  const links = items.map((item, i) => {
    if (i === items.length - 1) {
      return `<span class="breadcrumb-current">${esc(item.name)}</span>`;
    }
    return `<a href="${base}${item.path}">${esc(item.name)}</a><span class="sep">/</span>`;
  }).join('\n      ');
  return `<nav class="breadcrumb">
    ${links}
  </nav>`;
}

// HTML 页面骨架
function renderPage({ title, description, base, pageType, nav, breadcrumb, content, footer, extraHead, extraBody }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="theme-color" content="#8B4513">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="西游记知识库">
  <meta name="format-detection" content="telephone=no">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="西游记,孙悟空,唐僧,猪八戒,沙僧,取经,古典名著,吴承恩,人物百科,章节导读,地理路线,法宝图鉴,经典台词">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:site_name" content="西游记知识库">
  <meta property="og:locale" content="zh_CN">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <link rel="icon" href="${base}assets/images/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${base}assets/images/favicon.svg">
  ${getCSS(base, pageType)}
  ${extraHead || ''}
</head>
<body>
  ${nav || ''}
  <main class="main-content">
    ${breadcrumb || ''}
    ${content || ''}
  </main>
  ${footer || ''}
  ${getJS(base, pageType)}
  ${extraBody || ''}
</body>
</html>`;
}

// ============================================================
// 文件写入
// ============================================================
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

// 统计页面数
let pageCount = 0;
function countPage() { pageCount++; }
function getPageCount() { return pageCount; }
function resetPageCount() { pageCount = 0; }

module.exports = {
  ROOT, DATA_DIR, OUTPUT_DIR,
  loadData, buildLookup, buildCrossReferences,
  TYPE_DIR, TYPE_LABEL, TYPE_ICON,
  getTypeById, getNameById,
  esc,
  getCSS, getJS, cssLink, jsScript,
  renderNav, renderFooter, renderBreadcrumb, renderPage,
  ensureDir, writeFile,
  countPage, getPageCount, resetPageCount,
};
