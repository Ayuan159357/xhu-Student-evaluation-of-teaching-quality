// ==UserScript==
// @name         高校教务系统"教学评价"半自动选择脚本
/// @namespace    https://github.com/Ayuan159357/xhu-Student-evaluation-of-teaching-quality
// @license       MIT 
// @version      2026.1.15.2
// @description  自动识别学校执行评教。西科大：全自动首选+意见和建议填“无”；西华：弹窗手动一键填写；绵师：自动选择每一个问题的第一个选项（即全满分）需手动提交；
// @author       ayuan159357
// @match        https://matrix.dean.swust.edu.cn/acadmicManager/index.cfm?event=evaluateOnline:evaluateResponse*
// @match        https://jwc.xhu.edu.cn/xspjgl/xspj_cxXspjIndex.html?*
// @match        http://zljk.mtc.edu.cn/evaluate/studentEvaluate/evaluate-jdpdetail/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==


(function() {
    'use strict';

    const host = window.location.host;
    const injectedId = 'uni-eval-ui-v2';

    // 注入共用样式
    const style = document.createElement('style');
    style.textContent = `
        #${injectedId} { position: fixed; right: 20px; bottom: 20px; z-index: 10000; font-family: "Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","微软雅黑",Arial,sans-serif; }
        #${injectedId} .sc-panel { background: #fff; border: 1px solid #dcdfe6; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius:8px; width:260px; overflow:hidden; }
        #${injectedId} .sc-header { background:#409EFF; color:#fff; padding:12px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
        #${injectedId} .sc-body { padding:15px; }
        #${injectedId} .sc-btn { display:block; width:100%; margin-bottom:10px; padding:10px; border-radius:4px; cursor:pointer; font-size:14px; text-align:center; border:none; transition: all 0.3s; font-weight: bold; }
        #${injectedId} .sc-btn.primary { background:#67C23A; color:#fff; }
        #${injectedId} .sc-btn.primary:hover { background:#85ce61; }
        #${injectedId} .sc-btn.warn { background:#909399; color:#fff; }
        #${injectedId} .sc-hint { font-size:12px; color:#606266; line-height:1.6; margin-bottom:12px; background: #f4f4f5; padding: 8px; border-radius: 4px; border-left: 4px solid #409EFF;}
        #${injectedId} .sc-close { color:#fff; cursor:pointer; font-size:20px; }
        #${injectedId} .sc-progress { font-size:13px; color:#409EFF; font-weight:bold; text-align: center; margin-top: 5px;}
    `;
    document.head.appendChild(style);

    // 识别学校
    let schoolName = "未知学校";
    if (host.includes('swust')) schoolName = "西南科技大学";
    else if (host.includes('xhu')) schoolName = "西华大学";
    else if (host.includes('mnu')) schoolName = "绵阳师范学院";

    //  注入面板
    const wrapper = document.createElement('div');
    wrapper.id = injectedId;
    wrapper.innerHTML = `
        <div class="sc-panel">
            <div class="sc-header">
                <span>评教助手 - ${schoolName}</span>
                <span class="sc-close">×</span>
            </div>
            <div class="sc-body">
                <div class="sc-hint" id="${injectedId}-hint">请进入评教详情页面后点击开始。</div>
                <button id="${injectedId}-run" class="sc-btn primary">开始一键评教</button>
                <button id="${injectedId}-cancel" class="sc-btn warn">关闭面板</button>
                <div class="sc-progress" id="${injectedId}-status">等待中...</div>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);

    const btnRun = document.getElementById(`${injectedId}-run`);
    const statusSpan = document.getElementById(`${injectedId}-status`);
    const hintDiv = document.getElementById(`${injectedId}-hint`);

    // 逻辑

    // A. 绵阳师范学院逻辑 (Vue 异步遍历)
    async function fillMnu() {
        const leftItems = Array.from(document.querySelectorAll('.itemLists-citem'));
        if (leftItems.length === 0) {
            statusSpan.textContent = "错误：未找到指标列表";
            return;
        }

        for (let i = 0; i < leftItems.length; i++) {
            const item = leftItems[i];
            
            // 跳过建议项
            if (item.innerText.includes("建议")) {
                statusSpan.textContent = "已到达建议项，请手动填写并提交";
                item.click();
                break;
            }

            // 点击左侧指标
            item.click();
            statusSpan.textContent = `正在切换指标: ${i+1}/${leftItems.length}`;
            await new Promise(r => setTimeout(r, 800)); // 等待右侧加载

            // 点击右侧所有教师的第一项
            const options = document.querySelectorAll('.cardtlists-item .el-radio-button:first-child');
            options.forEach(opt => {
                if (!opt.classList.contains('is-active')) opt.click();
            });

            statusSpan.textContent = `已完成当前页指标评分`;
            await new Promise(r => setTimeout(r, 500));
        }
        statusSpan.textContent = "全部指标已选完，请检查后提交！";
    }

    // 西南科技大学逻辑
    function fillSwust() {
        const options = document.querySelectorAll('td.quota a[data-opt="1"]');
        if (options.length === 0) {
            statusSpan.textContent = "未找到题目，请确认加载完成";
            return;
        }

        let i = 0;
        const interval = setInterval(() => {
            if (i < options.length) {
                options[i].click();
                statusSpan.textContent = `进度: ${i+1}/${options.length}`;
                i++;
            } else {
                clearInterval(interval);
                const textArea = document.getElementById('CourseComment');
                if (textArea) { textArea.value = "无"; textArea.dispatchEvent(new Event('input', { bubbles: true })); }
                const submitBtn = document.getElementById('postTrigger');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('disabled'); }
                statusSpan.textContent = "完成！请点击网页上的提交";
            }
        }, 300);
    }

    // 西华大学逻辑
    function fillXhu() {
        const rows = document.querySelectorAll('.panel-pjdx .tr-xspj');
        if (rows.length === 0) {
            statusSpan.textContent = "未找到题目";
            return;
        }
        rows.forEach((tr, idx) => {
            const choiceClass = (idx === 0) ? '.input-xspj-2 input.radio-pjf' : '.input-xspj-1 input.radio-pjf';
            const input = tr.querySelector(choiceClass);
            if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        statusSpan.textContent = "填写完成，请手动保存提交";
    }

    //事件处理

    btnRun.addEventListener('click', () => {
        btnRun.disabled = true;
        btnRun.style.opacity = "0.5";
        statusSpan.textContent = "正在启动...";

        if (host.includes('swust')) fillSwust();
        else if (host.includes('xhu')) fillXhu();
        else if (host.includes('mnu')) fillMnu();
    });

    const closeUI = () => wrapper.remove();
    document.getElementById(`${injectedId}-cancel`).addEventListener('click', closeUI);
    wrapper.querySelector('.sc-close').addEventListener('click', closeUI);

    // 学校特定提示
    if (host.includes('mnu')) {
        hintDiv.textContent = "脚本将依次点击左侧指标并自动勾选右侧第一个选项。遇到建议项会停止。";
    } else if (host.includes('swust')) {
        hintDiv.textContent = "等页面加载动画消失，出现表格后再点击开始。意见会自动填'无'。";
    }

})();
