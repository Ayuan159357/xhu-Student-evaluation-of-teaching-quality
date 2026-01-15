// ==UserScript==
// @name         高校教务系统"学生评价"自动选择
// @namespace    https://github.com/Ayuan159357/xhu-Student-evaluation-of-teaching-quality
// @license       MIT 
// @version      2026.1.15.1
// @description  自动识别学校执行评教。现在支持西科大：全自动首选+意见和建议填“无”；西华：弹窗手动一键填写。
// @author       ayuan159357
// @match        https://matrix.dean.swust.edu.cn/acadmicManager/index.cfm?event=evaluateOnline:evaluateResponse*
// @match        https://jwc.xhu.edu.cn/xspjgl/xspj_cxXspjIndex.html?*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const host = window.location.host;
    const injectedId = 'uni-eval-ui';

    // 1. 注入共用样式
    const style = document.createElement('style');
    style.textContent = `
        #${injectedId} { position: fixed; right: 20px; bottom: 20px; z-index: 999999; font-family: "Microsoft Yahei", Arial; }
        #${injectedId} .sc-panel { background: #fff; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border-radius:8px; width:240px; overflow:hidden; }
        #${injectedId} .sc-header { background:#0483d4; color:#fff; padding:10px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
        #${injectedId} .sc-body { padding:12px; }
        #${injectedId} .sc-btn { display:block; width:100%; margin-bottom:8px; padding:8px; border-radius:4px; cursor:pointer; font-size:14px; text-align:center; border:none; transition: opacity 0.2s; }
        #${injectedId} .sc-btn.primary { background:#28a745; color:#fff; }
        #${injectedId} .sc-btn.warn { background:#6c757d; color:#fff; }
        #${injectedId} .sc-btn:hover { opacity: 0.9; }
        #${injectedId} .sc-hint { font-size:12px; color:#555; line-height:1.5; margin-bottom:10px; border-left: 3px solid #0483d4; padding-left: 8px;}
        #${injectedId} .sc-close { color:#fff; cursor:pointer; font-size:18px; line-height:1; }
        #${injectedId} .sc-status { font-size:12px; color:#0483d4; font-weight:bold; }
    `;
    document.head.appendChild(style);

    // 2. 创建并注入UI面板
    const schoolName = host.includes('swust') ? "西南科技大学" : "西华大学";
    const wrapper = document.createElement('div');
    wrapper.id = injectedId;
    wrapper.innerHTML = `
        <div class="sc-panel">
            <div class="sc-header">
                <span>评教助手 - ${schoolName}</span>
                <span class="sc-close" title="关闭">×</span>
            </div>
            <div class="sc-body">
                <div class="sc-hint" id="${injectedId}-hint">检测到系统已就绪，点击下方按钮开始自动填写。</div>
                <button id="${injectedId}-run" class="sc-btn primary">一键自动填写</button>
                <button id="${injectedId}-cancel" class="sc-btn warn">不再显示</button>
                <div style="margin-top:8px; font-size:12px; color:#999;">状态：<span id="${injectedId}-status">等待操作</span></div>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);

    const btnRun = document.getElementById(`${injectedId}-run`);
    const statusSpan = document.getElementById(`${injectedId}-status`);
    const hintDiv = document.getElementById(`${injectedId}-hint`);

    // 3. 西科大填写逻辑
    function fillSwust() {
        const options = document.querySelectorAll('td.quota a[data-opt="1"]');
        if (options.length === 0) {
            statusSpan.textContent = "未找到题目，请稍后再试";
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
                // 填写意见建议
                const textArea = document.getElementById('CourseComment');
                if (textArea) {
                    textArea.value = "无";
                    textArea.dispatchEvent(new Event('input', { bubbles: true }));
                }
                // 解锁提交按钮
                const submitBtn = document.getElementById('postTrigger');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('disabled');
                }
                statusSpan.textContent = "完成！请手动点击提交";
            }
        }, 300);
    }

    // 4. 西华大学填写逻辑
    function fillXhu() {
        const rows = document.querySelectorAll('.panel-pjdx .tr-xspj');
        if (rows.length === 0) {
            statusSpan.textContent = "未找到题目";
            return;
        }

        rows.forEach((tr, idx) => {
            // 第1题: .input-xspj-2 (比较同意), 其余: .input-xspj-1 (非常同意)
            const choiceClass = (idx === 0) ? '.input-xspj-2 input.radio-pjf' : '.input-xspj-1 input.radio-pjf';
            const input = tr.querySelector(choiceClass);
            if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        statusSpan.textContent = "完成！请手动保存提交";
    }

    // 5. 事件绑定
    btnRun.addEventListener('click', () => {
        statusSpan.textContent = "正在处理...";
        if (host.includes('swust')) {
            fillSwust();
        } else {
            fillXhu();
        }
    });

    const closeUI = () => wrapper.remove();
    document.getElementById(`${injectedId}-cancel`).addEventListener('click', closeUI);
    wrapper.querySelector('.sc-close').addEventListener('click', closeUI);

    // 针对西科大特殊的 Loading 提示
    if (host.includes('swust')) {
        hintDiv.textContent = "西科大评教有3秒加载动画，请等表格显示后再点击。";
    }

})();
