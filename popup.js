// popup.js - 弹窗逻辑
document.addEventListener('DOMContentLoaded', function() {
    let saveTimer = null;

    // 默认配置
    const DEFAULT_CONFIG = {
        companyName: "示例厂商",
        host: "example.com",
        category: "1",
        title: "示例厂商管理后台存在弱口令",
        urls: ["http://example.com"],
        vulnType: "67",
        weight: "1",
        activeId: "",
        description: "示例厂商管理后台存在弱口令，导致潜在安全风险。",
        repairSuggest: "修改弱口令为强密码，并启用多因素认证。",
        region: "北京市/北京市/东城区",
        companyContact: "",
        autoFill: true,
        anonymous: true
    };

    // 漏洞类型模板
    const VULN_TEMPLATES = {
        "1": { // XSS
            title: "存在跨站脚本攻击漏洞",
            description: "网站存在跨站脚本攻击(XSS)漏洞，攻击者可以在页面中注入恶意脚本，窃取用户信息或执行恶意操作。",
            repairSuggest: "1. 对所有用户输入进行严格的过滤和转义处理\n2. 使用CSP(内容安全策略)限制脚本执行\n3. 对输出内容进行HTML编码\n4. 使用安全的DOM操作方法"
        },
        "2": { // SQL注入
            title: "存在SQL注入漏洞",
            description: "网站存在SQL注入漏洞，攻击者可以通过构造恶意SQL语句获取数据库敏感信息或执行危险操作。",
            repairSuggest: "1. 使用参数化查询或预编译语句\n2. 对所有用户输入进行严格验证和过滤\n3. 使用最小权限原则配置数据库用户\n4. 定期进行安全代码审计"
        },
        "3": { // 命令执行
            title: "存在命令执行漏洞",
            description: "系统存在命令执行漏洞，攻击者可以通过构造恶意命令在服务器上执行任意系统命令。",
            repairSuggest: "1. 避免直接执行用户输入的命令\n2. 使用白名单方式限制可执行的命令\n3. 对命令参数进行严格过滤和转义\n4. 使用沙箱环境隔离命令执行"
        },
        "8": { // 逻辑漏洞
            title: "存在业务逻辑漏洞",
            description: "系统存在业务逻辑漏洞，攻击者可以利用业务逻辑缺陷绕过安全限制或获取不当利益。",
            repairSuggest: "1. 完善业务逻辑验证机制\n2. 实施严格的权限控制\n3. 对关键操作进行多重验证\n4. 定期进行业务逻辑安全测试"
        },
        "10": { // 信息泄露
            title: "存在信息泄露漏洞",
            description: "系统存在信息泄露漏洞，敏感信息可能被未授权访问或泄露。",
            repairSuggest: "1. 限制敏感信息的访问权限\n2. 实施数据加密保护\n3. 加强访问日志监控\n4. 定期进行安全评估"
        },
        "28": { // 文件上传
            title: "存在文件上传漏洞",
            description: "系统存在文件上传漏洞，攻击者可以上传恶意文件，可能导致服务器被控制。",
            repairSuggest: "1. 严格限制上传文件类型和大小\n2. 对上传文件进行安全扫描\n3. 将上传文件存储在非执行目录\n4. 实施文件内容验证"
        },
        "67": { // 弱口令
            title: "存在弱口令漏洞",
            description: "系统存在弱口令漏洞，攻击者可以通过暴力破解或字典攻击获取系统访问权限。",
            repairSuggest: "1. 修改弱口令为强密码\n2. 启用多因素认证\n3. 实施密码策略\n4. 定期更换密码"
        }
    };

    // 初始化
    init();

    function init() {
        loadConfig();
        setupEventListeners();
        setupTabs();
        setupAutoSave();
        
        // 确保权重默认选择
        setTimeout(() => {
            const weightSelect = document.getElementById('weight');
            if (weightSelect && !weightSelect.value) {
                weightSelect.value = '1';
            }
        }, 100);
    }

    function setupEventListeners() {
        // 自动识别按钮
        document.getElementById('autoDetectBtn').addEventListener('click', handleAutoDetect);
        
        // 手动同步按钮
        document.getElementById('manualSyncBtn').addEventListener('click', handleManualSync);
        
        // 重置按钮
        document.getElementById('resetBtn').addEventListener('click', handleReset);
        
        // 漏洞类型选择器
        document.getElementById('vulnType').addEventListener('change', handleVulnTypeChange);
    }

    function setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.dataset.tab;
                
                // 移除所有活动状态
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));
                
                // 添加活动状态
                this.classList.add('active');
                document.getElementById(targetTab + 'Tab').classList.add('active');
            });
        });
    }

    // 处理漏洞类型变更
    function handleVulnTypeChange() {
        const vulnType = document.getElementById('vulnType').value;
        const companyName = document.getElementById('companyName').value || '示例厂商';
        
        if (vulnType && vulnType !== '0' && VULN_TEMPLATES[vulnType]) {
            const template = VULN_TEMPLATES[vulnType];
            
            // 更新标题
            document.getElementById('title').value = `${companyName}${template.title}`;
            
            // 更新描述
            document.getElementById('description').value = template.description;
            
            // 更新修复方案
            document.getElementById('repairSuggest').value = template.repairSuggest;
            
            showStatus(`已应用${getVulnTypeName(vulnType)}模板`, 'success');
            scheduleSaveConfig();
        }
    }
    
    // 获取漏洞类型名称
    function getVulnTypeName(vulnType) {
        const vulnTypeNames = {
            "1": "XSS",
            "2": "SQL注入", 
            "3": "命令执行",
            "8": "逻辑漏洞",
            "10": "信息泄露",
            "28": "文件上传",
            "67": "弱口令"
        };
        return vulnTypeNames[vulnType] || '未知类型';
    }

    async function handleAutoDetect() {
        const url = document.getElementById('autoUrl').value.trim();
        const statusEl = document.getElementById('autoStatus');
        
        if (!url) {
            showStatus('请输入URL', 'error');
            return;
        }
        
        try {
            showStatus('正在识别域名...', 'info');
            document.getElementById('autoDetectBtn').disabled = true;
            
            // 解析URL获取域名
            const urlObj = new URL(url);
            const host = extractRootDomain(urlObj.hostname);
            let path = urlObj.pathname;
            if (path.endsWith('/')) path = path.slice(0, -1);
            path = path.replace(/\?.*$/, '');
            
            showStatus('正在查询厂商信息...', 'info');
            
            // 直接使用background script查询厂商
            let companyName = null;
            
            // 先尝试XHR查询
            try {
                const xhrResponse = await chrome.runtime.sendMessage({
                    action: 'queryCompanyXHR',
                    host: host
                });
                
                if (xhrResponse.success) {
                    companyName = xhrResponse.data;
                }
            } catch (xhrError) {
                console.log('XHR查询失败:', xhrError);
            }
            
            // 如果XHR失败，尝试tab查询
            if (!companyName) {
                try {
                    const tabResponse = await chrome.runtime.sendMessage({
                        action: 'queryCompanyViaTab',
                        host: host,
                        tabId: null
                    });
                    
                    if (tabResponse.success) {
                        companyName = tabResponse.data;
                    }
                } catch (tabError) {
                    console.log('tab查询失败:', tabError);
                }
            }
            
            // 如果都失败，使用正常查询
            if (!companyName) {
                const response = await chrome.runtime.sendMessage({
                    action: 'queryCompany',
                    host: host
                });
                
                if (response.success) {
                    companyName = response.data;
                } else {
                    throw new Error(response.error);
                }
            }
            
            // 查询地区
            let region = '未知/未知/未知';
            try {
                const regionResponse = await chrome.runtime.sendMessage({
                    action: 'queryRegion',
                    companyName: companyName
                });
                
                if (regionResponse.success) {
                    region = regionResponse.data;
                }
            } catch (regionError) {
                console.log('地区查询失败:', regionError);
            }
            
            // 根据漏洞类型生成标题/描述/修复建议
            const vulnType = document.getElementById('vulnType') ? document.getElementById('vulnType').value : '0';
            const template = VULN_TEMPLATES[vulnType];
            const pathText = path || '';
            let title;
            let description;
            let repairSuggest;

            if (template) {
                title = `${companyName}${pathText}${template.title}`;
                description = template.description;
                repairSuggest = template.repairSuggest;
            } else {
                title = `${companyName}${pathText}存在sql注入漏洞`;
                description = title;
            }
            
            // 更新表单
            const data = {
                companyName: companyName,
                host: host,
                title: title,
                urls: [url],
                region: region,
                description: description,
                repairSuggest: repairSuggest
            };
            
            updateFormFromResponse(data);
            await saveConfig(getFormData());
            
            // 自动应用配置到补天页面
            try {
                showStatus('正在应用配置到补天页面...', 'info');
                const config = getFormData();
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'applyConfig',
                    config: config
                });
                
                showStatus(`识别并应用完成！厂商：${companyName}`, 'success');
            } catch (applyError) {
                console.log('应用配置失败:', applyError);
                showStatus(`识别完成！厂商：${companyName}（应用配置失败）`, 'warning');
            }
            
        } catch (error) {
            console.error('自动识别错误:', error);
            showStatus('识别失败：' + error.message, 'error');
        } finally {
            document.getElementById('autoDetectBtn').disabled = false;
        }
    }
    
    // 提取根域名
    function extractRootDomain(hostname) {
        const parts = hostname.split('.');
        if (parts.length <= 2) return hostname;
        const tld = parts.slice(-2).join('.');
        const compositeTlds = ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'ac.cn', 'co.uk', 'org.uk', 'edu.cn'];
        if (compositeTlds.includes(tld)) {
            return parts.slice(-3).join('.');
        }
        return tld;
    }

    async function handleManualSync() {
        try {
            showStatus('正在手动同步到补天页面...', 'info');
            document.getElementById('manualSyncBtn').disabled = true;
            
            const config = getFormData();
            await saveConfig(config);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'applyConfig',
                config: config
            });
            
            showStatus('手动同步完成', 'success');
        } catch (error) {
            console.error('手动同步失败:', error);
            showStatus('手动同步失败：' + error.message, 'error');
        } finally {
            document.getElementById('manualSyncBtn').disabled = false;
        }
    }

    function updateFormFromResponse(data) {
        if (data.companyName) document.getElementById('companyName').value = data.companyName;
        if (data.host) document.getElementById('host').value = data.host;
        if (data.title) document.getElementById('title').value = data.title;
        if (data.urls) document.getElementById('urls').value = data.urls.join(',');
        if (data.region) document.getElementById('region').value = data.region;
        if (data.description) document.getElementById('description').value = data.description;
        if (data.repairSuggest) document.getElementById('repairSuggest').value = data.repairSuggest;
    }

    async function handleReset() {
        if (confirm('确定要重置所有配置吗？')) {
            await saveConfig(DEFAULT_CONFIG);
            loadConfig();
            showStatus('配置已重置', 'success');
        }
    }

    function getFormData() {
        return {
            companyName: document.getElementById('companyName').value,
            host: document.getElementById('host').value,
            category: document.getElementById('category').value,
            title: document.getElementById('title').value,
            urls: document.getElementById('urls').value.split(',').map(u => u.trim()).filter(u => u),
            vulnType: document.getElementById('vulnType').value,
            weight: document.getElementById('weight').value,
            activeId: document.getElementById('activeId').value,
            description: document.getElementById('description').value,
            repairSuggest: document.getElementById('repairSuggest').value,
            region: document.getElementById('region').value,
            companyContact: document.getElementById('companyContact').value,
            autoFill: true,
            anonymous: true
        };
    }

    function setFormData(config) {
        document.getElementById('companyName').value = config.companyName || '';
        document.getElementById('host').value = config.host || '';
        document.getElementById('category').value = config.category || '1';
        document.getElementById('title').value = config.title || '';
        document.getElementById('urls').value = (config.urls || []).join(',');
        document.getElementById('vulnType').value = config.vulnType || '0';
        document.getElementById('weight').value = config.weight || '1';
        document.getElementById('activeId').value = config.activeId || '';
        document.getElementById('description').value = config.description || '';
        document.getElementById('repairSuggest').value = config.repairSuggest || '';
        document.getElementById('region').value = config.region || '';
        document.getElementById('companyContact').value = config.companyContact || '';
        
        // 确保权重默认选择
        const weightSelect = document.getElementById('weight');
        if (weightSelect && (!weightSelect.value || weightSelect.value === '')) {
            weightSelect.value = '1';
        }
    }

    async function loadConfig() {
        try {
            const result = await chrome.storage.local.get(['butianConfig']);
            const config = result.butianConfig ? { ...DEFAULT_CONFIG, ...result.butianConfig } : DEFAULT_CONFIG;
            setFormData(config);
        } catch (error) {
            console.error('加载配置失败:', error);
            setFormData(DEFAULT_CONFIG);
        }
        
        loadActiveOptions();
    }

    async function saveConfig(config) {
        try {
            await chrome.storage.local.set({ butianConfig: config });
        } catch (error) {
            console.error('保存配置失败:', error);
            throw error;
        }
    }

    async function loadActiveOptions() {
        const selectEl = document.getElementById('activeId');
        if (!selectEl) return;

        const defaultOptions = [
            { value: '', text: '请选择' },
            { value: '163', text: '【2025专属SRC全年积分挑战赛】' },
            { value: '181', text: '2025GROW计划第二期-老白帽' }
        ];

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error('未找到活动标签页');

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getActiveOptions' });
            if (!response?.success || !response.options?.length) {
                throw new Error(response?.error || '没有可用活动');
            }

            const currentValue = selectEl.value;
            selectEl.innerHTML = '';
            response.options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.text;
                selectEl.appendChild(optionEl);
            });

            if (currentValue && response.options.some(opt => opt.value === currentValue)) {
                selectEl.value = currentValue;
            }
        } catch (error) {
            console.log('加载活动列表失败，使用默认列表:', error.message);
            const currentValue = selectEl.value;
            selectEl.innerHTML = '';
            defaultOptions.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.text;
                selectEl.appendChild(optionEl);
            });
            if (currentValue && defaultOptions.some(opt => opt.value === currentValue)) {
                selectEl.value = currentValue;
            }
        }
    }

    function showStatus(message, type) {
        const statusEl = document.getElementById('autoStatus');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = 'block';
        
        // 3秒后隐藏
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }

    function setupAutoSave() {
        const fields = document.querySelectorAll('.content input, .content textarea, .content select');
        fields.forEach(field => {
            const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
            field.addEventListener(eventName, scheduleSaveConfig);
        });
    }

    function scheduleSaveConfig() {
        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(async () => {
            try {
                const formData = getFormData();
                await saveConfig(formData);
            } catch (error) {
                console.error('自动保存配置失败:', error);
            }
        }, 500);
    }
});
