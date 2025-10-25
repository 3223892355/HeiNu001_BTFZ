// background.js - 后台服务脚本
chrome.runtime.onInstalled.addListener(() => {
    console.log('补天漏洞提交助手已安装');
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'queryCompany') {
        handleQueryCompany(request.host)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持消息通道开放
    }
    
    if (request.action === 'queryRegion') {
        handleQueryRegion(request.companyName)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'debugQuery') {
        debugQueryCompany(request.host)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'queryCompanyViaTab') {
        handleQueryCompanyViaTab(request.host, request.tabId)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'queryCompanyXHR') {
        queryCompanyWithXHR(request.host)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// 使用XMLHttpRequest查询厂商信息
async function queryCompanyWithXHR(host) {
    return new Promise((resolve, reject) => {
        const aizhanUrl = `https://www.aizhan.com/cha/${host}/`;
        console.log('使用XHR查询:', aizhanUrl);
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', aizhanUrl, true);
        xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        xhr.setRequestHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
        xhr.setRequestHeader('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
        xhr.setRequestHeader('Referer', 'https://www.aizhan.com/cha/');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const html = xhr.responseText;
                        console.log('XHR响应长度:', html.length);
                        
                        // 检查是否包含厂商信息
                        if (html.includes('icp_company')) {
                            console.log('✅ XHR页面包含 icp_company 元素');
                            
                            // 使用正则表达式提取厂商名称
                            const match = html.match(/<span[^>]*id="icp_company"[^>]*>([^<]+)<\/span>/);
                            if (match && match[1]) {
                                const companyName = match[1].trim();
                                console.log('✅ XHR提取到厂商名称:', companyName);
                                resolve(companyName);
                                return;
                            }
                        }
                        
                        // 尝试其他模式
                        const patterns = [
                            /主办单位[：:]\s*([^<\s]{2,50}公司|[^<\s]{2,50}集团|[^<\s]{2,50}企业|[^<\s]{2,50}科技|[^<\s]{2,50}网络|[^<\s]{2,50}传媒|[^<\s]{2,50}有限|[^<\s]{2,50}股份)/,
                            /公司名称[：:]\s*([^<\s]{2,50}公司|[^<\s]{2,50}集团|[^<\s]{2,50}企业|[^<\s]{2,50}科技|[^<\s]{2,50}网络|[^<\s]{2,50}传媒|[^<\s]{2,50}有限|[^<\s]{2,50}股份)/,
                            /备案主体[：:]\s*([^<\s]{2,50}公司|[^<\s]{2,50}集团|[^<\s]{2,50}企业|[^<\s]{2,50}科技|[^<\s]{2,50}网络|[^<\s]{2,50}传媒|[^<\s]{2,50}有限|[^<\s]{2,50}股份)/
                        ];
                        
                        for (const pattern of patterns) {
                            const match = html.match(pattern);
                            if (match && match[1]) {
                                const companyName = match[1].trim();
                                console.log('✅ XHR模式匹配成功:', companyName);
                                resolve(companyName);
                                return;
                            }
                        }
                        
                        console.log('❌ XHR未找到厂商信息');
                        reject(new Error('未找到厂商信息'));
                        
                    } catch (error) {
                        console.log('XHR解析错误:', error);
                        reject(error);
                    }
                } else {
                    console.log('XHR请求失败:', xhr.status);
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            }
        };
        
        xhr.onerror = function() {
            console.log('XHR网络错误');
            reject(new Error('网络错误'));
        };
        
        xhr.send();
    });
}

