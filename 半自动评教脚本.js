// ==UserScript==
// @name         正方教务系统-自动评教
// @namespace    https://scriptcat.local/auto-xspj
// @version      0.2.0
// @description  逐个遍历"未评"教师，第一题选"比较同意"，其余选"非常同意"，保存后翻到下一门/下一页，带随机延时防止过快
// @author       you
// @match        *://*/xspjgl/xspj_cxXspjIndex.html*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* =====================  配置区，按需修改  ===================== */
    const CONFIG = {
        // 'save'   只保存不提交（推荐先用这个跑一遍确认没问题）
        // 'submit' 保存并提交
        actionType: 'save',

        // 评语内容，留空字符串则不填写
        comment: '老师讲课认真负责，内容充实，收获很多，希望继续保持。',

        // ---- 节奏控制（毫秒），整体放慢，避免被系统判定为异常操作 ----
        delayBeforeSelectRow: [200, 500],   // 点击某一行之前的等待
        delayAfterFormLoaded: [500, 1000],  // 表单加载完成后，开始填写前的等待
        delayPerQuestion: [20, 80],        // 每选一道题之间的等待
        delayBeforeSave: [80, 300],        // 填完表单，点保存前的等待
        delayAfterSave: [200, 500],        // 关闭成功弹窗后，处理下一门之前的等待
        delayAfterNextPage: [1000, 2000],    // 翻页后，等待新一页数据加载完成

        modalAppearTimeout: 6000,            // 等待"保存成功"弹窗出现的最长时间
        delayAfterModalClose: [200, 500],  // 点了弹窗"确定"之后，再多等一会儿让页面稳定

        rowLoadTimeout: 10000,               // 点击行后等待表单加载的最长时间
    };
    /* ================================================================ */

    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randDelay([min, max]) {
        return sleep(rand(min, max));
    }

    // 用真实鼠标事件序列（mousedown -> mouseup -> click）模拟点击，
    // 而不是用 jQuery 的 .trigger('click')，避免被识别为脚本注入触发的事件
    function simulateClick(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0,
        };
        el.dispatchEvent(new MouseEvent('mouseover', opts));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.focus && el.focus();
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    }

    const $ = window.jQuery;
    if (!$) {
        console.error('[自动评教] 页面未检测到 jQuery，脚本无法运行');
        return;
    }

    let STOP = true;

    function log(msg) {
        const el = document.getElementById('auto-xspj-status');
        if (el) el.textContent = msg;
        console.log('[自动评教]', msg);
    }

    function createPanel() {
        if (document.getElementById('auto-xspj-panel')) return;
        const div = document.createElement('div');
        div.id = 'auto-xspj-panel';
        div.style.cssText =
            'position:fixed;top:90px;right:20px;z-index:99999;background:#fff;' +
            'border:1px solid #ccc;border-radius:8px;padding:12px 14px;' +
            'box-shadow:0 2px 10px rgba(0,0,0,.25);font-size:13px;width:210px;';
        div.innerHTML = `
            <div style="font-weight:bold;margin-bottom:8px;">自动评教助手</div>
            <div style="margin-bottom:6px;color:#888;">
                模式: ${CONFIG.actionType === 'save' ? '仅保存' : '保存并提交'}
            </div>
            <button id="auto-xspj-start" style="margin-right:6px;padding:3px 10px;">开始</button>
            <button id="auto-xspj-stop" style="padding:3px 10px;">停止</button>
            <div id="auto-xspj-status" style="margin-top:8px;color:#666;line-height:1.4;"></div>
        `;
        document.body.appendChild(div);
        document.getElementById('auto-xspj-start').onclick = () => {
            STOP = false;
            run();
        };
        document.getElementById('auto-xspj-stop').onclick = () => {
            STOP = true;
            log('已请求停止（当前这门评价完成后会停下）');
        };
    }

    // 取当前这一页里所有"未评"的行
    function getPendingRows() {
        const rows = [];
        $('#tempGrid tbody tr[role="row"]').each(function () {
            const $tr = $(this);
            if ($tr.hasClass('jqgfirstrow')) return;
            const status = $tr.find('td[aria-describedby="tempGrid_tjztmc"]').attr('title');
            if (status === '未评' || status === '未评完') {
                rows.push(this);
            }
        });
        return rows;
    }

    // 用 jqGrid 官方 API 选中某行，触发页面自带的 onSelectRow（会去发 AJAX 加载右侧表单）
    async function selectRow(row) {
        await randDelay(CONFIG.delayBeforeSelectRow);

        const rowId = $(row).attr('id');
        const jxbId = $(row).find('td[aria-describedby="tempGrid_jxb_id"]').attr('title');

        $('#tempGrid').jqGrid('setSelection', rowId, true);

        let waited = 0;
        while (waited < CONFIG.rowLoadTimeout) {
            const loadedId = $('.xspj-body').attr('data-jxb_id');
            if (loadedId === jxbId) return true;
            await sleep(200);
            waited += 200;
        }
        return false; // 超时，表单可能没加载出来
    }

    // 按分值找到对应的 radio：dyf=100 -> 非常同意；dyf=80 -> 比较同意
    function pickRadioByScore($radios, score) {
        let target = null;
        $radios.each(function () {
            if (parseFloat($(this).attr('data-dyf')) === score) {
                target = this;
            }
        });
        return target;
    }

    // 填写当前已加载出来的评价表单：第一题选"比较同意"(80)，其余全选"非常同意"(100)
    async function fillCurrentForm() {
        await randDelay(CONFIG.delayAfterFormLoaded);

        const $rows = $('.tr-xspj').filter(function () {
            return $(this).find('input.radio-pjf[type=radio]').length > 0;
        });

        for (let i = 0; i < $rows.length; i++) {
            if (STOP) return;
            const $radios = $($rows[i]).find('input.radio-pjf[type=radio]');

            let target;
            if (i === 0) {
                target = pickRadioByScore($radios, 80) || $radios.get(1) || $radios.get(0);
            } else {
                target = pickRadioByScore($radios, 100) || $radios.get(0);
            }

            if (target && !target.checked) {
                simulateClick(target);
                // 有些页面的选中状态依赖 change 事件里的逻辑，保险起见再补发一次
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
            await randDelay(CONFIG.delayPerQuestion);
        }

        const $textarea = $('.xspj-body textarea[name="py"]');
        if ($textarea.length && CONFIG.comment) {
            $textarea.val(CONFIG.comment);
            $textarea.trigger('input').trigger('change').trigger('blur');
        }
    }

    // 拦截可能弹出的 confirm 提示框（有些系统保存/提交前会 confirm("确定要...吗?")）
    function withConfirmBypassed(fn) {
        const original = window.confirm;
        window.confirm = () => true;
        try {
            fn();
        } finally {
            setTimeout(() => {
                window.confirm = original;
            }, 800);
        }
    }

    // 等待"保存成功"弹窗出现，点击"确定"关闭它
    async function waitAndCloseSuccessModal() {
        let waited = 0;
        let okBtn = null;
        while (waited < CONFIG.modalAppearTimeout) {
            okBtn = document.querySelector('#btn_ok');
            if (okBtn && okBtn.offsetParent !== null) break; // 元素存在且可见
            await sleep(200);
            waited += 200;
        }

        if (!okBtn) {
            log('未检测到保存成功弹窗，可能保存失败或弹窗结构不同，请手动检查');
            return false;
        }

        await randDelay([500, 1000]);
        simulateClick(okBtn);

        // 等弹窗真正消失
        let closeWaited = 0;
        while (closeWaited < 3000) {
            const stillThere = document.querySelector('#btn_ok');
            if (!stillThere || stillThere.offsetParent === null) break;
            await sleep(150);
            closeWaited += 150;
        }

        await randDelay(CONFIG.delayAfterModalClose);
        return true;
    }

    async function submitCurrentForm() {
        await randDelay(CONFIG.delayBeforeSave);
        const btnSelector = CONFIG.actionType === 'submit' ? '#btn_xspj_tj' : '#btn_xspj_bc';
        const btnEl = document.querySelector(btnSelector);
        withConfirmBypassed(() => {
            simulateClick(btnEl);
        });
        await waitAndCloseSuccessModal();
        await randDelay(CONFIG.delayAfterSave);
    }

    // 翻到下一页（左侧课程列表分页），成功返回 true，已是最后一页返回 false
    async function goToNextPage() {
        const $next = $('#next_pager');
        if ($next.length === 0 || $next.hasClass('ui-state-disabled')) {
            return false;
        }
        log('本页已处理完，正在翻到下一页...');
        $next.trigger('click');
        await randDelay(CONFIG.delayAfterNextPage);
        return true;
    }

    async function run() {
        createPanel();
        log('正在扫描待评课程...');

        let round = 0;
        while (!STOP) {
            const rows = getPendingRows();

            if (rows.length === 0) {
                const moved = await goToNextPage();
                if (moved) continue; // 翻页成功，回到循环开头重新扫描
                log(`没有更多待评课程了，全部处理完成，共处理 ${round} 门。`);
                return;
            }

            round += 1;
            const row = rows[0];
            const kcmc = $(row).find('td[aria-describedby="tempGrid_kcmc"]').attr('title');
            const jsxm = $(row).find('td[aria-describedby="tempGrid_jzgmc"]').attr('title');
            log(`[第${round}门] 正在处理：${jsxm} - ${kcmc}`);

            const loaded = await selectRow(row);
            if (!loaded) {
                log(`加载超时：${kcmc}，已跳过此门，请手动检查`);
                await randDelay(CONFIG.delayAfterSave);
                continue;
            }

            await fillCurrentForm();
            if (STOP) return;
            await submitCurrentForm();
        }
        log('已停止。');
    }

    $(document).ready(function () {
        createPanel();
        log('准备就绪，点击"开始"按钮运行');
    });
})();
