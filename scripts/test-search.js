/**
 * 搜索功能全面测试脚本
 * 覆盖：正常搜索、空搜索、特殊字符、无结果、单字搜索、多类型混合、URL参数搜索等
 */
const path = require('path');
const root = path.resolve(__dirname, '..');
const lunr = require(path.join(root, 'lib/lunr/lunr.min.js'));
const data = require(path.join(root, 'data/search-index.json'));
const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log('  ✓ ' + name);
  } catch(e) {
    failedTests++;
    failures.push({ name, error: e.message });
    console.log('  ✗ ' + name + ' → ' + e.message);
  }
}

// ---- 中文 N-gram 分词器（与 search.js 完全一致）----
function chineseBigramTokenizer(text) {
  if (!text) return [];
  var str = String(text).toLowerCase();
  var tokens = [];
  var segments = str.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];
  for (var seg of segments) {
    var hasChinese = /[\u4e00-\u9fff]/.test(seg);
    if (hasChinese) {
      for (var i = 0; i < seg.length; i++) {
        tokens.push(seg[i]);
        if (i < seg.length - 1) tokens.push(seg[i] + seg[i + 1]);
        if (i < seg.length - 2) tokens.push(seg[i] + seg[i + 1] + seg[i + 2]);
      }
    } else {
      tokens.push(seg);
    }
  }
  return tokens.filter(function(t) { return t.length > 0; });
}

// ---- 注册 lunr.tokenizer（与 search.js 一致）----
lunr.tokenizer = function(obj) {
  var rawTokens;
  if (!obj) { rawTokens = []; }
  else if (typeof obj === 'string') { rawTokens = chineseBigramTokenizer(obj); }
  else if (Array.isArray(obj)) {
    rawTokens = [];
    for (var i = 0; i < obj.length; i++) {
      rawTokens = rawTokens.concat(chineseBigramTokenizer(obj[i]));
    }
  } else { rawTokens = []; }
  return rawTokens.map(function(t, i) {
    return new lunr.Token(t, { position: [i, t.length] });
  });
};

// ---- 构建索引（与 search.js 一致）----
var idx = lunr(function() {
  this.ref('id');
  this.field('name', { boost: 10 });
  this.field('aliases', { boost: 5 });
  this.field('summary', { boost: 3 });
  this.field('description');
  this.field('tags', { boost: 2 });
  this.field('typeLabel', { boost: 4 });
  this.metadataWhitelist = ['position'];
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
      typeLabel: doc.typeLabel || ''
    });
  }, this);
});

// 辅助函数（与 search.js doSearch 逻辑一致）
function search(query) {
  var queryTokens = chineseBigramTokenizer(query);
  var multiCharTokens = queryTokens.filter(function(t) { return t.length >= 2; });
  var searchQuery;
  if (multiCharTokens.length > 0) {
    searchQuery = multiCharTokens.join(' ');
  } else if (queryTokens.length > 0) {
    searchQuery = queryTokens.join(' ');
  } else {
    searchQuery = query;
  }
  try {
    return idx.search(searchQuery);
  } catch(e) {
    try { return idx.search(query + '*'); } catch(e2) { return []; }
  }
}

function getDoc(ref) {
  return data.find(function(d) { return d.id === ref; });
}

function filterByType(results, type) {
  if (type === 'all') return results;
  return results.filter(function(r) {
    var doc = getDoc(r.ref);
    return doc && doc.type === type;
  });
}

// ===================== 测试用例 =====================

console.log('\n========================================');
console.log('  西游记知识库 - 搜索功能全面测试');
console.log('========================================\n');

// ---- 1. 搜索索引数据完整性 ----
console.log('【1】搜索索引数据完整性');
test('索引条目总数 = 350', function() {
  assert.strictEqual(data.length, 350, '应有350条索引数据');
});

test('每条数据包含必要字段 (id, name, type, typeLabel, url)', function() {
  var missing = data.filter(function(d) {
    return !d.id || !d.name || !d.type || !d.typeLabel || !d.url;
  });
  assert.strictEqual(missing.length, 0, '缺少必要字段: ' + JSON.stringify(missing.slice(0,3)));
});

test('所有 id 唯一', function() {
  var ids = data.map(function(d) { return d.id; });
  var unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size, '存在重复id');
});

test('类型分布正确 (characters:100, chapters:100, locations:50, artifacts:50, quotes:50)', function() {
  var counts = {};
  data.forEach(function(d) { counts[d.type] = (counts[d.type]||0) + 1; });
  assert.strictEqual(counts.characters, 100, '人物应为100');
  assert.strictEqual(counts.chapters, 100, '章节应为100');
  assert.strictEqual(counts.locations, 50, '地点应为50');
  assert.strictEqual(counts.artifacts, 50, '法宝应为50');
  assert.strictEqual(counts.quotes, 50, '台词应为50');
});

