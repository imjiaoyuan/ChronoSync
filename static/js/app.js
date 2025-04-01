// 主应用程序代码
const app = {
    // 当前分类
    currentCategory: 'Blogs',
    
    // 配置
    labelConfig: null,
    githubConfig: null,
    
    // 初始化应用
    async init() {
        this.setupEventListeners();
        await this.loadConfig();
        this.renderNavigation();
        this.loadArticles(this.currentCategory);
    },
    
    // 设置事件监听器
    setupEventListeners() {
        // 站点标题点击事件
        document.querySelector('.site-title').addEventListener('click', () => this.reloadPage());
        
        // 使用事件委托绑定导航事件
        document.querySelector('.nav-items').addEventListener('click', (e) => {
            const item = e.target.closest('.category-item');
            if (item) {
                const category = item.dataset.category;
                if (category !== this.currentCategory) {
                    this.currentCategory = category;
                    this.updateActiveCategory(category);
                    this.loadArticles(category);
                }
            }
        });
        
        document.querySelector('.mobile-nav').addEventListener('click', (e) => {
            const item = e.target.closest('.category-item');
            if (item) {
                const category = item.dataset.category;
                if (category !== this.currentCategory) {
                    this.currentCategory = category;
                    this.updateActiveCategory(category);
                    this.loadArticles(category);
                }
            }
        });
        
        // 使用事件委托绑定文章评论和收藏按钮事件
        document.getElementById('articles').addEventListener('click', (e) => {
            // 评论按钮
            if (e.target.closest('.comment-button')) {
                const button = e.target.closest('.comment-button');
                const article = button.closest('.article');
                this.handleIssueClick(
                    button,
                    article.dataset.title,
                    article.dataset.summary,
                    article.dataset.date,
                    article.dataset.link,
                    'comment'
                );
            }
            
            // 收藏按钮
            if (e.target.closest('.favorite-button')) {
                const button = e.target.closest('.favorite-button');
                const article = button.closest('.article');
                this.handleIssueClick(
                    button,
                    article.dataset.title,
                    article.dataset.summary,
                    article.dataset.date,
                    article.dataset.link,
                    'favorite'
                );
            }
        });
    },
    
    // 重新加载页面
    reloadPage() {
        this.currentCategory = this.labelConfig.labels[0].feed_category;
        this.updateActiveCategory(this.currentCategory);
        this.loadArticles(this.currentCategory);
    },
    
    // 加载配置
    async loadConfig() {
        try {
            const [labelConf, githubConf] = await Promise.all([
                this.loadLabelConfig(),
                this.loadGithubConfig()
            ]);
            
            this.labelConfig = labelConf;
            this.githubConfig = githubConf;
            
            if (this.labelConfig && this.labelConfig.labels.length > 0) {
                this.currentCategory = this.labelConfig.labels[0].feed_category;
            }
        } catch (error) {
            console.error('配置加载失败:', error);
        }
    },
    
    // 渲染导航
    renderNavigation() {
        if (!this.labelConfig) return;
        
        const navHtml = this.labelConfig.labels.map(label => `
            <div class="category-item" data-category="${label.feed_category}">
                <i class="mdi ${label.icon}"></i>
                <span>${label.display_name}</span>
            </div>
        `).join('');

        document.querySelector('.nav-items').innerHTML = navHtml;
        document.querySelector('.mobile-nav').innerHTML = navHtml;
        
        this.updateActiveCategory(this.currentCategory);
    },
    
    // 更新激活的分类
    updateActiveCategory(category) {
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.category === category) {
                item.classList.add('active');
            }
        });
    },
    
    // 加载标签配置
    async loadLabelConfig() {
        try {
            const response = await fetch('config/labels.yml');
            if (!response.ok) {
                throw new Error('Failed to load label config');
            }
            const yamlText = await response.text();
            return jsyaml.load(yamlText);
        } catch (error) {
            console.error('Error loading label config:', error);
            return null;
        }
    },
    
    // 加载GitHub配置
    async loadGithubConfig() {
        try {
            const response = await fetch('config/github.yml');
            if (!response.ok) {
                throw new Error('Failed to load GitHub config');
            }
            const yamlText = await response.text();
            return jsyaml.load(yamlText);
        } catch (error) {
            console.error('Error loading GitHub config:', error);
            return null;
        }
    },
    
    // 加载文章
    async loadArticles(category = 'Blogs') {
        const articlesContainer = document.getElementById('articles');
        
        try {
            // 显示加载指示器
            articlesContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">正在加载文章...</div>
                </div>`;
            
            // 确保配置已加载
            if (!this.labelConfig) {
                await this.loadConfig();
            }

            // 使用缓存避免重复请求
            let data;
            if (window.cachedFeedData) {
                data = window.cachedFeedData;
            } else {
                const response = await fetch('feed.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                data = await response.json();
                window.cachedFeedData = data; // 缓存数据
                
                // 5分钟后清除缓存
                setTimeout(() => {
                    window.cachedFeedData = null;
                }, 5 * 60 * 1000);
            }
            
            // 更新时间显示
            const updateTime = data.update_time || '';
            document.getElementById('update-time').textContent = updateTime;
            
            if (!data.articles || !Array.isArray(data.articles)) {
                throw new Error('Invalid data format');
            }

            // 获取当前分类的配置
            const categoryConfig = this.labelConfig.labels.find(l => l.feed_category === category);
            if (!categoryConfig) {
                throw new Error('Category config not found');
            }

            // 过滤当前分类的文章
            let filteredArticles = data.articles.filter(article => article.category === category);
            
            // 应用文章数量限制
            if (categoryConfig.article_limit > 0) {
                filteredArticles = filteredArticles.slice(0, categoryConfig.article_limit);
            }

            if (filteredArticles.length === 0) {
                articlesContainer.innerHTML = `
                    <div class="empty-message">
                        <i class="mdi mdi-information"></i>
                        <span>该分类下暂无文章</span>
                    </div>`;
                return;
            }

            // 使用文档片段优化DOM操作
            const fragment = document.createDocumentFragment();
            const mainContainer = document.createElement('div');
            fragment.appendChild(mainContainer);

            let html = '';

            // 根据配置决定是否显示日期分隔
            if (categoryConfig.show_date_divider) {
                const todayArticles = filteredArticles.filter(article => this.isToday(article.date));
                const olderArticles = filteredArticles.filter(article => !this.isToday(article.date));

                if (todayArticles.length > 0) {
                    html += `
                        <div class="section-title animate-fade-in">
                            <i class="mdi mdi-star"></i>
                            <span>今日更新</span>
                            <small>(${todayArticles.length}篇)</small>
                        </div>
                        <div class="article-section">
                            ${todayArticles.map((article, index) => this.renderArticle(article, index, 'today')).join('')}
                        </div>`;
                }

                if (olderArticles.length > 0) {
                    html += `
                        <div class="section-title ${todayArticles.length > 0 ? 'history-title' : ''} animate-fade-in" style="animation-delay: 0.2s">
                            <i class="mdi mdi-history"></i>
                            <span>历史文章</span>
                            <small>(${olderArticles.length}篇)</small>
                        </div>
                        <div class="article-section">
                            ${olderArticles.map((article, index) => this.renderArticle(article, index, 'history')).join('')}
                        </div>`;
                }
            } else {
                html = `
                    <div class="article-section">
                        ${filteredArticles.map((article, index) => this.renderArticle(article, index, 'all')).join('')}
                    </div>`;
            }

            mainContainer.innerHTML = html;
            
            // 批量更新DOM
            articlesContainer.innerHTML = '';
            articlesContainer.appendChild(fragment);
            
            // 启用延迟加载动画
            setTimeout(() => {
                document.querySelectorAll('.delayed-animate').forEach((el, i) => {
                    setTimeout(() => {
                        el.classList.add('visible');
                    }, i * 50); // 每篇文章间隔50ms
                });
            }, 100);
            
        } catch (error) {
            articlesContainer.innerHTML = `
                <div class="error-message">
                    <i class="mdi mdi-alert-circle"></i>
                    加载文章失败：${error.message}<br>
                    请检查配置文件和feed.json是否存在并且格式正确
                </div>`;
        }
    },
    
    // 渲染单篇文章
    renderArticle(article, index, section) {
        const delay = section === 'today' ? index * 0.05 : 0.3 + index * 0.05;
        
        const buttons = [];
        
        if (this.githubConfig?.github.comment.enabled) {
            buttons.push(`
                <div class="meta-item comment-button">
                    <i class="mdi mdi-message-outline"></i>
                    <span>评论</span>
                </div>
            `);
        }
        
        if (this.githubConfig?.github.favorite.enabled) {
            buttons.push(`
                <div class="meta-item favorite-button">
                    <i class="mdi mdi-bookmark-outline"></i>
                    <span>收藏</span>
                </div>
            `);
        }

        return `
            <article class="article delayed-animate" 
                     data-link="${article.link}"
                     data-title="${this.escapeAttr(article.title)}"
                     data-summary="${this.escapeAttr(article.summary || '无摘要')}"
                     data-date="${article.date}"
                     style="animation-delay: ${delay}s">
                <a href="${article.link}" class="article-title" target="_blank">${article.title}</a>
                <div class="article-summary">
                    ${article.summary || '无摘要'}
                </div>
                <div class="article-meta">
                    <a href="${article.source_url}" class="meta-item source-link" target="_blank">
                        <i class="mdi mdi-rss"></i>
                        <span class="author-name" title="${article.author}">${article.author}</span>
                    </a>
                    <div class="button-group">
                        ${buttons.join('')}
                    </div>
                </div>
            </article>`;
    },
    
    // 处理评论和收藏按钮点击
    async handleIssueClick(button, title, summary, date, link, type) {
        // 保存原始内容
        const originalContent = button.innerHTML;
        
        // 显示加载状态
        button.innerHTML = `<i class="mdi mdi-loading mdi-spin"></i><span>处理中...</span>`;
        button.style.pointerEvents = 'none';  // 禁用点击
        
        try {
            await this.createGitHubIssue(title, summary, date, link, type);
        } catch (error) {
            console.error('Error handling issue:', error);
        } finally {
            // 恢复原始状态
            button.innerHTML = originalContent;
            button.style.pointerEvents = 'auto';  // 恢复点击
        }
    },
    
    // 创建GitHub Issue
    async createGitHubIssue(title, summary, date, link, type = 'comment') {
        if (!this.githubConfig) return;

        const config = type === 'comment' ? this.githubConfig.github.comment : this.githubConfig.github.favorite;
        
        // 检查功能是否启用
        if (!config.enabled) {
            console.log(`${type} feature is disabled`);
            return;
        }

        // 添加前缀到标题
        const prefix = type === 'comment' ? 'Comment: ' : 'Favorite: ';
        const issueTitle = prefix + title;

        try {
            // 先检查是否存在同名 issue
            const searchUrl = `https://api.github.com/search/issues?q=repo:${this.githubConfig.github.repository}+label:${config.label}+"${encodeURIComponent(issueTitle)}"+in:title`;
            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                // 如果存在同名 issue，直接跳转到该 issue
                window.open(data.items[0].html_url, '_blank');
            } else {
                // 如果不存在，创建新的 issue
                const issueBody = config.body_template
                    .replace('{summary}', summary)
                    .replace('{link}', link);

                const issueUrl = `https://github.com/${this.githubConfig.github.repository}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels[]=${encodeURIComponent(config.label)}`;
                
                window.open(issueUrl, '_blank');
            }
        } catch (error) {
            console.error('Error checking/creating issue:', error);
            // 如果 API 请求失败，回退到直接创建新 issue
            const issueBody = config.body_template
                .replace('{summary}', summary)
                .replace('{link}', link);

            const issueUrl = `https://github.com/${this.githubConfig.github.repository}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels[]=${encodeURIComponent(config.label)}`;
            
            window.open(issueUrl, '_blank');
        }
    },
    
    // 工具函数: 检查日期是否为今天
    isToday(dateStr) {
        const today = new Date();
        const articleDate = new Date(dateStr);
        return today.toDateString() === articleDate.toDateString();
    },
    
    // 工具函数: 转义属性字符串
    escapeAttr(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/'/g, '&apos;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
};

// 当页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
}); 