// 通过tab查询厂商信息 - 使用content script注入
async function handleQueryCompanyViaTab(host, tabId) {
    console.log('通过tab查询厂商信息:', host);
    
    const aizhanUrl = `https://www.aizhan.com/cha/${host}/`;
    
    try {
        // 创建一个新的tab来查询
        const tab = await chrome.tabs.create({ url: aizhanUrl, active: false });
        
        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 注入脚本获取厂商信息
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                const icpCompanyElement = document.querySelector('#icp_company');
                if (icpCompanyElement) {
                    return icpCompanyElement.textContent.trim();
                }
                
                // 尝试其他选择器
                const selectors = [
                    '.icp-info .company',
                    '.company-name',
                    '[class*="company"]',
                    '.icp-info tr td:last-child'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent.trim();
                        if (text && text.length > 2 && !['-', '—', '无', '未知', '暂无', '未备案'].includes(text)) {
                            return text;
                        }
                    }
                }
                
                return null;
            }
        });
        
        // 关闭tab
        await chrome.tabs.remove(tab.id);
        
        if (results && results[0] && results[0].result) {
            const companyName = results[0].result;
            console.log('✅ 通过tab查询成功:', companyName);
            return companyName;
        } else {
            console.log('❌ 通过tab查询失败');
            throw new Error('未找到厂商信息');
        }
        
    } catch (error) {
        console.log('通过tab查询出错:', error);
        throw error;
    }
}

// 调试查询函数 - 详细输出查询过程
async function debugQueryCompany(host) {
    console.log('=== 开始调试查询厂商名称 ===');
    console.log('目标域名:', host);
    
    const aizhanUrl = `https://www.aizhan.com/cha/${host}/`;
    console.log('爱站网URL:', aizhanUrl);
    
    try {
        // 先预热爱站网
        await warmupAizhan();
        
        // 直接查询爱站网
        const response = await fetch(aizhanUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.aizhan.com/cha/',
                'Cache-Control': 'max-age=0',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin'
            }
        });
        
        console.log('响应状态:', response.status);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        console.log('页面内容长度:', html.length);
        
        // 检查是否包含厂商信息
        if (html.includes('icp_company')) {
            console.log('✅ 页面包含 icp_company 元素');
        } else {
            console.log('❌ 页面不包含 icp_company 元素');
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // 尝试查找 icp_company 元素
        const icpCompanyElement = doc.querySelector('#icp_company');
        if (icpCompanyElement) {
            const companyName = icpCompanyElement.textContent.trim();
            console.log('✅ 找到厂商名称:', companyName);
            return {
                success: true,
                companyName: companyName,
                method: 'icp_company_element',
                debug: {
                    url: aizhanUrl,
                    status: response.status,
                    contentLength: html.length,
                    elementFound: true
                }
            };
        } else {
            console.log('❌ 未找到 #icp_company 元素');
            
            // 尝试其他选择器
            const selectors = [
                '.icp-info .company',
                '.company-name',
                '[class*="company"]',
                '.icp-info tr td:last-child'
            ];
            
            for (const selector of selectors) {
                const element = doc.querySelector(selector);
                if (element) {
                    const text = element.textContent.trim();
                    console.log(`选择器 ${selector} 找到文本:`, text);
                    if (text && text.length > 2) {
                        return {
                            success: true,
                            companyName: text,
                            method: `selector_${selector}`,
                            debug: {
                                url: aizhanUrl,
                                status: response.status,
                                contentLength: html.length,
                                elementFound: true,
                                selector: selector
                            }
                        };
                    }
                }
            }
        }
        
        return {
            success: false,
            error: '未找到厂商信息',
            debug: {
                url: aizhanUrl,
                status: response.status,
                contentLength: html.length,
                elementFound: false
            }
        };
        
    } catch (error) {
        console.log('调试查询失败:', error);
        return {
            success: false,
            error: error.message,
            debug: {
                url: aizhanUrl,
                error: error.message
            }
        };
    }
}

