/* 叙事层交互：只记录访问者的判断与揭晓状态。
 * 不运行模拟、不伪造模型结果、不写入历史数据，也不修改参数。
 */
(function () {
  'use strict';
  const feedback = {
    '1': [
      '你抓住了当下增长，但“现在增长”无法独自证明未来的接续。',
      '你注意到投资风险，但单凭当年投资变化，也不能断言未来一定下滑。',
      '这个判断保留了必要的时间差和证据缺口：先看项目，再判断增长能否接上。'
    ],
    '2': [
      '现实中可能存在直接和间接联系；只凭单个节点，无法确定模型后续会怎样。',
      '这把网络里的角色看得太一致了。模型中不同主体可能呈现不同方向或程度的变化。',
      '你没有预设每个主体的命运。进入真实实验后，再看两条模型路径与实际差异。'
    ],
    '3': [
      '金额是承诺的一部分，不等于已经兑现的净经济贡献。',
      '公开资料列出一家企业，不代表它是新落地项目，更不能自动算作新增投资。',
      '从是否真正新增、是否挤出存量、资源是否承受得住开始，才有可审查的比较。'
    ]
  };
  const completed = new Set();
  const progress = document.getElementById('journey-progress');
  function updateProgress() {
    if (progress) progress.textContent = '已完成 ' + completed.size + ' / 3 次判断';
  }
  for (const chapter of document.querySelectorAll('[data-puzzle]')) {
    const question = chapter.dataset.puzzle;
    const options = Array.from(chapter.querySelectorAll('[data-choice]'));
    const reveal = chapter.querySelector('.reveal-btn');
    const panel = chapter.querySelector('.answer-panel');
    const response = chapter.querySelector('.answer-response');
    if (!feedback[question] || !reveal || !panel || !response || options.length !== 3) continue;

    let choice = null;
    for (const option of options) {
      option.addEventListener('click', function () {
        const next = Number(option.dataset.choice);
        if (!Number.isInteger(next) || next < 0 || next >= options.length) return;
        choice = next;
        options.forEach(button => button.setAttribute('aria-pressed', String(button === option)));
        reveal.disabled = false;
        reveal.textContent = '揭晓这道题的研究思路 →';
        if (!panel.hidden) {
          panel.hidden = true;
          completed.delete(question);
          updateProgress();
        }
      });
    }
    reveal.addEventListener('click', function () {
      if (choice === null) return;
      response.textContent = feedback[question][choice];
      panel.hidden = false;
      reveal.textContent = '已揭晓 · 可更换判断再看';
      completed.add(question);
      updateProgress();
    });
  }
  updateProgress();
})();