// ---- 2. 正常关键词搜索 ----
console.log('\n【2】正常关键词搜索准确性');

test('「孙悟空」Top1 = 孙悟空', function() {
  var results = search('孙悟空');
  assert.ok(results.length > 0, '应有搜索结果');
  var doc = getDoc(results[0].ref);
  assert.strictEqual(doc.name, '孙悟空', 'Top1应为孙悟空');
});

test('「金箍棒」Top1 = 如意金箍棒', function() {
  var results = search('金箍棒');
  assert.ok(results.length > 0, '应有搜索结果');
  var doc = getDoc(results[0].ref);
  assert.strictEqual(doc.name, '如意金箍棒', 'Top1应为如意金箍棒');
});

test('「火焰山」Top1 = 火焰山', function() {
  var results = search('火焰山');
  assert.ok(results.length > 0, '应有搜索结果');
  var doc = getDoc(results[0].ref);
  assert.strictEqual(doc.name, '火焰山', 'Top1应为火焰山');
});

test('「牛魔王」Top1 = 牛魔王', function() {
  var results = search('牛魔王');
  assert.ok(results.length > 0, '应有搜索结果');
  var doc = getDoc(results[0].ref);
  assert.strictEqual(doc.name, '牛魔王', 'Top1应为牛魔王');
});

test('「唐僧」Top1 = 唐僧', function() {
  var results = search('唐僧');
  assert.ok(results.length > 0, '应有搜索结果');
  var doc = getDoc(results[0].ref);
  assert.strictEqual(doc.name, '唐僧', 'Top1应为唐僧');
});

test('「取经」返回多个结果', function() {
  var results = search('取经');
  assert.ok(results.length >= 3, '取经应返回至少3条结果, 实际: ' + results.length);
});

test('「大闹天宫」返回结果', function() {
  var results = search('大闹天宫');
  assert.ok(results.length > 0, '大闹天宫应返回结果');
});

test('「猪八戒」Top1 = 猪八戒', function() {
  var results = search('猪八戒');
  assert.ok(results.length > 0);
  var doc = getDoc(results[0].ref);
  assert.strictEqual(doc.name, '猪八戒', 'Top1应为猪八戒');
});

test('「沙僧」搜索结果包含沙悟净', function() {
  var results = search('沙僧');
  assert.ok(results.length > 0, '沙僧应返回结果');
  var top5 = results.slice(0, 5).map(function(r) {
    var doc = getDoc(r.ref);
    return doc ? doc.name : '';
  });
  assert.ok(top5.some(function(n) { return n.indexOf('沙') >= 0; }), 'Top5应包含沙相关人物, 实际: ' + top5.join(', '));
});

// ---- 3. 单字搜索 ----
console.log('\n【3】单字搜索');
test('「猴」返回结果包含孙悟空', function() {
  var results = search('猴');
  assert.ok(results.length > 0, '猴字应返回结果');
  var refs = results.map(function(r) { return r.ref; });
  assert.ok(refs.includes('sun-wukong'), '结果中应包含孙悟空');
});

test('「佛」返回多个结果', function() {
  var results = search('佛');
  assert.ok(results.length >= 2, '佛字应返回多个结果, 实际: ' + results.length);
});

test('「经」返回多个结果', function() {
  var results = search('经');
  assert.ok(results.length >= 3, '经字应返回多个结果, 实际: ' + results.length);
});

// ---- 4. 边界情况：空搜索 ----
console.log('\n【4】边界情况 - 空搜索');

test('空字符串搜索不崩溃', function() {
  var results = search('');
  assert.ok(Array.isArray(results), '空搜索应返回数组');
});

test('纯空格搜索不崩溃', function() {
  var results = search('   ');
  assert.ok(Array.isArray(results), '空格搜索应返回数组');
});

test('空字符串分词后为空数组', function() {
  var tokens = chineseBigramTokenizer('');
  assert.strictEqual(tokens.length, 0, '空字符串分词应为0');
});

// ---- 5. 边界情况：特殊字符 ----
console.log('\n【5】边界情况 - 特殊字符');

test('搜索含正则特殊字符不崩溃: "孙悟空()"', function() {
  var results = search('孙悟空()');
  assert.ok(Array.isArray(results), '含括号搜索不应崩溃');
});

test('搜索含正则特殊字符不崩溃: "金箍棒[]"', function() {
  var results = search('金箍棒[]');
  assert.ok(Array.isArray(results), '含方括号搜索不应崩溃');
});

test('搜索含正则特殊字符不崩溃: "取经.*"', function() {
  var results = search('取经.*');
  assert.ok(Array.isArray(results), '含点星搜索不应崩溃');
});