// 查询厂商名称
async function handleQueryCompany(host) {
    console.log('开始查询厂商名称:', host);
    
    const querySources = [
        {
            name: 'aizhan.com',
            url: `https://www.aizhan.com/cha/${host}/`,
            selectors: [
                '#icp_company', 
                '.icp-info .company', 
                '.company-name', 
                '[class*="company"]',
                '.icp-info tr td:last-child',
                '.icp-table tr td:last-child',
                '.icp-info tr:nth-child(2) td:last-child',
                '.icp-info tr:nth-child(3) td:last-child'
            ]
        },
        {
            name: 'chinaz.com',
            url: `https://seo.chinaz.com/${host}`,
            selectors: [
                '.icp-info .company-name', 
                '.icp-info .name', 
                '.company-name', 
                '.icp-company',
                '[class*="company"]',
                '.icp-info td:contains("主办单位")',
                '.icp-info tr:contains("主办单位")'
            ]
        },
        {
            name: 'chinaz-icp.com',
            url: `https://icp.chinaz.com/${host}`,
            selectors: ['#company', '.company-name', '.icp-info .name', '[class*="company"]']
        },
        {
            name: 'beianbeian.com',
            url: `https://www.beianbeian.com/search/${host}`,
            selectors: ['.company', '.company-name', '.icp-company', '[class*="company"]']
        }
    ];

    // 先预热爱站网
    await warmupAizhan();

    for (const source of querySources) {
        try {
            console.log(`尝试查询源: ${source.name} - ${source.url}`);
            const companyName = await queryFromSource(source, host);
            console.log(`${source.name} 查询结果:`, companyName);
            
            const invalidResults = ['未知厂商', '查询企业', '查询网站', '查询网站、公司', '-', '—', '无', '未知', '暂无', '未备案', '企业', '公司', '集团'];
            if (companyName && !invalidResults.includes(companyName) && companyName.length > 2) {
                console.log(`✅ 从 ${source.name} 成功获取厂商信息: ${companyName}`);
                return companyName;
            } else {
                console.log(`❌ ${source.name} 返回无效结果: ${companyName}`);
            }
        } catch (error) {
            console.log(`❌ 查询 ${source.name} 失败:`, error.message);
            continue;
        }
    }
    
    // 如果所有源都失败，尝试从域名推断
    console.log('所有查询源都失败，尝试域名推断');
    const inferredName = inferCompanyFromDomain(host);
    console.log('域名推断结果:', inferredName);
    return inferredName;
}

// 预热爱站网
async function warmupAizhan() {
    try {
        console.log('预热爱站网...');
        
        // 访问主页
        const homeResponse = await fetch('https://www.aizhan.com/', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            }
        });
        
        if (!homeResponse.ok) {
            console.log('主页访问失败，跳过预热');
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 访问查询页面
        const queryResponse = await fetch('https://www.aizhan.com/cha/', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.aizhan.com/'
            }
        });
        
        if (!queryResponse.ok) {
            console.log('查询页面访问失败，跳过预热');
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('爱站网预热完成');
    } catch (error) {
        console.log('预热过程出错:', error);
    }
}

