// content.js - 内容脚本
(function() {
    'use strict';

    let currentConfig = null;
    let isAutoFillEnabled = true;

    // 初始化
    init();

    function init() {
        loadConfig();
        setupMessageListener();
        
        // 页面加载完成后自动填充
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', handlePageLoad);
        } else {
            handlePageLoad();
        }
    }

    async function loadConfig() {
        try {
            const result = await chrome.storage.local.get(['butianConfig']);
            currentConfig = result.butianConfig;
            isAutoFillEnabled = currentConfig?.autoFill !== false;
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'autoDetect') {
                handleAutoDetect(request.url)
                    .then(result => sendResponse({ success: true, data: result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
            }
            
            if (request.action === 'applyConfig') {
                currentConfig = request.config;
                isAutoFillEnabled = currentConfig.autoFill !== false;
                fillForm(currentConfig);
                sendResponse({ success: true });
                return;
            }

            if (request.action === 'getActiveOptions') {
                const selectEl = document.querySelector('select[name="active_id"]');
                if (!selectEl) {
                    sendResponse({ success: false, error: '未找到活动下拉框' });
                    return;
                }

                const options = Array.from(selectEl.options).map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }));

                sendResponse({ success: true, options });
            }
        });
    }

    async function handlePageLoad() {
        if (isAutoFillEnabled && currentConfig) {
            // 等待页面完全加载
            setTimeout(() => {
                fillForm(currentConfig);
            }, 2000);
        }
    }

    async function handleAutoDetect(url) {
        try {
            const urlObj = new URL(url);
            const host = extractRootDomain(urlObj.hostname);
            let path = urlObj.pathname;
            if (path.endsWith('/')) path = path.slice(0, -1);
            path = path.replace(/\?.*$/, '');

            // 查询厂商名称
            const companyName = await queryCompany(host);
            
            // 查询地区
            const region = await queryRegion(companyName);

            // 生成标题
            const title = `${companyName}${path}存在sql注入漏洞`;

            return {
                companyName: companyName,
                host: host,
                title: title,
                urls: [url],
                region: region,
                description: title
            };
        } catch (error) {
            throw new Error('URL识别失败: ' + error.message);
        }
    }

    async function queryCompany(host) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'queryCompany',
                host: host
            }, (response) => {
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    async function queryRegion(companyName) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'queryRegion',
                companyName: companyName
            }, (response) => {
                if (response.success) {
                    resolve(response.data);
                } else {
                    resolve('未知/未知/未知');
                }
            });
        });
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

    // 填充表单
    async function fillForm(config) {
        if (!config) return;

        // 基本字段
        setValue('input[name="company_name"]', config.companyName || '');
        setValue('input[name="host"]', config.host || '');
        setValue('input[name="title"]', config.title || '');

        // 漏洞URL：支持多个
        const urlInputs = document.querySelectorAll('input[name="url[]"]');
        (config.urls || []).forEach((url, index) => {
            if (urlInputs[index]) {
                urlInputs[index].value = url;
            } else if (index > 0) {
                const addBtn = document.querySelector('#liaddURL a.addInpuus');
                if (addBtn) addBtn.click();
                const newInput = document.querySelectorAll('input[name="url[]"]')[index];
                if (newInput) newInput.value = url;
            }
        });

        // 漏洞类别、类型、属性、等级 - 顺序设置以处理动态加载
        setSelect('select[name="selCate"]', config.category || '1');
        await delay(1000);

        setSelect('select[name="attribute"]', config.vulnAttribute || '1');
        await delay(1000);

        setSelect('select[name="type"]', config.vulnType || '67');
        await delay(1000);

        setSelect('select[name="level"]', config.level || '');

        // 权重
        setSelect('select[name="weight"]', config.weight || '0');

        // 活动和任务
        setSelect('select[name="active_id"]', config.activeId || '163');
        setSelect('select[name="mission_id"]', config.missionId || '87');

        // 描述和细节在类型选择后再设置，避免被页面默认模板覆盖
        await delay(300);
        setValue('textarea[name="description"]', config.description || '');
        
        // 详细细节：UEditor
        if (window.UE) {
            const ue = UE.getEditor('detail');
            if (ue) {
                ue.ready(() => ue.setContent(config.detail || ''));
            }
        }

        // 修复建议
        setValue('textarea[name="repair_suggest"]', config.repairSuggest || '');

        // 所属行业 - 默认设置
        setSelect('select[name="industryLoo1"]', '17');
        await delay(1000);
        const l2Checkbox = document.querySelector('input[id="331"]');
        if (l2Checkbox) {
            l2Checkbox.checked = true;
            l2Checkbox.dispatchEvent(new Event('change'));
        }

        // 所属地区 - 顺序设置以处理联动
        if (config.region) {
            const regionParts = config.region.split('/');
            setSelect('select[name="province"]', regionParts[0] || '');
            await delay(1000);
            setSelect('select[name="city"]', regionParts[1] || '');
            await delay(1000);
            setSelect('select[name="county"]', regionParts[2] || '');
        }

        // 厂商联系方式
        setValue('input[name="company_contact"]', config.companyContact || '');

        // 匿名提交
        const checkbox = document.querySelector('input[name="anonymous"]');
        if (checkbox) checkbox.checked = config.anonymous !== false;

        // 其他可选字段
        setValue('textarea[name="firmware"]', config.firmware || '');
        setSelect('select[name="sysType"]', config.sysType || '0');
        setValue('input[name="sysVer"]', config.sysVer || '');
        setValue('input[name="mobileType"]', config.mobileType || '');
        setValue('textarea[name="sysNum"]', config.vulnNumber || '');
    }

    function setValue(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.value = value;
    }

    function setSelect(selector, value) {
        const el = document.querySelector(selector);
        if (el) {
            const options = Array.from(el.options);
            const matchingOption = options.find(opt => opt.value === value || opt.text.includes(value));
            if (matchingOption) {
                el.value = matchingOption.value;
                el.dispatchEvent(new Event('change'));
            }
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
})();

