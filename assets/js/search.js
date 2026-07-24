/**
 * search.js - 全文搜索功能
 * 基于 Lunr.js + 中文双字 N-gram 分词
 */
(function() {
  'use strict';

  var searchInput = document.getElementById('searchInput');
  var searchBtn = document.getElementById('searchBtn');
  var searchResults = document.getElementById('searchResults');
  var filterButtons = document.querySelectorAll('.search-filters .filter-tag');
  
  if (!searchInput || !searchResults) return;

  var lunrIndex = null;
  var documents = [];
  var currentFilter = 'all';
  var searchDebounceTimer = null;

  // ---- 中文 N-gram 分词器 ----
  function chineseBigramTokenizer(text) {
    if (!text) return [];
    var str = String(text).toLowerCase();
    var tokens = [];

    // 提取连续的中文字符段和拉丁字符段
    var segments = str.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];

    for (var seg of segments) {
      // 检测是否包含中文字符
      var hasChinese = /[\u4e00-\u9fff]/.test(seg);
      
      if (hasChinese) {
        // 中文：生成单字和双字组合
        for (var i = 0; i < seg.length; i++) {
          tokens.push(seg[i]); // 单字
          if (i < seg.length - 1) {
            tokens.push(seg[i] + seg[i + 1]); // 双字
          }
          if (i < seg.length - 2) {
            tokens.push(seg[i] + seg[i + 1] + seg[i + 2]); // 三字（提高召回）
          }
        }
      } else {
        // 拉丁字符：直接作为 token
        tokens.push(seg);
      }
    }

    return tokens.filter(function(t) { return t.length > 0; });
  }

  // ---- 构建搜索索引 ----
  function buildIndex(data) {
    documents = data;

    // 注册全局中文分词器（必须在构建索引前设置）
    // Lunr.js 2.x 要求分词器返回 lunr.Token 对象
    lunr.tokenizer = function(obj) {
      var rawTokens;
      if (!obj) {
        rawTokens = [];
      } else if (typeof obj === 'string') {
        rawTokens = chineseBigramTokenizer(obj);
      } else if (Array.isArray(obj)) {
        rawTokens = [];
        for (var i = 0; i < obj.length; i++) {
          rawTokens = rawTokens.concat(chineseBigramTokenizer(obj[i]));
        }
      } else {
        rawTokens = [];
      }
      // 包装为 lunr.Token 对象
      return rawTokens.map(function(t, i) {
        return new lunr.Token(t, { position: [i, t.length] });
      });
    };

    lunrIndex = lunr(function() {
      this.ref('id');
      this.field('name', { boost: 10 });
      this.field('aliases', { boost: 5 });
      this.field('summary', { boost: 3 });
      this.field('description');
      this.field('tags', { boost: 2 });
      this.field('typeLabel', { boost: 4 });
      this.metadataWhitelist = ['position'];

      // 重置 pipeline，移除默认的 trimmer/stopWordFilter/stemmer
      // 这些函数针对英文设计，trimmer 的 \W 正则会误删中文字符
      this.pipeline.reset();
      this.searchPipeline.reset();

      data.forEach(function(doc) {
        this.add({
          id: doc.id,
          name: doc.name,
          aliases: doc.aliases || [],
          summary: doc.summary || '',
          description: doc.description || '',
          tags: doc.tags || [],
          typeLabel: doc.typeLabel || '',
        });
      }, this);
    });
  }

  // ---- 执行搜索 ----
  function doSearch(query) {
    if (!lunrIndex || !query.trim()) {
      searchResults.innerHTML = '<div class="search-empty">输入关键词开始搜索</div>';
      return;
    }

    // 对查询词也进行 N-gram 处理
    var queryTokens = chineseBigramTokenizer(query);

    // 优化：多字查询时优先使用双字/三字 token，避免单字 token 造成过多假阳性
    // 例如 "量子力学" 不应匹配包含"学""力"等单字的文档
    var multiCharTokens = queryTokens.filter(function(t) { return t.length >= 2; });
    var searchQuery;
    if (multiCharTokens.length > 0) {
      // 有双字以上 token 时，用它们作为主要查询条件
      searchQuery = multiCharTokens.join(' ');
    } else if (queryTokens.length > 0) {
      // 只有单字 token（如单字搜索"猴"），用全部 token
      searchQuery = queryTokens.join(' ');
    } else {
      // 分词后为空，用原始查询
      searchQuery = query;
    }

    var results;
    try {
      results = lunrIndex.search(searchQuery);
    } catch(e) {
      // 如果搜索出错，尝试模糊搜索
      try {
        results = lunrIndex.search(query + '*');
      } catch(e2) {
        results = [];
      }
    }

    // 按类型过滤
    if (currentFilter !== 'all') {
      results = results.filter(function(r) {
        var doc = documents.find(function(d) { return d.id === r.ref; });
        return doc && doc.type === currentFilter;
      });
    }

    // 渲染结果
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-empty">未找到相关结果，试试其他关键词？</div>';
      return;
    }

    var html = '<div class="search-result-count">找到 ' + results.length + ' 条结果</div>';
    
    html += results.slice(0, 50).map(function(r) {
      var doc = documents.find(function(d) { return d.id === r.ref; });
      if (!doc) return '';

      var typeClass = 'type-' + doc.type;
      var summary = doc.summary || doc.description || '';
      if (summary.length > 100) summary = summary.slice(0, 100) + '...';

      // 高亮关键词
      var nameHighlighted = highlightText(doc.name, query);
      var summaryHighlighted = highlightText(summary, query);

      return '<div class="search-result-card">' +
        '<div class="result-header">' +
          '<a href="' + doc.url + '" class="result-title">' + nameHighlighted + '</a>' +
          '<span class="result-type ' + typeClass + '">' + doc.typeLabel + '</span>' +
        '</div>' +
        '<p class="result-summary">' + summaryHighlighted + '</p>' +
        (doc.aliases && doc.aliases.length ? '<p class="result-aliases">别名: ' + doc.aliases.join('、') + '</p>' : '') +
      '</div>';
    }).join('');

    searchResults.innerHTML = html;
  }

  // ---- 关键词高亮 ----
  function highlightText(text, query) {
    if (!text || !query) return text || '';
    var result = text;
    
    // 对查询词中的每个字符进行高亮
    var chars = query.split('');
    chars.forEach(function(ch) {
      if (ch.trim() && /[\u4e00-\u9fff a-zA-Z0-9]/.test(ch)) {
        var regex = new RegExp('(' + escapeRegExp(ch) + ')', 'gi');
        result = result.replace(regex, '<mark>$1</mark>');
      }
    });

    // 也高亮完整查询词
    if (query.length > 1) {
      var regex2 = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
      result = result.replace(regex2, '<mark class="exact">$1</mark>');
    }

    return result;
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ---- 事件绑定 ----
  function performSearch() {
    var q = searchInput.value.trim();
    doSearch(q);
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(performSearch, 300);
    });
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') performSearch();
    });
  }

  // 类型筛选
  filterButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterButtons.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      currentFilter = this.getAttribute('data-type');
      performSearch();
    });
  });

  // ---- 加载索引数据 ----
  function loadIndex() {
    if (typeof lunr === 'undefined') {
      searchResults.innerHTML = '<div class="search-empty">搜索引擎加载失败，请刷新页面重试</div>';
      return;
    }

    // 确定 base path
    var path = window.location.pathname;
    var base = './';
    if (path.indexOf('/characters/') > -1 || path.indexOf('/chapters/') > -1 ||
        path.indexOf('/locations/') > -1 || path.indexOf('/artifacts/') > -1 ||
        path.indexOf('/quotes/') > -1) {
      base = '../';
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + 'data/search-index.json', true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          buildIndex(data);
          
          // 检查 URL 参数自动搜索
          var urlParams = new URLSearchParams(window.location.search);
          var q = urlParams.get('q');
          if (q) {
            searchInput.value = q;
            performSearch();
          }
        } catch(e) {
          searchResults.innerHTML = '<div class="search-empty">搜索索引加载失败: ' + e.message + '</div>';
        }
      } else {
        searchResults.innerHTML = '<div class="search-empty">搜索索引加载失败 (HTTP ' + xhr.status + ')</div>';
      }
    };
    xhr.onerror = function() {
      searchResults.innerHTML = '<div class="search-empty">无法加载搜索索引，请检查网络连接</div>';
    };
    xhr.send();
  }

  // 初始化
  loadIndex();

})();
