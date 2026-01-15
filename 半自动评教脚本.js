// ==UserScript==
// @name         高校教务系统"教学评价"半自动选择脚本
/// @namespace    https://github.com/Ayuan159357/xhu-Student-evaluation-of-teaching-quality
// @license       MIT 
// @version      2026.1.15.3
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
    const injectedId = 'uni-eval-ui-v4';

    // 1. 样式
    GM_addStyle(`
        #${injectedId} { position: fixed; right: 20px; bottom: 20px; z-index: 10000; font-family: "Microsoft YaHei", Arial; }
        #${injectedId} .sc-panel { background: #fff; border: 1px solid #dcdfe6; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border-radius:10px; width:260px; overflow:hidden; }
        #${injectedId} .sc-header { background:#409EFF; color:#fff; padding:12px; font-weight:bold; display:flex; justify-content:space-between; }
        #${injectedId} .sc-body { padding:15px; }
        #${injectedId} .sc-btn { display:block; width:100%; margin-bottom:10px; padding:10px; border-radius:6px; cursor:pointer; font-size:14px; text-align:center; border:none; font-weight: bold; color:#fff; }
        #${injectedId} .sc-btn.primary { background:#67C23A; }
        #${injectedId} .sc-btn.warn { background:#909399; }
        #${injectedId} .sc-hint { font-size:12px; color:#606266; line-height:1.6; margin-bottom:12px; background: #f4f4f5; padding: 10px; border-radius: 4px; border-left: 4px solid #409EFF;}
        #${injectedId} .sc-status { font-size:14px; color:#409EFF; font-weight:bold; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    `);

    const isMtc = host.includes('mtc.edu.cn');
    const isSwust = host.includes('swust.edu.cn');
    const isXhu = host.includes('xhu.edu.cn');
    const schoolName = isMtc ? "绵阳师范学院" : (isSwust ? "西南科技大学" : "西华大学");

    const wrapper = document.createElement('div');
    wrapper.id = injectedId;
    wrapper.innerHTML = `
        <div class="sc-panel">
            <div class="sc-header"><span>评教助手 - ${schoolName}</span></div>
            <div class="sc-body">
                <div class="sc-hint" id="eval-hint">脚本运行期间请勿切换标签页。</div>
                <button id="eval-run" class="sc-btn primary">开始一键评教</button>
                <button id="eval-close" class="sc-btn warn">关闭面板</button>
                <div class="sc-status" id="eval-status">就绪</div>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);

   


    function safeClick(el) {
        if (!el) return;
      
        el.scrollIntoView({ block: "center", behavior: "auto" }); 
        
        
        ['mousedown', 'mouseup', 'click'].forEach(name => {
            const evt = new MouseEvent(name, {
                bubbles: true,
                cancelable: true
              
            });
            el.dispatchEvent(evt);
        });

       
        const input = el.querySelector('input');
        if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

   

    async function runMtc() {
        const status = document.getElementById('eval-status');
        const leftItems = document.querySelectorAll('.itemLists-citem');
        
        if (leftItems.length === 0) {
            status.textContent = "未找到指标，请确认页面加载";
            return;
        }

        for (let i = 0; i < leftItems.length; i++) {
            const item = leftItems[i];
            const title = item.innerText || "";

            if (title.includes("建议")) {
                status.textContent = "已到建议项，请手动填写";
                safeClick(item);
                break;
            }

            status.textContent = `切换指标: ${i+1}/${leftItems.length}`;
            console.log(`[评教助手] 正在处理: ${title.substring(0,20)}...`);
            
            safeClick(item);
            await wait(1500); 

          
            const radioGroups = document.querySelectorAll('.cardtlists-item .el-radio-group');
            
            if (radioGroups.length === 0) {
                console.log("[评教助手] 右侧加载慢，重试中...");
                await wait(1000); 
            }

            const currentRadios = document.querySelectorAll('.cardtlists-item .el-radio-group');
            currentRadios.forEach((group) => {
           
                const firstOpt = group.querySelector('label.el-radio-button:first-child');
                if (firstOpt && !firstOpt.classList.contains('is-active')) {
                    safeClick(firstOpt);
                }
            });

            await wait(300);
        }
        status.textContent = "指标填写完毕！";
    }


    function runSwust() {
        const options = document.querySelectorAll('td.quota a[data-opt="1"]');
        let i = 0;
        const timer = setInterval(() => {
            if (i < options.length) {
                safeClick(options[i]);
                document.getElementById('eval-status').textContent = `进度: ${i+1}/${options.length}`;
                i++;
            } else {
                clearInterval(timer);
                const tx = document.getElementById('CourseComment');
                if (tx) { 
                    tx.value = "无"; 
                    tx.dispatchEvent(new Event('input', { bubbles: true })); 
                }
                const post = document.getElementById('postTrigger');
                if (post) { post.disabled = false; post.classList.remove('disabled'); }
                document.getElementById('eval-status').textContent = "填写完成";
            }
        }, 400);
    }

    function runXhu() {
        const rows = document.querySelectorAll('.panel-pjdx .tr-xspj');
        rows.forEach((tr, idx) => {
            const cls = (idx === 0) ? '.input-xspj-2 input.radio-pjf' : '.input-xspj-1 input.radio-pjf';
            const input = tr.querySelector(cls);
            if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        document.getElementById('eval-status').textContent = "填写完毕";
    }



    document.getElementById('eval-run').addEventListener('click', function() {
        this.disabled = true;
        this.style.opacity = "0.5";
        if (isMtc) runMtc();
        else if (isSwust) runSwust();
        else if (isXhu) runXhu();
    });

    document.getElementById('eval-close').addEventListener('click', () => wrapper.remove());

})();
