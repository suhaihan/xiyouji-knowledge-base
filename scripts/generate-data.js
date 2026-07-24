/**
 * generate-data.js - 西游记知识库数据生成入口
 * 运行: node scripts/generate-data.js
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  ✓ ${filename} (${count} 条)`);
}

// 加载各数据模块
const siteConfig = require('./data-modules/site-config');
const charactersBase = require('./data-modules/characters');
const charactersExtra = [
  ...require('./data-modules/characters-extra-immortal'),
  ...require('./data-modules/characters-extra-divine'),
  ...require('./data-modules/characters-extra-demon-1'),
  ...require('./data-modules/characters-extra-demon-2'),
];
const characters = [...charactersBase, ...charactersExtra];
const chapters = require('./data-modules/chapters');
const locationsBase = require('./data-modules/locations');
const locationsExtra = require('./data-modules/locations-extra');
const locations = [...locationsBase, ...locationsExtra];
const artifactsBase = require('./data-modules/artifacts');
const artifactsExtra = require('./data-modules/artifacts-extra');
const artifacts = [...artifactsBase, ...artifactsExtra];
const quotes = require('./data-modules/quotes');

console.log('开始生成西游记知识库数据...');

writeJSON('site-config.json', siteConfig);
writeJSON('characters.json', characters);
writeJSON('chapters.json', chapters);
writeJSON('locations.json', locations);
writeJSON('artifacts.json', artifacts);
writeJSON('quotes.json', quotes);

console.log('\n数据生成完成！');
console.log(`  人物: ${characters.length} 位`);
console.log(`  章节: ${chapters.length} 回`);
console.log(`  地点: ${locations.length} 个`);
console.log(`  法宝: ${artifacts.length} 件`);
console.log(`  台词: ${quotes.length} 条`);
