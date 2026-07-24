/**
 * graph.js - 人物关系图谱可视化
 * 基于 ECharts 5.x 力导向图
 */
(function() {
  'use strict';

  // 等待 ECharts 加载
  function waitForEcharts(callback) {
    if (typeof echarts !== 'undefined') {
      callback();
    } else {
      setTimeout(function() { waitForEcharts(callback); }, 100);
    }
  }

  // 颜色方案（对应 CSS 设计系统的国风配色）
  var CATEGORY_COLORS = [
    '#C41E3A', // 取经师徒 - 朱红
    '#D4A574', // 天庭神仙 - 鎏金
    '#8B6914', // 佛门菩萨 - 暗金
    '#2C3E50', // 妖魔鬼怪 - 墨黑
    '#6B7B8C', // 凡间人物 - 灰蓝
    '#4A6B7C', // 本人 - 深青
    '#7B8B6F', // 关联人物 - 橄榄
  ];

  function initGraph(container, graphData) {
    if (!container || !graphData || !graphData.nodes || graphData.nodes.length === 0) return;

    var chart = echarts.init(container);

    // 处理节点数据
    var nodes = graphData.nodes.map(function(node) {
      return {
        id: node.id,
        name: node.name,
        symbolSize: node.symbolSize || 30,
        category: node.category || 0,
        value: node.value || 0,
        itemStyle: {
          color: CATEGORY_COLORS[node.category] || CATEGORY_COLORS[0],
          borderColor: '#FAF7F2',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'bottom',
          fontSize: 12,
          color: '#2C3E50',
          fontWeight: 'bold',
        },
      };
    });

    // 处理边数据
    var links = graphData.links.map(function(link) {
      return {
        source: link.source,
        target: link.target,
        value: link.value || '',
        lineStyle: {
          color: '#D4A574',
          width: 1.5,
          opacity: 0.6,
          curveness: 0.2,
        },
        label: {
          show: true,
          formatter: link.value || '',
          fontSize: 10,
          color: '#8B6914',
          backgroundColor: 'rgba(250, 247, 242, 0.85)',
          padding: [2, 4],
          borderRadius: 3,
        },
      };
    });

    // 分类
    var categories = (graphData.categories || []).map(function(cat, i) {
      return { name: cat.name };
    });

    var option = {
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          if (params.dataType === 'node') {
            var refs = params.data.value || 0;
            return '<b>' + params.data.name + '</b><br/>被引用: ' + refs + ' 次';
          } else if (params.dataType === 'edge') {
            return params.data.value || '关联';
          }
          return params.name;
        },
        backgroundColor: 'rgba(250, 247, 242, 0.95)',
        borderColor: '#D4A574',
        borderWidth: 1,
        textStyle: { color: '#2C3E50', fontSize: 13 },
      },
      legend: {
        show: categories.length > 1,
        data: categories.map(function(c) { return c.name; }),
        bottom: 10,
        textStyle: { color: '#2C3E50', fontSize: 12 },
      },
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        categories: categories,
        roam: true,
        draggable: true,
        force: {
          repulsion: 300,
          edgeLength: [80, 200],
          gravity: 0.1,
          layoutAnimation: true,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 3,
            opacity: 1,
          },
          label: {
            fontSize: 14,
          },
        },
        lineStyle: {
          color: '#D4A574',
          curveness: 0.2,
        },
        label: {
          show: true,
          position: 'bottom',
        },
      }],
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
    };

    chart.setOption(option);

    // 节点点击跳转
    chart.on('click', function(params) {
      if (params.dataType === 'node' && params.data.id) {
        // 确定相对路径
        var path = window.location.pathname;
        var base = './';
        if (path.indexOf('/characters/') > -1) {
          base = '../';
        }
        window.location.href = base + 'characters/' + params.data.id + '.html';
      }
    });

    // 响应式
    window.addEventListener('resize', function() {
      chart.resize();
    });

    return chart;
  }

  // 初始化单人物关系图
  function initCharGraph() {
    var container = document.getElementById('relationGraph');
    if (!container) return;

    waitForEcharts(function() {
      if (window.__charGraphData) {
        initGraph(container, window.__charGraphData);
      }
    });
  }

  // 初始化全局关系图（如果页面有对应容器）
  function initGlobalGraph() {
    var container = document.getElementById('globalGraph');
    if (!container) return;

    waitForEcharts(function() {
      // 加载全局图谱数据
      var path = window.location.pathname;
      var base = './';
      if (path.indexOf('/characters/') > -1 || path.indexOf('/chapters/') > -1) {
        base = '../';
      }

      var xhr = new XMLHttpRequest();
      xhr.open('GET', base + 'data/graph-data.json', true);
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            initGraph(container, data);
          } catch(e) {
            container.innerHTML = '<p>图谱数据加载失败</p>';
          }
        }
      };
      xhr.send();
    });
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initCharGraph();
      initGlobalGraph();
    });
  } else {
    initCharGraph();
    initGlobalGraph();
  }

})();
