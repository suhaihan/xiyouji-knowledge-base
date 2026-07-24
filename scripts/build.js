/**
 * build.js - 西游记知识库静态站点构建主脚本
 * 运行: node scripts/build.js
 * 
 * 生成全部静态 HTML 页面 + 搜索索引 + 关系图谱数据
 */
const fs = require('fs');
const path = require('path');
const U = require('./utils');

// ============================================================
// 数据加载与预处理
// ============================================================
const data = U.loadData();
const lookup = U.buildCrossReferences(data);
const BASE_ROOT = './';    // 根级页面的相对路径
const BASE_SUB = '../';    // 子目录页面的相对路径
U.resetPageCount();

// ============================================================
// 模板：首页
// ============================================================
function buildHome() {
  const { siteConfig } = data;
  const base = BASE_ROOT;

  // 统计数字
  const stats = siteConfig.stats;
  const statCards = [
    { num: stats.characters, label: '人物', icon: 'character', href: 'characters/index.html' },
    { num: stats.chapters, label: '章节', icon: 'chapter', href: 'chapters/index.html' },
    { num: stats.locations, label: '地点', icon: 'location', href: 'locations/index.html' },
    { num: stats.artifacts, label: '法宝', icon: 'artifact', href: 'artifacts/index.html' },
    { num: stats.quotes, label: '台词', icon: 'quote', href: 'quotes/index.html' },
  ].map(s => `<a href="${base}${s.href}" class="stat-card">
      <div class="stat-num">${s.num}</div>
      <div class="stat-label">${s.label}</div>
    </a>`).join('\n      ');

  // 分类导航卡片
  const catCards = siteConfig.categories.map(cat => {
    const iconPath = `${base}assets/images/icons/${cat.icon}.svg`;
    return `<a href="${base}${cat.id}/index.html" class="cat-card">
      <div class="cat-icon"><img src="${iconPath}" alt="${cat.name}" width="40" height="40"></div>
      <div class="cat-info">
        <h3>${cat.name}</h3>
        <p>${U.esc(cat.description)}</p>
      </div>
    </a>`;
  }).join('\n      ');

  // 热门人物 (按 reference_count 排序)
  const hotChars = [...data.characters]
    .sort((a, b) => (lookup[b.id]?.reference_count || 0) - (lookup[a.id]?.reference_count || 0))
    .slice(0, 8);
  const hotCharCards = hotChars.map(c => {
    const catLabel = charCategoryLabel(c.category);
    return `<a href="${base}characters/${c.id}.html" class="char-card">
      <div class="char-badge ${c.category}">${catLabel}</div>
      <h4>${U.esc(c.name)}</h4>
      <p class="char-type">${U.esc(c.type || '')}</p>
      <p class="char-summary">${U.esc(c.summary || '').slice(0, 50)}...</p>
      <div class="char-ref">被引用 ${lookup[c.id]?.reference_count || 0} 次</div>
    </a>`;
  }).join('\n      ');

  // 精选章节
  const featChapters = data.chapters.filter(c => [1, 7, 14, 27, 59, 100].includes(c.number));
  const chapterCards = featChapters.map(c => {
    return `<a href="${base}chapters/${c.id}.html" class="chapter-card">
      <div class="chapter-num">第${toChineseNum(c.number)}回</div>
      <h4>${U.esc(c.title_short || c.title)}</h4>
      <p>${U.esc(c.summary || '').slice(0, 60)}...</p>
    </a>`;
  }).join('\n      ');

  // 取经路线概览
  const routeLocs = data.locations.filter(l => l.in_route).sort((a, b) => a.route_order - b.route_order);
  const routeItems = routeLocs.map((l, i) => {
    const summary = U.esc(l.summary || '').slice(0, 40);
    return `<a href="${base}locations/${l.id}.html" class="route-card">
      <span class="route-order">${i + 1}</span>
      <h4>${U.esc(l.name)}</h4>
      <p class="route-desc">${summary}${summary.length >= 40 ? '...' : ''}</p>
    </a>`;
  }).join('\n      ');

  // 热门法宝
  const hotArts = [...data.artifacts]
    .sort((a, b) => (lookup[b.id]?.reference_count || 0) - (lookup[a.id]?.reference_count || 0))
    .slice(0, 6);
  const artCards = hotArts.map(a => {
    const ownerName = a.owner ? U.getNameById(a.owner, lookup) : '无主';
    const summary = U.esc(a.summary || '').slice(0, 50);
    return `<a href="${base}artifacts/${a.id}.html" class="artifact-card">
      <div class="art-badge">${a.category === 'weapon' ? '兵器' : '法宝'}</div>
      <h4>${U.esc(a.name)}</h4>
      <p class="art-type">${U.esc(a.type || '')}</p>
      <p class="art-summary">${summary}${summary.length >= 50 ? '...' : ''}</p>
      <p class="art-owner">持有者: ${U.esc(ownerName)}</p>
    </a>`;
  }).join('\n      ');

  // 精选台词
  const featQuotes = data.quotes.slice(0, 6);
  const quoteCards = featQuotes.map(q => {
    const speakerName = q.speaker ? U.getNameById(q.speaker, lookup) : '旁白';
    return `<a href="${base}quotes/${q.id}.html" class="quote-card">
      <blockquote>"${U.esc(q.text)}"</blockquote>
      <cite>—— ${U.esc(speakerName)}</cite>
    </a>`;
  }).join('\n      ');

  const content = `<section class="hero">
    <div class="hero-inner">
      <h1 class="hero-title">西游记知识库</h1>
      <p class="hero-subtitle">${U.esc(siteConfig.site.description)}</p>
      <div class="hero-search">
        <input type="text" id="heroSearchInput" placeholder="搜索人物、章节、法宝..." autocomplete="off">
        <button id="heroSearchBtn" class="btn-primary">搜索</button>
      </div>
    </div>
  </section>

  <section class="stats-bar">
    ${statCards}
  </section>

  <section class="section-block">
    <h2 class="section-title"><span>内容分类</span></h2>
    <div class="cat-grid">
      ${catCards}
    </div>
  </section>

  <section class="section-block">
    <h2 class="section-title"><span>热门人物</span></h2>
    <div class="char-grid">
      ${hotCharCards}
    </div>
  </section>

  <section class="section-block">
    <h2 class="section-title"><span>精选章节</span></h2>
    <div class="chapter-grid">
      ${chapterCards}
    </div>
  </section>

  <section class="section-block">
    <h2 class="section-title"><span>取经路线</span></h2>
    <div class="route-grid">
      ${routeItems}
    </div>
  </section>

  <section class="section-block">
    <h2 class="section-title"><span>法宝图鉴</span></h2>
    <div class="artifact-grid">
      ${artCards}
    </div>
  </section>

  <section class="section-block">
    <h2 class="section-title"><span>经典台词</span></h2>
    <div class="quote-grid">
      ${quoteCards}
    </div>
  </section>`;

  const html = U.renderPage({
    title: `${siteConfig.site.name} - ${siteConfig.site.subtitle}`,
    description: siteConfig.site.description,
    base,
    pageType: 'home',
    nav: U.renderNav(base, ''),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'index.html'), html);
  U.countPage();
}

