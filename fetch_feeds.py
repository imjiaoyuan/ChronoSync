import feedparser
import re
import json
from datetime import datetime
import pytz
from collections import defaultdict
import yaml
import os
from pathlib import Path

def get_feed_category(feed_url, feed_list_content):
    # 查找feed_url所属的分类
    lines = feed_list_content.split('\n')
    current_category = None
    for line in lines:
        line = line.strip()
        if line.endswith(':'):
            current_category = line[:-1]  # 移除冒号
        elif line == feed_url:
            return current_category
    return 'Blogs'  # 默认分类改为 Blogs

def fetch_feeds():
    """抓取所有订阅源并生成feed.json"""
    # 加载标签配置
    with open('config/labels.yml', 'r', encoding='utf-8') as f:
        label_config = yaml.safe_load(f)
    
    # 创建分类到配置的映射
    category_configs = {label['feed_category']: label for label in label_config['labels']}
    default_limit = label_config['default_limit']

    with open('feed.list', 'r') as f:
        feed_list_content = f.read()
        feeds = [line.strip() for line in feed_list_content.splitlines() if line.strip() and not line.endswith(':')]
    
    articles_by_category = defaultdict(list)
    
    for feed_url in feeds:
        try:
            print(f"正在抓取: {feed_url}")
            feed = feedparser.parse(feed_url)
            category = get_feed_category(feed_url, feed_list_content)
            
            # 获取该分类的文章数量限制
            category_config = category_configs.get(category, {})
            article_limit = category_config.get('article_limit', default_limit)
            
            entries = feed.entries
            if article_limit > 0:
                entries = entries[:article_limit]
            
            for entry in entries:
                published = entry.get('published_parsed', entry.get('updated_parsed'))
                if published:
                    # 直接从struct_time创建datetime对象
                    dt = datetime(
                        *published[:6],  # 解包年月日时分秒
                        tzinfo=pytz.UTC  # 设置为UTC时区
                    ).astimezone(pytz.timezone('Asia/Shanghai'))  # 转换为北京时区
                else:
                    dt = datetime.now(pytz.timezone('Asia/Shanghai'))
                
                summary = ''
                if 'summary' in entry:
                    summary = re.sub(r'<[^>]+>', '', entry.summary)
                    summary = summary.strip()[:150] + ('...' if len(summary) > 150 else '')
                elif 'description' in entry:
                    summary = re.sub(r'<[^>]+>', '', entry.description)
                    summary = summary.strip()[:150] + ('...' if len(summary) > 150 else '')
                
                article = {
                    'title': entry.title,
                    'link': entry.link,
                    'date': dt.strftime('%Y-%m-%d %H:%M'),
                    'author': feed.feed.title,
                    'timestamp': dt.timestamp(),
                    'summary': summary or '无摘要',
                    'source_url': feed.feed.link or feed_url,
                    'category': category
                }
                articles_by_category[category].append(article)
        except Exception as e:
            print(f"抓取 {feed_url} 失败: {str(e)}")
            continue
    
    # 对每个分类的文章进行排序，添加所有分类的文章
    all_articles = []
    
    # 动态处理所有分类
    for category, articles in articles_by_category.items():
        articles.sort(key=lambda x: x['timestamp'], reverse=True)
        all_articles.extend(articles)

    data = {
        'update_time': datetime.now(pytz.timezone('Asia/Shanghai')).strftime('%Y-%m-%d'),
        'articles': all_articles
    }
    
    with open('feed.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_feed_config():
    """从 feed.list 加载订阅源配置"""
    feeds = []
    current_category = None
    
    with open('feed.list', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:  # 跳过空行
                continue
            
            if line.endswith(':'):  # 分类行
                current_category = line[:-1]
            else:  # RSS源链接行
                if current_category:
                    feeds.append({
                        'name': line,  # 暂时用URL作为名称
                        'url': line,
                        'category': current_category
                    })
    
    return {'feeds': feeds}

if __name__ == '__main__':
    fetch_feeds()