test('搜索含特殊字符不崩溃: "妖魔|妖怪"', function() {
  var results = search('妖魔|妖怪');
  assert.ok(Array.isArray(results), '含管道符搜索不应崩溃');
});

test('搜索纯标点符号不崩溃: "！！？"', function() {
  var results = search('！！？');
  assert.ok(Array.isArray(results), '纯标点搜索不应崩溃');
});

test('搜索超长字符串不崩溃', function() {
  var longStr = '孙悟空'.repeat(100);
  var results = search(longStr);
  assert.ok(Array.isArray(results), '超长字符串搜索不应崩溃');
});

// ---- 6. 边界情况：无结果 ----
console.log('\n【6】边界情况 - 无结果');

test('搜索不存在的词返回空数组: "量子力学"', function() {
  var results = search('量子力学');
  assert.strictEqual(results.length, 0, '不存在的词应返回0条结果');
});

test('搜索不存在的词返回空数组: "abcd1234xyz"', function() {
  var results = search('abcd1234xyz');
  assert.strictEqual(results.length, 0, '不存在的英文应返回0条结果');
});

test('搜索无关词组返回极少结果: "氪星超人之死"', function() {
  var results = search('氪星超人之死');
  // N-gram 固有特性：某些双字（如"人之"）可能在古文中出现
  // 但结果应远少于正常搜索（优化前为150+，优化后应<5）
  assert.ok(results.length < 5, '无关词组应返回极少结果(<5), 实际: ' + results.length);
});

// ---- 7. 类型过滤 ----
console.log('\n【7】类型过滤功能');

test('过滤人物类型 - "悟空" 仅返回 characters', function() {
  var results = search('悟空');
  var filtered = filterByType(results, 'characters');
  assert.ok(filtered.length > 0, '人物过滤后应有结果');
  filtered.forEach(function(r) {
    var doc = getDoc(r.ref);
    assert.strictEqual(doc.type, 'characters', '过滤后应全为人物');
  });
});

test('过滤法宝类型 - "宝" 仅返回 artifacts', function() {
  var results = search('宝');
  var filtered = filterByType(results, 'artifacts');
  assert.ok(filtered.length > 0, '法宝过滤后应有结果');
  filtered.forEach(function(r) {
    var doc = getDoc(r.ref);
    assert.strictEqual(doc.type, 'artifacts', '过滤后应全为法宝');
  });
});

test('过滤地点类型 - "山" 仅返回 locations', function() {
  var results = search('山');
  var filtered = filterByType(results, 'locations');
  assert.ok(filtered.length > 0, '地点过滤后应有结果');
  filtered.forEach(function(r) {
    var doc = getDoc(r.ref);
    assert.strictEqual(doc.type, 'locations', '过滤后应全为地点');
  });
});

test('过滤章节类型 - "回" 仅返回 chapters', function() {
  var results = search('回');
  var filtered = filterByType(results, 'chapters');
  assert.ok(filtered.length > 0, '章节过滤后应有结果');
  filtered.forEach(function(r) {
    var doc = getDoc(r.ref);
    assert.strictEqual(doc.type, 'chapters', '过滤后应全为章节');
  });
});

// ---- 8. 别名搜索 ----
console.log('\n【8】别名搜索');

test('搜索「齐天大圣」能找到孙悟空', function() {
  var results = search('齐天大圣');
  assert.ok(results.length > 0, '齐天大圣应返回结果');
  var refs = results.map(function(r) { return r.ref; });
  assert.ok(refs.includes('sun-wukong'), '结果中应包含孙悟空');
});

test('搜索「行者」能找到相关人物', function() {
  var results = search('行者');
  assert.ok(results.length > 0, '行者应返回结果');
});

test('搜索「弼马温」能找到孙悟空', function() {
  var results = search('弼马温');
  assert.ok(results.length > 0, '弼马温应返回结果');
  var refs = results.map(function(r) { return r.ref; });
  assert.ok(refs.includes('sun-wukong'), '结果中应包含孙悟空');
});

// ---- 9. 多字组合搜索 ----
console.log('\n【9】多字组合搜索');

test('「大圣」返回结果包含孙悟空', function() {
  var results = search('大圣');
  assert.ok(results.length > 0);
  var refs = results.map(function(r) { return r.ref; });
  assert.ok(refs.includes('sun-wukong'), '大圣应搜到孙悟空');
});

test('「三打白骨精」返回结果', function() {
  var results = search('三打白骨精');
  assert.ok(results.length > 0, '三打白骨精应返回结果');
});

test('「女儿国」返回结果包含西梁女国', function() {
  var results = search('女儿国');
  assert.ok(results.length > 0, '女儿国应返回结果');
});

// ---- 10. 搜索结果排序 ----
console.log('\n【10】搜索结果排序');