// ============================================================
// 模板：人物列表页
// ============================================================
function buildCharacterList() {
  const base = BASE_SUB;  // 列表页在子目录中，需要用 ../ 回到根
  const { siteConfig } = data;

  // 按 category 分组
  const categories = {
    'main-character': '取经师徒',
    'immortal': '天庭神仙',
    'buddha': '佛门菩萨',
    'demon': '妖魔鬼怪',
    'mortal': '凡间人物',
  };

  const cards = data.characters.map(c => {
    const catLabel = charCategoryLabel(c.category);
    const weaponName = c.weapon && c.weapon !== 'none' ? U.getNameById(c.weapon, lookup) : '';
    return `<a href="${base}characters/${c.id}.html" class="char-card" data-category="${c.category}">
      <div class="char-badge ${c.category}">${catLabel}</div>
      <h4>${U.esc(c.name)}</h4>
      <p class="char-type">${U.esc(c.type || '')}${c.species ? ' · ' + U.esc(c.species) : ''}</p>
      <p class="char-summary">${U.esc(c.summary || '').slice(0, 60)}...</p>
      ${weaponName ? `<div class="char-weapon">兵器: ${U.esc(weaponName)}</div>` : ''}
      <div class="char-ref">被引用 ${lookup[c.id]?.reference_count || 0} 次</div>
    </a>`;
  }).join('\n      ');

  // 分类筛选
  const filterTags = Object.entries(categories).map(([key, label]) => {
    const count = data.characters.filter(c => c.category === key).length;
    return `<button class="filter-tag" data-filter="${key}">${label} (${count})</button>`;
  }).join('\n      ');

  const content = `<div class="list-header">
    <h1>人物百科</h1>
    <p class="list-desc">取经师徒及各路神仙妖魔，共 ${data.characters.length} 位人物</p>
  </div>

  <div class="filter-bar">
    <button class="filter-tag active" data-filter="all">全部 (${data.characters.length})</button>
    ${filterTags}
  </div>

  <div class="char-grid" id="charGrid">
    ${cards}
  </div>`;

  const html = U.renderPage({
    title: `人物百科 - ${siteConfig.site.name}`,
    description: '《西游记》人物百科：取经师徒及各路神仙妖魔的详细介绍',
    base,
    pageType: 'list',
    nav: U.renderNav(base, 'characters'),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '人物', path: 'characters/index.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'characters', 'index.html'), html);
  U.countPage();
}

// ============================================================
// 模板：人物详情页
// ============================================================
function buildCharacterDetail(char) {
  const base = BASE_SUB;
  const { siteConfig } = data;
  const catLabel = charCategoryLabel(char.category);

  // 别名
  const aliases = char.aliases && char.aliases.length
    ? `<div class="detail-aliases">${char.aliases.map(a => `<span class="alias-tag">${U.esc(a)}</span>`).join('')}</div>`
    : '';

  // 能力表
  const abilities = char.abilities && char.abilities.length
    ? `<div class="info-block">
        <h3>神通能力</h3>
        <table class="ability-table">
          <thead><tr><th>神通</th><th>描述</th></tr></thead>
          <tbody>
            ${char.abilities.map(a => `<tr><td class="ability-name">${U.esc(a.name)}</td><td>${U.esc(a.description)}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>`
    : '';

  // 属性
  const attrs = char.attributes
    ? `<div class="info-block">
        <h3>基本属性</h3>
        <dl class="attr-list">
          ${Object.entries(char.attributes).map(([k, v]) => `<dt>${U.esc(k)}</dt><dd>${U.esc(v)}</dd>`).join('\n          ')}
          ${char.species ? `<dt>种族</dt><dd>${U.esc(char.species)}</dd>` : ''}
          ${char.gender ? `<dt>性别</dt><dd>${U.esc(char.gender)}</dd>` : ''}
          ${char.master ? (() => { const masterName = lookup[char.master] ? U.getNameById(char.master, lookup) : char.master; return masterName && masterName !== 'none' ? `<dt>师父</dt><dd>${U.esc(masterName)}</dd>` : ''; })() : ''}
          ${char.power_level ? `<dt>战力评级</dt><dd>${U.esc(char.power_level)}</dd>` : ''}
        </dl>
      </div>`
    : '';

  // 关系
  const relationships = char.relationships && char.relationships.length
    ? `<div class="info-block">
        <h3>人物关系</h3>
        <ul class="relation-list">
          ${char.relationships.map(r => {
            const targetName = U.getNameById(r.target, lookup);
            const targetType = U.getTypeById(r.target, lookup);
            const href = targetType ? `${base}${U.TYPE_DIR[targetType]}/${r.target}.html` : '#';
            return `<li>
              <span class="rel-type">${U.esc(r.type)}</span>
              <a href="${href}">${U.esc(targetName)}</a>
              <span class="rel-desc">${U.esc(r.description || '')}</span>
            </li>`;
          }).join('\n          ')}
        </ul>
      </div>`
    : '';

  // 时间线
  const timeline = char.timeline && char.timeline.length
    ? `<div class="info-block">
        <h3>人物时间线</h3>
        <div class="timeline">
          ${char.timeline.map(t => {
            const chHref = `${base}chapters/chapter-${String(t.chapter).padStart(3, '0')}.html`;
            return `<div class="timeline-item">
              <div class="timeline-chapter"><a href="${chHref}">第${toChineseNum(t.chapter)}回</a></div>
              <div class="timeline-event">${U.esc(t.event)}</div>
              <div class="timeline-summary">${U.esc(t.summary || '')}</div>
            </div>`;
          }).join('\n          ')}
        </div>
      </div>`
    : '';

  // 出场章节
  const appearsChapters = char.appears_in && char.appears_in.chapters && char.appears_in.chapters.length
    ? (() => {
        const chs = char.appears_in.chapters;
        const chLinks = chs.map(n => {
          const chId = `chapter-${String(n).padStart(3, '0')}`;
          return `<a href="${base}chapters/${chId}.html" class="chapter-tag">第${toChineseNum(n)}回</a>`;
        }).join('\n            ');
        return `<div class="info-block">
          <h3>出场章节 (${chs.length}回)</h3>
          <div class="chapter-tags">
            ${chLinks}
          </div>
        </div>`;
      })()
    : '';

  // 经典台词
  const charQuotes = char.quotes && char.quotes.length
    ? `<div class="info-block">
        <h3>经典台词</h3>
        <ul class="quote-list">
          ${char.quotes.map(q => `<li><blockquote>"${U.esc(q)}"</blockquote></li>`).join('\n          ')}
        </ul>
      </div>`
    : '';

  // 标签
  const tags = char.tags && char.tags.length
    ? `<div class="detail-tags">${char.tags.map(t => `<span class="seal-tag">${U.esc(t)}</span>`).join('')}</div>`
    : '';

  // 反向引用
  const backRefs = (lookup[char.id]?.references || []).map(refId => {
    const refItem = lookup[refId];
    if (!refItem) return null;
    const href = `${base}${U.TYPE_DIR[refItem._type]}/${refId}.html`;
    return `<a href="${href}" class="ref-link">${U.esc(refItem.name || refItem.title)}<span class="ref-type">${U.TYPE_LABEL[refItem._type]}</span></a>`;
  }).filter(Boolean).join('\n          ');

  const backRefsBlock = backRefs
    ? `<div class="info-block">
        <h3>相关引用 (${lookup[char.id]?.reference_count || 0})</h3>
        <div class="ref-list">
          ${backRefs}
        </div>
      </div>`
    : '';

  // 兵器链接
  const weaponBlock = char.weapon
    ? (() => {
        const wName = U.getNameById(char.weapon, lookup);
        const wType = U.getTypeById(char.weapon, lookup);
        const wHref = wType ? `${base}${U.TYPE_DIR[wType]}/${char.weapon}.html` : '#';
        return `<div class="info-block">
          <h3>随身兵器</h3>
          <p><a href="${wHref}" class="weapon-link">${U.esc(wName)}</a></p>
        </div>`;
      })()
    : '';

  // 居所链接
  const dwellingBlock = char.dwelling
    ? (() => {
        const dName = U.getNameById(char.dwelling, lookup);
        const dType = U.getTypeById(char.dwelling, lookup);
        const dHref = dType ? `${base}${U.TYPE_DIR[dType]}/${char.dwelling}.html` : '#';
        return `<div class="info-block">
          <h3>居所</h3>
          <p><a href="${dHref}" class="location-link">${U.esc(dName)}</a></p>
        </div>`;
      })()
    : '';

  // 关系图谱数据
  const graphData = buildCharGraphData(char);

  const content = `<div class="detail-header">
    <div class="detail-title-row">
      <h1>${U.esc(char.name)}</h1>
      <span class="detail-badge ${char.category}">${catLabel}</span>
    </div>
    ${aliases}
    <p class="detail-summary">${U.esc(char.summary || '')}</p>
    ${tags}
  </div>

  <div class="detail-body">
    <div class="detail-main">
      <div class="info-block">
        <h3>详细介绍</h3>
        <p class="detail-description">${U.esc(char.description || char.summary || '')}</p>
      </div>
      ${abilities}
      ${timeline}
      ${appearsChapters}
      ${charQuotes}
      ${backRefsBlock}
    </div>

    <aside class="detail-sidebar">
      ${attrs}
      ${weaponBlock}
      ${dwellingBlock}
      ${relationships}
    </aside>
  </div>

  ${char.relationships && char.relationships.length ? `
  <div class="info-block graph-block">
    <h3>人物关系图谱</h3>
    <div id="relationGraph" style="width:100%;height:500px;"></div>
  </div>
  <script>window.__charGraphData = ${JSON.stringify(graphData)};</script>
  ` : ''}`;

  const html = U.renderPage({
    title: `${char.name} - ${siteConfig.site.name}`,
    description: char.summary || char.name,
    base,
    pageType: 'detail',
    nav: U.renderNav(base, 'characters'),
    breadcrumb: U.renderBreadcrumb(base, [
      { name: '首页', path: 'index.html' },
      { name: '人物', path: 'characters/index.html' },
      { name: char.name, path: `characters/${char.id}.html` },
    ]),
    content,
    footer: U.renderFooter(base, siteConfig),
    extraBody: char.relationships && char.relationships.length
      ? `<script src="${base}lib/echarts/echarts.min.js"></script>\n  <script src="${base}assets/js/graph.js" defer></script>`
      : '',
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'characters', `${char.id}.html`), html);
  U.countPage();
}

// ============================================================
// 模板：章节列表页
// ============================================================
function buildChapterList() {
  const base = BASE_SUB;  // 列表页在子目录中
  const { siteConfig } = data;

  // 按每10回分组
  const groups = [];
  for (let i = 0; i < 10; i++) {
    const start = i * 10 + 1;
    const end = (i + 1) * 10;
    const chs = data.chapters.filter(c => c.number >= start && c.number <= end);
    groups.push({ range: `第${toChineseNum(start)}-${toChineseNum(end)}回`, chapters: chs });
  }

  const groupsHtml = groups.map(g => {
    const chCards = g.chapters.map(c => {
      return `<a href="${base}chapters/${c.id}.html" class="chapter-card">
        <div class="chapter-num">第${toChineseNum(c.number)}回</div>
        <h4>${U.esc(c.title)}</h4>
        <p>${U.esc(c.summary || '').slice(0, 80)}...</p>
      </a>`;
    }).join('\n        ');
    return `<div class="chapter-group">
      <h3 class="group-title">${g.range}</h3>
      <div class="chapter-grid">
        ${chCards}
      </div>
    </div>`;
  }).join('\n    ');

  const content = `<div class="list-header">
    <h1>章节回目</h1>
    <p class="list-desc">《西游记》一百回完整目录与内容摘要</p>
  </div>
  ${groupsHtml}`;

  const html = U.renderPage({
    title: `章节回目 - ${siteConfig.site.name}`,
    description: '《西游记》一百回完整目录与内容摘要',
    base,
    pageType: 'list',
    nav: U.renderNav(base, 'chapters'),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '章节', path: 'chapters/index.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'chapters', 'index.html'), html);
  U.countPage();
}

// ============================================================
// 模板：章节详情页
// ============================================================
function buildChapterDetail(ch) {
  const base = BASE_SUB;
  const { siteConfig } = data;

  // 相关人物
  const charLinks = (ch.characters || []).map(id => {
    const name = U.getNameById(id, lookup);
    return `<a href="${base}characters/${id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">人物</span></a>`;
  }).join('\n          ');

  // 相关地点
  const locLinks = (ch.locations || []).map(id => {
    const name = U.getNameById(id, lookup);
    return `<a href="${base}locations/${id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">地点</span></a>`;
  }).join('\n          ');

  // 相关法宝
  const artLinks = (ch.artifacts || []).map(id => {
    const name = U.getNameById(id, lookup);
    return `<a href="${base}artifacts/${id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">法宝</span></a>`;
  }).join('\n          ');

  // 相关台词
  const quoteLinks = (ch.quotes || []).map(id => {
    const q = lookup[id];
    if (!q) return '';
    return `<a href="${base}quotes/${id}.html" class="ref-link">"${U.esc(q.text || '').slice(0, 20)}..."<span class="ref-type">台词</span></a>`;
  }).join('\n          ');

  // 关键事件
  const keyEvents = (ch.key_events || []).length
    ? `<div class="info-block">
        <h3>关键事件</h3>
        <ol class="event-list">
          ${ch.key_events.map(e => `<li>${U.esc(typeof e === 'string' ? e : e.event || e.description || JSON.stringify(e))}</li>`).join('\n          ')}
        </ol>
      </div>`
    : '';

  // 情节要点
  const plotPoints = (ch.plot_points || []).length
    ? `<div class="info-block">
        <h3>情节要点</h3>
        <ol class="plot-list">
          ${ch.plot_points.map(p => `<li>${U.esc(typeof p === 'string' ? p : p.point || p.description || JSON.stringify(p))}</li>`).join('\n          ')}
        </ol>
      </div>`
    : '';

  // 主题
  const themes = (ch.themes || []).length
    ? `<div class="detail-tags">${ch.themes.map(t => `<span class="seal-tag">${U.esc(t)}</span>`).join('')}</div>`
    : '';

  // 上下回导航
  const prevLink = ch.prev_chapter
    ? `<a href="${base}chapters/${ch.prev_chapter}.html" class="nav-prev">← 上一回</a>`
    : '<span class="nav-prev disabled">← 上一回</span>';
  const nextLink = ch.next_chapter
    ? `<a href="${base}chapters/${ch.next_chapter}.html" class="nav-next">下一回 →</a>`
    : '<span class="nav-next disabled">下一回 →</span>';

  const refsBlock = [charLinks, locLinks, artLinks, quoteLinks].filter(Boolean).some(s => s.trim())
    ? `<div class="detail-body">
        <div class="detail-main">
          ${charLinks ? `<div class="info-block"><h3>相关人物</h3><div class="ref-list">${charLinks}</div></div>` : ''}
          ${locLinks ? `<div class="info-block"><h3>相关地点</h3><div class="ref-list">${locLinks}</div></div>` : ''}
        </div>
        <aside class="detail-sidebar">
          ${artLinks ? `<div class="info-block"><h3>相关法宝</h3><div class="ref-list">${artLinks}</div></div>` : ''}
          ${quoteLinks ? `<div class="info-block"><h3>相关台词</h3><div class="ref-list">${quoteLinks}</div></div>` : ''}
        </aside>
      </div>`
    : '';

  const content = `<div class="detail-header">
    <div class="detail-title-row">
      <span class="chapter-big-num">第${toChineseNum(ch.number)}回</span>
    </div>
    <h1>${U.esc(ch.title)}</h1>
    <p class="detail-summary">${U.esc(ch.summary || '')}</p>
    ${themes}
  </div>

  <div class="chapter-nav-bar">
    ${prevLink}
    ${nextLink}
  </div>

  ${plotPoints}
  ${keyEvents}
  ${refsBlock}

  <div class="chapter-nav-bar">
    ${prevLink}
    ${nextLink}
  </div>`;

  const html = U.renderPage({
    title: `第${toChineseNum(ch.number)}回 ${ch.title} - ${siteConfig.site.name}`,
    description: ch.summary || ch.title,
    base,
    pageType: 'detail',
    nav: U.renderNav(base, 'chapters'),
    breadcrumb: U.renderBreadcrumb(base, [
      { name: '首页', path: 'index.html' },
      { name: '章节', path: 'chapters/index.html' },
      { name: `第${toChineseNum(ch.number)}回`, path: `chapters/${ch.id}.html` },
    ]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'chapters', `${ch.id}.html`), html);
  U.countPage();
}

// ============================================================
// 模板：地点列表页
// ============================================================
function buildLocationList() {
  const base = BASE_SUB;  // 列表页在子目录中
  const { siteConfig } = data;

  const cards = data.locations.map(l => {
    return `<a href="${base}locations/${l.id}.html" class="loc-card" data-category="${l.category}">
      <div class="loc-badge ${l.category}">${l.category === 'route-location' ? '取经路' : '重要地点'}</div>
      <h4>${U.esc(l.name)}</h4>
      <p class="loc-type">${U.esc(l.type || '')}${l.continent ? ' · ' + U.esc(l.continent) : ''}</p>
      <p class="loc-summary">${U.esc(l.summary || '').slice(0, 60)}...</p>
      ${l.in_route ? `<div class="route-badge">取经路线 #${l.route_order}</div>` : ''}
    </a>`;
  }).join('\n      ');

  const content = `<div class="list-header">
    <h1>地理路线</h1>
    <p class="list-desc">取经路线与重要地点，共 ${data.locations.length} 个</p>
  </div>

  <div class="filter-bar">
    <button class="filter-tag active" data-filter="all">全部 (${data.locations.length})</button>
    <button class="filter-tag" data-filter="route-location">取经路 (${data.locations.filter(l => l.in_route).length})</button>
    <button class="filter-tag" data-filter="important-location">重要地点 (${data.locations.filter(l => !l.in_route).length})</button>
  </div>

  <div class="loc-grid">
    ${cards}
  </div>`;

  const html = U.renderPage({
    title: `地理路线 - ${siteConfig.site.name}`,
    description: '《西游记》取经路线与重要地点',
    base,
    pageType: 'list',
    nav: U.renderNav(base, 'locations'),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '地点', path: 'locations/index.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'locations', 'index.html'), html);
  U.countPage();
}

// ============================================================
// 模板：地点详情页
// ============================================================
function buildLocationDetail(loc) {
  const base = BASE_SUB;
  const { siteConfig } = data;

  const aliases = loc.aliases && loc.aliases.length
    ? `<div class="detail-aliases">${loc.aliases.map(a => `<span class="alias-tag">${U.esc(a)}</span>`).join('')}</div>`
    : '';

  // 事件时间线
  const events = loc.events && loc.events.length
    ? `<div class="info-block">
        <h3>相关事件</h3>
        <div class="timeline">
          ${loc.events.map(e => {
            const chHref = `${base}chapters/chapter-${String(e.chapter).padStart(3, '0')}.html`;
            return `<div class="timeline-item">
              <div class="timeline-chapter"><a href="${chHref}">第${toChineseNum(e.chapter)}回</a></div>
              <div class="timeline-event">${U.esc(e.event)}</div>
              <div class="timeline-summary">${U.esc(e.description || '')}</div>
            </div>`;
          }).join('\n          ')}
        </div>
      </div>`
    : '';

  // 居民
  const residents = loc.residents && loc.residents.length
    ? `<div class="info-block"><h3>居住者</h3><div class="ref-list">${loc.residents.map(id => {
        const name = U.getNameById(id, lookup);
        return `<a href="${base}characters/${id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">人物</span></a>`;
      }).join('\n          ')}</div></div>`
    : '';

  // 访客
  const visitors = loc.visitors && loc.visitors.length
    ? `<div class="info-block"><h3>到访者</h3><div class="ref-list">${loc.visitors.map(id => {
        const name = U.getNameById(id, lookup);
        return `<a href="${base}characters/${id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">人物</span></a>`;
      }).join('\n          ')}</div></div>`
    : '';

  // 相关地点
  const relatedLocs = loc.related_locations && loc.related_locations.length
    ? `<div class="info-block"><h3>相关地点</h3><div class="ref-list">${loc.related_locations.map(r => {
        const name = U.getNameById(r.id, lookup);
        return `<a href="${base}locations/${r.id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">${U.esc(r.relation || '关联')}</span></a>`;
      }).join('\n          ')}</div></div>`
    : '';

  // 反向引用
  const backRefs = (lookup[loc.id]?.references || []).map(refId => {
    const refItem = lookup[refId];
    if (!refItem) return null;
    const href = `${base}${U.TYPE_DIR[refItem._type]}/${refId}.html`;
    return `<a href="${href}" class="ref-link">${U.esc(refItem.name || refItem.title)}<span class="ref-type">${U.TYPE_LABEL[refItem._type]}</span></a>`;
  }).filter(Boolean).join('\n          ');

  const backRefsBlock = backRefs
    ? `<div class="info-block"><h3>相关引用 (${lookup[loc.id]?.reference_count || 0})</h3><div class="ref-list">${backRefs}</div></div>`
    : '';

  // 出场章节
  const appearsChapters = loc.appears_in && loc.appears_in.length
    ? (() => {
        const chLinks = loc.appears_in.map(n => {
          const chId = `chapter-${String(n).padStart(3, '0')}`;
          return `<a href="${base}chapters/${chId}.html" class="chapter-tag">第${toChineseNum(n)}回</a>`;
        }).join('\n            ');
        return `<div class="info-block"><h3>出场章节 (${loc.appears_in.length}回)</h3><div class="chapter-tags">${chLinks}</div></div>`;
      })()
    : '';

  const tags = loc.tags && loc.tags.length
    ? `<div class="detail-tags">${loc.tags.map(t => `<span class="seal-tag">${U.esc(t)}</span>`).join('')}</div>`
    : '';

  // 属性
  const attrs = `<div class="info-block">
    <h3>基本信息</h3>
    <dl class="attr-list">
      <dt>类型</dt><dd>${U.esc(loc.type || '')}</dd>
      ${loc.continent ? `<dt>部洲</dt><dd>${U.esc(loc.continent)}</dd>` : ''}
      ${loc.country ? `<dt>国度</dt><dd>${U.esc(loc.country)}</dd>` : ''}
      ${loc.in_route ? `<dt>取经路线</dt><dd>第 ${loc.route_order} 站</dd>` : ''}
      <dt>首次出现</dt><dd>第${toChineseNum(loc.first_appears || 1)}回</dd>
    </dl>
  </div>`;

  const content = `<div class="detail-header">
    <div class="detail-title-row">
      <h1>${U.esc(loc.name)}</h1>
      <span class="detail-badge ${loc.category}">${loc.in_route ? '取经路线' : '重要地点'}</span>
    </div>
    ${aliases}
    <p class="detail-summary">${U.esc(loc.summary || '')}</p>
    ${tags}
  </div>

  <div class="detail-body">
    <div class="detail-main">
      <div class="info-block">
        <h3>详细介绍</h3>
        <p class="detail-description">${U.esc(loc.description || loc.summary || '')}</p>
      </div>
      ${events}
      ${appearsChapters}
      ${backRefsBlock}
    </div>
    <aside class="detail-sidebar">
      ${attrs}
      ${residents}
      ${visitors}
      ${relatedLocs}
    </aside>
  </div>`;

  const html = U.renderPage({
    title: `${loc.name} - ${siteConfig.site.name}`,
    description: loc.summary || loc.name,
    base,
    pageType: 'detail',
    nav: U.renderNav(base, 'locations'),
    breadcrumb: U.renderBreadcrumb(base, [
      { name: '首页', path: 'index.html' },
      { name: '地点', path: 'locations/index.html' },
      { name: loc.name, path: `locations/${loc.id}.html` },
    ]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'locations', `${loc.id}.html`), html);
  U.countPage();
}

// ============================================================
// 模板：法宝列表页
// ============================================================
function buildArtifactList() {
  const base = BASE_SUB;  // 列表页在子目录中
  const { siteConfig } = data;

  // 按分类统计
  const catMap = {};
  data.artifacts.forEach(a => {
    const cat = a.category || 'other';
    if (!catMap[cat]) catMap[cat] = { count: 0, label: a.type || cat };
    catMap[cat].count++;
  });

  const catLabels = { weapon: '兵器', treasure: '法宝' };
  const filterBtns = Object.entries(catMap).map(([key, info]) => {
    const label = catLabels[key] || info.label;
    return `<button class="filter-tag" data-filter="${key}">${label} (${info.count})</button>`;
  }).join('\n    ');

  const cards = data.artifacts.map(a => {
    const ownerName = a.owner ? U.getNameById(a.owner, lookup) : '无主';
    return `<a href="${base}artifacts/${a.id}.html" class="artifact-card" data-category="${a.category || ''}">
      <div class="art-badge ${a.category}">${U.esc(a.type || '法宝')}</div>
      <h4>${U.esc(a.name)}</h4>
      <p class="art-type">${U.esc(a.type || '')}</p>
      <p class="art-summary">${U.esc(a.summary || '').slice(0, 60)}...</p>
      <div class="art-owner">持有者: ${U.esc(ownerName)}</div>
    </a>`;
  }).join('\n      ');

  const content = `<div class="list-header">
    <h1>法宝图鉴</h1>
    <p class="list-desc">神兵利器与法宝图鉴，共 ${data.artifacts.length} 件</p>
  </div>
  <div class="filter-bar">
    <button class="filter-tag active" data-filter="all">全部 (${data.artifacts.length})</button>
    ${filterBtns}
  </div>
  <div class="artifact-grid">
    ${cards}
  </div>`;

  const html = U.renderPage({
    title: `法宝图鉴 - ${siteConfig.site.name}`,
    description: '《西游记》神兵利器与法宝图鉴',
    base,
    pageType: 'list',
    nav: U.renderNav(base, 'artifacts'),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '法宝', path: 'artifacts/index.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'artifacts', 'index.html'), html);
  U.countPage();
}

// ============================================================
// 模板：法宝详情页
// ============================================================
function buildArtifactDetail(art) {
  const base = BASE_SUB;
  const { siteConfig } = data;

  const aliases = art.aliases && art.aliases.length
    ? `<div class="detail-aliases">${art.aliases.map(a => `<span class="alias-tag">${U.esc(a)}</span>`).join('')}</div>`
    : '';

  // 属性
  const props = art.properties
    ? `<div class="info-block">
        <h3>法宝属性</h3>
        <dl class="attr-list">
          ${Object.entries(art.properties).map(([k, v]) => `<dt>${U.esc(k)}</dt><dd>${U.esc(v)}</dd>`).join('\n          ')}
          <dt>类型</dt><dd>${U.esc(art.type || '')}</dd>
        </dl>
      </div>`
    : '';

  // 持有者
  const ownerBlock = art.owner
    ? (() => {
        const oName = U.getNameById(art.owner, lookup);
        return `<div class="info-block"><h3>持有者</h3><p><a href="${base}characters/${art.owner}.html" class="char-link">${U.esc(oName)}</a></p></div>`;
      })()
    : '';

  // 出场章节
  const appearsChapters = art.appears_in && art.appears_in.length
    ? (() => {
        const chLinks = art.appears_in.map(n => {
          const chId = `chapter-${String(n).padStart(3, '0')}`;
          return `<a href="${base}chapters/${chId}.html" class="chapter-tag">第${toChineseNum(n)}回</a>`;
        }).join('\n            ');
        return `<div class="info-block"><h3>出场章节 (${art.appears_in.length}回)</h3><div class="chapter-tags">${chLinks}</div></div>`;
      })()
    : '';

  // 反向引用
  const backRefs = (lookup[art.id]?.references || []).map(refId => {
    const refItem = lookup[refId];
    if (!refItem) return null;
    const href = `${base}${U.TYPE_DIR[refItem._type]}/${refId}.html`;
    return `<a href="${href}" class="ref-link">${U.esc(refItem.name || refItem.title)}<span class="ref-type">${U.TYPE_LABEL[refItem._type]}</span></a>`;
  }).filter(Boolean).join('\n          ');

  const backRefsBlock = backRefs
    ? `<div class="info-block"><h3>相关引用 (${lookup[art.id]?.reference_count || 0})</h3><div class="ref-list">${backRefs}</div></div>`
    : '';

  const tags = art.tags && art.tags.length
    ? `<div class="detail-tags">${art.tags.map(t => `<span class="seal-tag">${U.esc(t)}</span>`).join('')}</div>`
    : '';

  const content = `<div class="detail-header">
    <div class="detail-title-row">
      <h1>${U.esc(art.name)}</h1>
      <span class="detail-badge ${art.category}">${U.esc(art.type || '法宝')}</span>
    </div>
    ${aliases}
    <p class="detail-summary">${U.esc(art.summary || '')}</p>
    ${tags}
  </div>

  <div class="detail-body">
    <div class="detail-main">
      <div class="info-block">
        <h3>详细介绍</h3>
        <p class="detail-description">${U.esc(art.description || art.summary || '')}</p>
      </div>
      ${art.origin ? `<div class="info-block"><h3>来历</h3><p>${U.esc(art.origin)}</p></div>` : ''}
      ${appearsChapters}
      ${backRefsBlock}
    </div>
    <aside class="detail-sidebar">
      ${props}
      ${ownerBlock}
    </aside>
  </div>`;

  const html = U.renderPage({
    title: `${art.name} - ${siteConfig.site.name}`,
    description: art.summary || art.name,
    base,
    pageType: 'detail',
    nav: U.renderNav(base, 'artifacts'),
    breadcrumb: U.renderBreadcrumb(base, [
      { name: '首页', path: 'index.html' },
      { name: '法宝', path: 'artifacts/index.html' },
      { name: art.name, path: `artifacts/${art.id}.html` },
    ]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'artifacts', `${art.id}.html`), html);
  U.countPage();
}

// ============================================================
// 模板：台词列表页
// ============================================================
function buildQuoteList() {
  const base = BASE_SUB;  // 列表页在子目录中
  const { siteConfig } = data;

  // 按类型统计
  const typeMap = {};
  data.quotes.forEach(q => {
    const t = q.type || '其他';
    if (!typeMap[t]) typeMap[t] = 0;
    typeMap[t]++;
  });

  const filterBtns = Object.entries(typeMap).map(([type, count]) => {
    return `<button class="filter-tag" data-filter="${U.esc(type)}">${U.esc(type)} (${count})</button>`;
  }).join('\n    ');

  const cards = data.quotes.map(q => {
    const speakerName = q.speaker ? U.getNameById(q.speaker, lookup) : '旁白';
    return `<a href="${base}quotes/${q.id}.html" class="quote-card" data-category="${U.esc(q.type || '')}">
      <blockquote>"${U.esc(q.text)}"</blockquote>
      <cite>—— ${U.esc(speakerName)}</cite>
      <p class="quote-context">${U.esc(q.context || '').slice(0, 50)}...</p>
      <div class="quote-type">${U.esc(q.type || '')}</div>
    </a>`;
  }).join('\n      ');

  const content = `<div class="list-header">
    <h1>经典台词</h1>
    <p class="list-desc">经典台词与名场面收录，共 ${data.quotes.length} 条</p>
  </div>
  <div class="filter-bar">
    <button class="filter-tag active" data-filter="all">全部 (${data.quotes.length})</button>
    ${filterBtns}
  </div>
  <div class="quote-grid">
    ${cards}
  </div>`;

  const html = U.renderPage({
    title: `经典台词 - ${siteConfig.site.name}`,
    description: '《西游记》经典台词与名场面收录',
    base,
    pageType: 'list',
    nav: U.renderNav(base, 'quotes'),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '台词', path: 'quotes/index.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'quotes', 'index.html'), html);
  U.countPage();
}

// ============================================================
// 模板：台词详情页
// ============================================================
function buildQuoteDetail(q) {
  const base = BASE_SUB;
  const { siteConfig } = data;

  const speakerName = q.speaker ? U.getNameById(q.speaker, lookup) : '旁白';
  const speakerInLookup = q.speaker && lookup[q.speaker];
  const speakerLink = speakerInLookup
    ? `<a href="${base}characters/${q.speaker}.html" class="char-link">${U.esc(speakerName)}</a>`
    : U.esc(speakerName);

  // 章节链接
  const chapterLink = q.chapter
    ? `<a href="${base}chapters/chapter-${String(q.chapter).padStart(3, '0')}.html">第${toChineseNum(q.chapter)}回</a>`
    : '贯穿全书';

  // 相关人物
  const relatedChars = q.related_characters && q.related_characters.length
    ? `<div class="info-block"><h3>相关人物</h3><div class="ref-list">${q.related_characters.map(id => {
        const name = U.getNameById(id, lookup);
        if (lookup[id]) {
          return `<a href="${base}characters/${id}.html" class="ref-link">${U.esc(name)}<span class="ref-type">人物</span></a>`;
        }
        return `<span class="ref-link">${U.esc(name)}<span class="ref-type">人物</span></span>`;
      }).join('\n          ')}</div></div>`
    : '';

  // 相关事件
  const relatedEvents = q.related_events && q.related_events.length
    ? `<div class="info-block"><h3>相关事件</h3><ul class="event-list">${q.related_events.map(e => `<li>${U.esc(e)}</li>`).join('\n          ')}</ul></div>`
    : '';

  const tags = q.tags && q.tags.length
    ? `<div class="detail-tags">${q.tags.map(t => `<span class="seal-tag">${U.esc(t)}</span>`).join('')}</div>`
    : '';

  const content = `<div class="detail-header quote-detail-header">
    <blockquote class="big-quote">"${U.esc(q.text)}"</blockquote>
    <cite>—— ${speakerLink}</cite>
    ${tags}
  </div>

  <div class="detail-body">
    <div class="detail-main">
      ${q.context ? `<div class="info-block"><h3>台词背景</h3><p>${U.esc(q.context)}</p></div>` : ''}
      ${q.significance ? `<div class="info-block"><h3>意义解读</h3><p>${U.esc(q.significance)}</p></div>` : ''}
      ${relatedEvents}
    </div>
    <aside class="detail-sidebar">
      <div class="info-block">
        <h3>基本信息</h3>
        <dl class="attr-list">
          <dt>说话者</dt><dd>${speakerLink}</dd>
          <dt>章节</dt><dd>${chapterLink}</dd>
          ${q.location ? `<dt>地点</dt><dd>${U.esc(q.location)}</dd>` : ''}
          <dt>类型</dt><dd>${U.esc(q.type || '')}</dd>
          <dt>分类</dt><dd>${U.esc(q.category || '')}</dd>
        </dl>
      </div>
      ${relatedChars}
    </aside>
  </div>`;

  const html = U.renderPage({
    title: `"${q.text}" - ${siteConfig.site.name}`,
    description: q.context || q.text,
    base,
    pageType: 'detail',
    nav: U.renderNav(base, 'quotes'),
    breadcrumb: U.renderBreadcrumb(base, [
      { name: '首页', path: 'index.html' },
      { name: '台词', path: 'quotes/index.html' },
      { name: q.text.slice(0, 10) + '...', path: `quotes/${q.id}.html` },
    ]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'quotes', `${q.id}.html`), html);
  U.countPage();
}

// ============================================================
// 模板：搜索页
// ============================================================
function buildSearchPage() {
  const base = BASE_ROOT;
  const { siteConfig } = data;

  const content = `<div class="search-hero">
    <h1>全文搜索</h1>
    <p>搜索人物、章节、地点、法宝、台词</p>
  </div>

  <div class="search-wrapper">
    <div class="search-input-wrapper">
      <input type="text" id="searchInput" placeholder="输入关键词..." autocomplete="off">
      <button id="searchBtn" class="search-btn">搜索</button>
    </div>
    <div class="search-filters" id="searchFilters">
      <button class="filter-tag active" data-type="all">全部</button>
      <button class="filter-tag" data-type="characters">人物</button>
      <button class="filter-tag" data-type="chapters">章节</button>
      <button class="filter-tag" data-type="locations">地点</button>
      <button class="filter-tag" data-type="artifacts">法宝</button>
      <button class="filter-tag" data-type="quotes">台词</button>
    </div>
    <div class="search-results" id="searchResults">
      <div class="search-empty">输入关键词开始搜索</div>
    </div>
  </div>`;

  const html = U.renderPage({
    title: `搜索 - ${siteConfig.site.name}`,
    description: '全文搜索西游记知识库',
    base,
    pageType: 'search',
    nav: U.renderNav(base, 'search'),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '搜索', path: 'search.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
    extraHead: `<script src="${base}lib/lunr/lunr.min.js"></script>`,
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'search.html'), html);
  U.countPage();
}

// ============================================================
// 模板：关于页
// ============================================================
function buildAboutPage() {
  const base = BASE_ROOT;
  const { siteConfig } = data;

  const content = `<div class="about-page">
    <h1>关于本站</h1>
    <div class="info-block">
      <h3>项目简介</h3>
      <p>西游记知识库是一个以中国古典名著《西游记》为主题的结构化知识库网站，旨在系统整理小说中的人物、章节、地理、法宝、台词等信息，方便读者快速查询与深入研究。</p>
    </div>
    <div class="info-block">
      <h3>数据来源</h3>
      <p>本站所有内容均基于明代吴承恩著《西游记》原著（一百回本），数据经过人工整理与校对，力求准确可靠。</p>
    </div>
    <div class="info-block">
      <h3>内容统计</h3>
      <dl class="attr-list">
        <dt>人物</dt><dd>${siteConfig.stats.characters} 位</dd>
        <dt>章节</dt><dd>${siteConfig.stats.chapters} 回</dd>
        <dt>地点</dt><dd>${siteConfig.stats.locations} 个</dd>
        <dt>法宝</dt><dd>${siteConfig.stats.artifacts} 件</dd>
        <dt>台词</dt><dd>${siteConfig.stats.quotes} 条</dd>
      </dl>
    </div>
    <div class="info-block">
      <h3>技术说明</h3>
      <p>本站采用纯静态站点架构，使用 HTML + CSS + JavaScript 构建，数据以 JSON 格式结构化存储，支持全文搜索与人物关系图谱可视化。</p>
    </div>
    <div class="info-block">
      <h3>免责声明</h3>
      <p>本站内容仅供学习研究使用，不用于商业目的。《西游记》原著已进入公共领域。</p>
    </div>
  </div>`;

  const html = U.renderPage({
    title: `关于本站 - ${siteConfig.site.name}`,
    description: '关于西游记知识库',
    base,
    pageType: 'list',
    nav: U.renderNav(base, ''),
    breadcrumb: U.renderBreadcrumb(base, [{ name: '首页', path: 'index.html' }, { name: '关于', path: 'about.html' }]),
    content,
    footer: U.renderFooter(base, siteConfig),
  });

  U.writeFile(path.join(U.OUTPUT_DIR, 'about.html'), html);
  U.countPage();
}

// ============================================================
// 搜索索引生成
// ============================================================
function buildSearchIndex() {
  const index = [];

  for (const c of data.characters) {
    index.push({
      id: c.id,
      type: 'characters',
      typeLabel: '人物',
      name: c.name,
      aliases: c.aliases || [],
      summary: c.summary || '',
      description: (c.description || '').slice(0, 200),
      tags: c.tags || [],
      url: `characters/${c.id}.html`,
    });
  }

  for (const ch of data.chapters) {
    index.push({
      id: ch.id,
      type: 'chapters',
      typeLabel: '章节',
      name: `第${toChineseNum(ch.number)}回 ${ch.title}`,
      aliases: [ch.title_short],
      summary: ch.summary || '',
      description: '',
      tags: ch.tags || [],
      url: `chapters/${ch.id}.html`,
    });
  }

  for (const l of data.locations) {
    index.push({
      id: l.id,
      type: 'locations',
      typeLabel: '地点',
      name: l.name,
      aliases: l.aliases || [],
      summary: l.summary || '',
      description: (l.description || '').slice(0, 200),
      tags: l.tags || [],
      url: `locations/${l.id}.html`,
    });
  }

  for (const a of data.artifacts) {
    index.push({
      id: a.id,
      type: 'artifacts',
      typeLabel: '法宝',
      name: a.name,
      aliases: a.aliases || [],
      summary: a.summary || '',
      description: (a.description || '').slice(0, 200),
      tags: a.tags || [],
      url: `artifacts/${a.id}.html`,
    });
  }

  for (const q of data.quotes) {
    index.push({
      id: q.id,
      type: 'quotes',
      typeLabel: '台词',
      name: q.text,
      aliases: [],
      summary: q.context || '',
      description: q.significance || '',
      tags: q.tags || [],
      url: `quotes/${q.id}.html`,
    });
  }

  U.writeFile(path.join(U.OUTPUT_DIR, 'data', 'search-index.json'), JSON.stringify(index, null, 2));
  console.log(`  ✓ search-index.json (${index.length} 条)`);
}

// ============================================================
// 关系图谱数据生成
// ============================================================
function buildGlobalGraphData() {
  const categories = [
    { name: '取经师徒' },
    { name: '天庭神仙' },
    { name: '佛门菩萨' },
    { name: '妖魔鬼怪' },
    { name: '凡间人物' },
  ];

  const catIndex = {
    'main-character': 0,
    'immortal': 1,
    'buddha': 2,
    'demon': 3,
    'mortal': 4,
  };

  const nodes = data.characters.map(c => ({
    id: c.id,
    name: c.name,
    category: catIndex[c.category] !== undefined ? catIndex[c.category] : 4,
    value: lookup[c.id]?.reference_count || 0,
    symbolSize: Math.max(20, Math.min(60, (lookup[c.id]?.reference_count || 0) * 3 + 20)),
  }));

  const nodeIds = new Set(nodes.map(n => n.id));
  const links = [];
  const linkSet = new Set();

  for (const c of data.characters) {
    if (!c.relationships) continue;
    for (const r of c.relationships) {
      if (!nodeIds.has(r.target)) continue;
      const key = [c.id, r.target].sort().join('-');
      if (linkSet.has(key)) continue;
      linkSet.add(key);
      links.push({
        source: c.id,
        target: r.target,
        value: r.type,
      });
    }
  }

  const graphData = { nodes, links, categories };
  U.writeFile(path.join(U.OUTPUT_DIR, 'data', 'graph-data.json'), JSON.stringify(graphData, null, 2));
  console.log(`  ✓ graph-data.json (${nodes.length} 节点, ${links.length} 边)`);
}

// 单人物关系图谱数据
function buildCharGraphData(char) {
  const categories = [
    { name: '本人' },
    { name: '关联人物' },
  ];

  const nodes = [{ id: char.id, name: char.name, category: 0, symbolSize: 50 }];
  const links = [];
  const nodeIds = new Set([char.id]);

  if (char.relationships) {
    for (const r of char.relationships) {
      const target = lookup[r.target];
      if (!target || target._type !== 'characters') continue;
      if (nodeIds.has(r.target)) continue;
      nodeIds.add(r.target);
      nodes.push({
        id: r.target,
        name: target.name,
        category: 1,
        symbolSize: 35,
      });
      links.push({ source: char.id, target: r.target, value: r.type });
    }
  }

  return { nodes, links, categories };
}

// ============================================================
// 辅助函数
// ============================================================
function charCategoryLabel(cat) {
  const labels = {
    'main-character': '取经师徒',
    'immortal': '天庭神仙',
    'buddha': '佛门菩萨',
    'demon': '妖魔鬼怪',
    'mortal': '凡间人物',
  };
  return labels[cat] || '人物';
}

function toChineseNum(num) {
  if (typeof num !== 'number') return num;
  if (num === 0) return '零';
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百'];
  
  if (num < 10) return digits[num];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    if (tens === 1) return ones === 0 ? '十' : '十' + digits[ones];
    return digits[tens] + '十' + (ones === 0 ? '' : digits[ones]);
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rest = num % 100;
    let result = digits[hundreds] + '百';
    if (rest === 0) return result;
    if (rest < 10) return result + '零' + digits[rest];
    if (rest < 20) return result + '一十' + (rest % 10 === 0 ? '' : digits[rest % 10]);
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    return result + digits[tens] + '十' + (ones === 0 ? '' : digits[ones]);
  }
  return String(num);
}

// ============================================================
// 主构建流程
// ============================================================
function build() {
  console.log('=== 西游记知识库静态站点构建 ===\n');

  // 1. 首页
  console.log('[1/8] 构建首页...');
  buildHome();
  console.log(`  ✓ index.html`);

  // 2. 列表页
  console.log('[2/8] 构建列表页...');
  buildCharacterList();
  console.log(`  ✓ characters/index.html`);
  buildChapterList();
  console.log(`  ✓ chapters/index.html`);
  buildLocationList();
  console.log(`  ✓ locations/index.html`);
  buildArtifactList();
  console.log(`  ✓ artifacts/index.html`);
  buildQuoteList();
  console.log(`  ✓ quotes/index.html`);

  // 3. 人物详情页
  console.log('[3/8] 构建人物详情页...');
  for (const c of data.characters) {
    buildCharacterDetail(c);
  }
  console.log(`  ✓ ${data.characters.length} 个人物详情页`);

  // 4. 章节详情页
  console.log('[4/8] 构建章节详情页...');
  for (const ch of data.chapters) {
    buildChapterDetail(ch);
  }
  console.log(`  ✓ ${data.chapters.length} 个章节详情页`);

  // 5. 地点详情页
  console.log('[5/8] 构建地点详情页...');
  for (const l of data.locations) {
    buildLocationDetail(l);
  }
  console.log(`  ✓ ${data.locations.length} 个地点详情页`);

  // 6. 法宝详情页
  console.log('[6/8] 构建法宝详情页...');
  for (const a of data.artifacts) {
    buildArtifactDetail(a);
  }
  console.log(`  ✓ ${data.artifacts.length} 个法宝详情页`);

  // 7. 台词详情页 + 搜索/关于页
  console.log('[7/8] 构建台词详情页与功能页...');
  for (const q of data.quotes) {
    buildQuoteDetail(q);
  }
  console.log(`  ✓ ${data.quotes.length} 个台词详情页`);
  buildSearchPage();
  console.log(`  ✓ search.html`);
  buildAboutPage();
  console.log(`  ✓ about.html`);

  // 8. 搜索索引 + 图谱数据
  console.log('[8/8] 生成搜索索引与图谱数据...');
  buildSearchIndex();
  buildGlobalGraphData();

  console.log(`\n=== 构建完成！共生成 ${U.getPageCount()} 个 HTML 页面 ===`);
}

// 运行
build();
