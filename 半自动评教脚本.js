// ==UserScript==
// @name         西华大学教务系统"学生评价"自动选择
// @namespace    https://github.com/Ayuan159357/xhu-Student-evaluation-of-teaching-quality
// @license       MIT 
// @version      2026.1.14.1
// @description  自动选择第一个问题"比较同意"，其他问题"非常同意"；仅做自动填写（不提交）
// @author       ayuan159357
// @match        https://jwc.xhu.edu.cn/xspjgl/xspj_cxXspjIndex.html?*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function(){
  const injectedId = 'sc-eval-ui-slim';

  if(document.getElementById(injectedId)){
    console.log('评教面板已存在。执行 removeEvalUI() 可删除后重新注入。');
    return;
  }

  // UI 样式
  const style = document.createElement('style');
  style.textContent = `
    #${injectedId} { position: fixed; right: 20px; bottom: 20px; z-index: 999999; font-family: "Microsoft Yahei", Arial; }
    #${injectedId} .sc-panel { background: #fff; border: 1px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border-radius:6px; width:220px; overflow:hidden; }
    #${injectedId} .sc-header { background:#0483d4; color:#fff; padding:8px 10px; font-weight:600; }
    #${injectedId} .sc-body { padding:10px; }
    #${injectedId} .sc-btn { display:inline-block; margin:6px 4px 0 0; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:13px; }
    #${injectedId} .sc-btn.primary { background:#28a745; color:#fff; border:1px solid #1e7e34; }
    #${injectedId} .sc-btn.warn { background:#f0ad4e; color:#fff; border:1px solid #ec971f; }
    #${injectedId} .sc-footer { padding:8px; text-align:right; font-size:12px; color:#666; background:#fbfbfb; border-top:1px solid #eee; }
    #${injectedId} .sc-hint { font-size:12px; color:#333; line-height:1.4;}
    #${injectedId} .sc-close { float:right; color:#fff; cursor:pointer; opacity:0.9;}
    #${injectedId} .sc-close:hover { opacity:1; }
  `;
  document.head.appendChild(style);

  // 创建主面板（简化：只有 一键评教 / 取消）
  const wrapper = document.createElement('div');
  wrapper.id = injectedId;
  wrapper.innerHTML = `
    <div class="sc-panel">
      <div class="sc-header">
        一键评教面板 <span class="sc-close" title="关闭">✕</span>
      </div>
      <div class="sc-body">
        <div class="sc-hint">自动填写：第1题选“比较同意”，其余选“非常同意”。脚本只填写不提交，请手动提交。</div>
        <div style="margin-top:8px;">
          <button id="${injectedId}-run" class="sc-btn primary">一键评教</button>
          <button id="${injectedId}-cancel" class="sc-btn warn">取消</button>
        </div>
        <div style="margin-top:10px;font-size:12px;color:#999">状态：<span id="${injectedId}-status">就绪</span></div>
      </div>
      <div class="sc-footer">自动填写（不提交）</div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const statusSpan = document.getElementById(`${injectedId}-status`);
  const btnRun = document.getElementById(`${injectedId}-run`);
  const btnCancel = document.getElementById(`${injectedId}-cancel`);
  const btnClose = wrapper.querySelector('.sc-close');

  function setStatus(text){
    if(statusSpan) statusSpan.textContent = text;
  }

  // 自动填充函数（仅填写，不触发任何保存/提交的弹窗或跳转）
  function autoFillChoices(){
    const rows = document.querySelectorAll('.panel-pjdx .tr-xspj');
    if(!rows || rows.length === 0){
      console.warn('未找到任何题目行（.panel-pjdx .tr-xspj）。请确认页面已完全加载且选择器匹配。');
      setStatus('未找到题目');
      return false;
    }

    rows.forEach((tr, idx) => {
      // 第1题选择“比较同意”（.input-xspj-2），其他选择“非常同意”（.input-xspj-1）
      const choiceClass = (idx === 0) ? '.input-xspj-2 input.radio-pjf' : '.input-xspj-1 input.radio-pjf';
      const input = tr.querySelector(choiceClass);
      if(input) {
        // 只做非破坏性选择：设置 checked 并触发 change（不进行额外跳转或弹窗）
        try { input.checked = true; } catch(e){}
        try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
      } else {
        console.warn('第 ' + (idx+1) + ' 题找不到目标选项（' + choiceClass + '）', tr);
      }
    });

    setStatus('已自动填写（请手动保存/提交）');
    console.log('自动填写完成：第1题->比较同意，其余->非常同意（脚本未提交）');
    return true;
  }

  // 移除面板及清理（外部可调用）
  function removeEvalUI(){
    try { const node = document.getElementById(injectedId); if(node) node.remove(); } catch(e){}
    try { style.remove(); } catch(e){}
    console.log('已移除自动评教面板。');
  }

  // 事件绑定
  btnRun.addEventListener('click', () => {
    const ok = autoFillChoices();
    if(ok){
      // 保持面板可见，用户手动保存或提交
    }
  });

  btnCancel.addEventListener('click', () => {
    removeEvalUI();
  });

  btnClose.addEventListener('click', () => {
    removeEvalUI();
  });

  window.removeEvalUI = removeEvalUI;

  setStatus('就绪（等待一键评教）');
  console.log('已注入简化版一键评教面板（只填写，不提交，不弹窗）。');
})();