// 从单个源查询厂商名称
async function queryFromSource(source, host) {
    console.log(`请求URL: ${source.url}`);
    
    try {
    const response = await fetch(source.url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.aizhan.com/cha/',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin'
        }
    });
    
    console.log(`响应状态: ${response.status}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`页面内容长度: ${html.length}`);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 检查是否被反爬虫拦截
    const bodyText = doc.body.textContent.toLowerCase();
    if (bodyText.includes('验证码') || bodyText.includes('captcha') || 
        bodyText.includes('访问过于频繁') || bodyText.includes('请稍后再试') ||
        bodyText.includes('请稍后') || bodyText.includes('频繁访问')) {
        console.log('被反爬虫拦截');
        throw new Error('被反爬虫拦截');
    }
    
    // 尝试多个选择器
    console.log('尝试选择器:', source.selectors);
    for (const selector of source.selectors) {
        try {
            const element = doc.querySelector(selector);
            if (element) {
                let text = element.textContent.trim();
                console.log(`选择器 ${selector} 找到文本:`, text);
                
                // 跳过无效的文本
                const invalidTexts = ['-', '—', '无', '未知', '暂无', '未备案', '查询', '企业', '公司', '集团'];
                if (invalidTexts.includes(text) || text.length <= 1) {
                    console.log(`跳过无效文本: ${text}`);
                    continue;
                }
                
                    // 更温和的文本清理 - 保留更多字符
                    text = text.replace(/\s+/g, ' ').replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s&]/g, '');
                    if (text && text.length > 2 && text.length < 100) {
                    console.log(`✅ 选择器成功: ${text}`);
                    return text;
                }
            }
        } catch (e) {
            console.log(`选择器 ${selector} 错误:`, e.message);
            continue;
        }
    }
    
    // 如果选择器都失败，尝试从页面文本中提取
    console.log('选择器都失败，尝试文本匹配');
    const companyPatterns = [
            /主办单位[：:]\s*([^\s]{2,50}公司|[^\s]{2,50}集团|[^\s]{2,50}企业|[^\s]{2,50}科技|[^\s]{2,50}网络|[^\s]{2,50}传媒|[^\s]{2,50}有限|[^\s]{2,50}股份)/,
            /公司名称[：:]\s*([^\s]{2,50}公司|[^\s]{2,50}集团|[^\s]{2,50}企业|[^\s]{2,50}科技|[^\s]{2,50}网络|[^\s]{2,50}传媒|[^\s]{2,50}有限|[^\s]{2,50}股份)/,
            /备案主体[：:]\s*([^\s]{2,50}公司|[^\s]{2,50}集团|[^\s]{2,50}企业|[^\s]{2,50}科技|[^\s]{2,50}网络|[^\s]{2,50}传媒|[^\s]{2,50}有限|[^\s]{2,50}股份)/,
            /单位名称[：:]\s*([^\s]{2,50}公司|[^\s]{2,50}集团|[^\s]{2,50}企业|[^\s]{2,50}科技|[^\s]{2,50}网络|[^\s]{2,50}传媒|[^\s]{2,50}有限|[^\s]{2,50}股份)/,
            /([^\s]{2,30}公司|[^\s]{2,30}集团|[^\s]{2,30}企业|[^\s]{2,30}科技|[^\s]{2,30}网络|[^\s]{2,30}传媒|[^\s]{2,30}有限|[^\s]{2,30}股份)/g
    ];
    
    for (const pattern of companyPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
            const companyName = match[1] || match[0];
            console.log(`文本匹配成功: ${companyName}`);
                if (companyName && companyName.length > 2 && companyName.length < 50) {
                return companyName;
            }
        }
    }
    
    console.log('所有方法都失败，返回未知厂商');
    return '未知厂商';
        
    } catch (error) {
        console.log(`查询 ${source.name} 失败:`, error.message);
        throw error;
    }
}

// 从域名推断厂商名称
function inferCompanyFromDomain(host) {
    const domain = host.replace(/\.(com|cn|net|org|gov|edu|co|cc|me|info)$/i, '');
    
    if (/^[0-9\.\-_]+$/.test(domain)) {
        return host;
    }
    
    const parts = domain.split('.');
    const mainPart = parts[parts.length - 1] || domain;
    
    if (/[\u4e00-\u9fa5]/.test(mainPart) || mainPart.length > 3) {
        return mainPart + '公司';
    }
    
    return host;
}

// 查询公司地区
async function handleQueryRegion(companyName) {
    const AMAP_API_KEY = 'XXXXXXXXXXXXXXXXX'; //替换为你自己的api key
    
    try {
        const response = await fetch(
            `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(companyName)}&key=${AMAP_API_KEY}&citylimit=false`
        );
        
        const data = await response.json();
        
        if (data.status === "1" && data.count > 0) {
            const info = data.pois[0];
            const province = info.pname || '未知';
            const city = info.cityname || '未知';
            const district = info.adname || '未知';
            
            // 处理直辖市地区名称
            const processedRegion = processMunicipalityRegion(province, city, district);
            return processedRegion;
        }
    } catch (error) {
        console.error('查询地区失败:', error);
    }
    
    return '未知/未知/未知';
}

// 处理直辖市地区名称
function processMunicipalityRegion(province, city, district) {
    // 定义直辖市映射
    const municipalityMapping = {
        '北京市': '北京城区',
        '上海市': '上海城区', 
        '重庆市': '重庆城区',
        '天津市': '天津城区'
    };
    
    // 检查是否为直辖市
    if (municipalityMapping[province] && city === province) {
        return `${province}/${municipalityMapping[province]}/${district}`;
    }
    
    // 非直辖市，返回原始格式
    return `${province}/${city}/${district}`;
}