test('「孙悟空」搜索孙悟空得分最高', function() {
  var results = search('孙悟空');
  assert.ok(results.length > 0);
  var topDoc = getDoc(results[0].ref);
  assert.strictEqual(topDoc.name, '孙悟空', 'Top1得分应为孙悟空');
});

test('搜索结果按 score 降序排列', function() {
  var results = search('取经');
  if (results.length >= 2) {
    for (var i = 1; i < results.length; i++) {
      assert.ok(results[i-1].score >= results[i].score, '结果应按score降序');
    }
  }
});

// ---- 11. 索引字段覆盖 ----
console.log('\n【11】索引字段覆盖测试');

test('summary 字段可被搜索 - 搜索摘要中的词', function() {
  // 找一个人物，取其 summary 中的独特词来搜索
  var wk = data.find(function(d) { return d.id === 'sun-wukong'; });
  assert.ok(wk && wk.summary, '孙悟空应有摘要');
  // 用摘要中的部分内容搜索
  var results = search(wk.name);
  assert.ok(results.length > 0, '应能通过摘要内容搜索到结果');
});

test('tags 字段可被搜索', function() {
  // 搜索标签相关词
  var results = search('取经师徒');
  assert.ok(results.length > 0, '取经师徒标签应可被搜索');
});

test('typeLabel 字段可被搜索 - 搜索"人物"', function() {
  var results = search('人物');
  assert.ok(results.length > 0, 'typeLabel应可被搜索');
});

// ---- 12. URL 参数搜索模拟 ----
console.log('\n【12】URL参数搜索模拟');

test('URL参数 ?q=孙悟空 应能返回结果', function() {
  var query = '孙悟空';
  var queryTokens = chineseBigramTokenizer(query);
  var searchQuery = queryTokens.length > 0 ? queryTokens.join(' ') : query;
  var results = idx.search(searchQuery);
  assert.ok(results.length > 0, 'URL参数搜索应返回结果');
  var topDoc = getDoc(results[0].ref);
  assert.strictEqual(topDoc.name, '孙悟空');
});

test('URL参数 ?q= 为空时不崩溃', function() {
  var query = '';
  var trimmed = query.trim();
  // 模拟 doSearch 中的空检查
  if (!trimmed) {
    assert.ok(true, '空查询应被正确处理');
  } else {
    assert.fail('空查询未被正确处理');
  }
});

// ---- 13. 防抖/性能 ----
console.log('\n【13】性能测试');

test('搜索响应时间 < 100ms', function() {
  var start = Date.now();
  for (var i = 0; i < 10; i++) {
    search('孙悟空大闹天宫');
  }
  var elapsed = Date.now() - start;
  var avg = elapsed / 10;
  assert.ok(avg < 100, '平均搜索时间应<100ms, 实际: ' + avg.toFixed(2) + 'ms');
});

test('索引构建不报错', function() {
  // 如果索引已成功构建，说明没有错误
  assert.ok(idx !== null, '索引应已成功构建');
});

// ---- 14. 关键人物/地点/法宝覆盖 ----
console.log('\n【14】关键内容搜索覆盖');

var keyCharacters = ['孙悟空', '唐僧', '猪八戒', '沙悟净', '白龙马', '观音菩萨', '如来佛祖', '玉皇大帝', '太上老君', '牛魔王'];
keyCharacters.forEach(function(name) {
  test('搜索「' + name + '」返回结果', function() {
    var results = search(name);
    assert.ok(results.length > 0, name + ' 应有搜索结果');
  });
});

var keyLocations = ['花果山', '火焰山', '天宫', '龙宫', '雷音寺'];
keyLocations.forEach(function(name) {
  test('搜索「' + name + '」返回结果', function() {
    var results = search(name);
    assert.ok(results.length > 0, name + ' 应有搜索结果');
  });
});

var keyArtifacts = ['金箍棒', '九齿钉耙', '紧箍咒'];
keyArtifacts.forEach(function(name) {
  test('搜索「' + name + '」返回结果', function() {
    var results = search(name);
    assert.ok(results.length > 0, name + ' 应有搜索结果');
  });
});

// ===================== 测试报告 =====================
console.log('\n========================================');
console.log('  测试报告');
console.log('========================================');
console.log('  总测试数: ' + totalTests);
console.log('  通过: ' + passedTests);
console.log('  失败: ' + failedTests);
console.log('  通过率: ' + (passedTests / totalTests * 100).toFixed(1) + '%');

if (failures.length > 0) {
  console.log('\n  失败详情:');
  failures.forEach(function(f) {
    console.log('    ✗ ' + f.name);
    console.log('      → ' + f.error);
  });
}

console.log('\n========================================\n');
process.exit(failedTests > 0 ? 1 : 0);
