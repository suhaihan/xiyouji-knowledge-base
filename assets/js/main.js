/**
 * main.js - 首页与列表页交互
 * 搜索跳转、分类筛选、动画入场
 */
(function() {
  'use strict';

  // ---- 首页搜索跳转 ----
  var heroInput = document.getElementById('heroSearchInput');
  var heroBtn = document.getElementById('heroSearchBtn');
  
  function doHeroSearch() {
    var q = (heroInput && heroInput.value || '').trim();
    if (q) {
      window.location.href = 'search.html?q=' + encodeURIComponent(q);
    }
  }

  if (heroBtn) heroBtn.addEventListener('click', doHeroSearch);
  if (heroInput) {
    heroInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doHeroSearch();
    });
  }

  // ---- 列表页筛选 ----
  var filterTags = document.querySelectorAll('.filter-tag[data-filter]');
  if (filterTags.length) {
    filterTags.forEach(function(tag) {
      tag.addEventListener('click', function() {
        // 更新激活状态
        filterTags.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');

        var filter = this.getAttribute('data-filter');

        // 通用 grid 查找：支持所有列表页类型
        var grid = document.querySelector(
          '.char-grid, .loc-grid, .artifact-grid, .quote-grid, .chapter-grid'
        );
        if (!grid) return;

        // 通用卡片选择器
        var cards = grid.querySelectorAll(
          '.char-card, .loc-card, .artifact-card, .quote-card, .chapter-card'
        );

        cards.forEach(function(card) {
          if (filter === 'all') {
            card.style.display = '';
          } else {
            // 优先使用 data-category 属性
            var dataCat = card.getAttribute('data-category');
            if (dataCat) {
              card.style.display = (dataCat === filter) ? '' : 'none';
              return;
            }

            // 回退到 badge 类名匹配
            var badge = card.querySelector(
              '.char-badge, .loc-badge, .art-badge, .quote-type'
            );
            if (badge) {
              // 检查类名中是否包含 filter 值
              var className = badge.getAttribute('class') || '';
              // 检查文本内容是否匹配（用于 quote-type 等使用文本而非类名的场景）
              var textContent = (badge.textContent || '').trim();

              if (className.indexOf(filter) > -1 || textContent === filter) {
                card.style.display = '';
              } else {
                card.style.display = 'none';
              }
            } else {
              card.style.display = 'none';
            }
          }
        });
      });
    });
  }

  // ---- 卡片入场动画 ----
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '50px' });

    document.querySelectorAll('.char-card, .chapter-card, .loc-card, .artifact-card, .quote-card, .cat-card, .stat-card').forEach(function(el) {
      observer.observe(el);
    });
  }

  // ---- 读取 URL 参数自动搜索 ----
  var urlParams = new URLSearchParams(window.location.search);
  var query = urlParams.get('q');
  if (query) {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = query;
      // 触发搜索
      setTimeout(function() {
        var btn = document.getElementById('searchBtn');
        if (btn) btn.click();
      }, 300);
    }
  }

})();
