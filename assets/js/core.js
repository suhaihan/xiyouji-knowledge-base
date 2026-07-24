/**
 * core.js - 全局核心交互
 * 移动端菜单、Header滚动效果、导航高亮
 */
(function() {
  'use strict';

  // ---- 移动端汉堡菜单 ----
  var hamburger = document.getElementById('hamburger');
  var mainNav = document.getElementById('mainNav');
  
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      mainNav.classList.toggle('open');
    });

    // 点击导航链接后关闭菜单
    mainNav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        mainNav.classList.remove('open');
      });
    });
  }

  // ---- Header 滚动阴影 ----
  var header = document.getElementById('siteHeader');
  if (header) {
    var lastScroll = 0;
    window.addEventListener('scroll', function() {
      var scroll = window.pageYOffset || document.documentElement.scrollTop;
      if (scroll > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = scroll;
    }, { passive: true });
  }

  // ---- 导航高亮（基于当前路径） ----
  (function highlightNav() {
    var path = window.location.pathname;
    var links = document.querySelectorAll('.nav-link');
    if (!links.length) return;

    // 提取当前路径的一级目录
    var match = path.match(/\/([^\/]+?)\//);
    var currentDir = match ? match[1] : '';
    
    // 首页特殊处理
    if (path === '/' || path.endsWith('/index.html') && !currentDir) {
      var homeLink = document.querySelector('.nav-link[href*="index.html"]');
      if (homeLink && !homeLink.classList.contains('active')) {
        links.forEach(function(l) { l.classList.remove('active'); });
        homeLink.classList.add('active');
      }
      return;
    }

    links.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf(currentDir) > -1 && currentDir) {
        link.classList.add('active');
      }
    });
  })();

  // ---- 平滑滚动 ----
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target && this.getAttribute('href') !== '#') {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---- 返回顶部 ----
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });
    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

})();
