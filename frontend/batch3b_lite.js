/* Batch 3B Lite — explainable scoring, data provenance labels, and optional opportunity adjustments. */
(function () {
  "use strict";

  var previousRenderAll = renderAll;
  var previousSortOpportunities = sortOpportunitiesByPriority;
  var previousRenderFinalPage = renderFinalPage;

  workflowState.batch3bOpportunityAdjustments = workflowState.batch3bOpportunityAdjustments || {};
  workflowState.batch3bSelectedOpportunity = workflowState.batch3bSelectedOpportunity || null;

  var brandSourceMap = {
    "美的": ["S001", "S005"],
    "九阳": ["S002", "S005"],
    "苏泊尔": ["S003", "S005"],
    "小熊": ["S004", "S005"],
    "我方规划": []
  };

  var featureWhyNotFull = {
    "加热均匀性": "尚未接入统一工况下的温差与熟度实测，不能视为满分能力。",
    "可视窗": "尚缺少长期耐用、油污附着和观察清晰度的统一测试。",
    "易清洁性": "尚未完成相同油污条件下的清洗时间与死角测试。",
    "噪音控制": "尚未完成统一距离与档位下的分贝实测。",
    "小家庭适配": "尚未通过真实用户任务验证份量、菜谱与使用频率匹配度。"
  };

  function normalizeBrand(label) {
    if (label.indexOf("我方") >= 0) return "我方规划";
    if (label.indexOf("美的") >= 0) return "美的";
    if (label.indexOf("九阳") >= 0) return "九阳";
    if (label.indexOf("苏泊尔") >= 0) return "苏泊尔";
    if (label.indexOf("小熊") >= 0) return "小熊";
    return "";
  }

  function scoreNumber(raw) {
    var match = String(raw || "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function buildScoreExplanation(selected) {
    var label = selected && selected.label ? selected.label : "评分";
    var value = selected && selected.value ? selected.value : "暂无";
    var parts = label.split("｜");
    var isOverall = parts[0] === "综合评分";

    if (isOverall) {
      var overallBrand = parts[1] || "产品";
      var dimension = parts[2] || "评分维度";
      return {
        title: overallBrand + "｜" + dimension,
        value: value,
        type: "Demo 模拟",
        typeClass: "demo",
        confidence: "低",
        method: "课堂演示采用五个维度各 20 分的示意权重，用于展示分析流程，不是实际市场测算。",
        positives: ["综合公开商品信息与结构化字段形成演示性判断。"],
        deductions: ["未接入真实销量、市场份额、成本与利润数据。"],
        whyNotFull: "该分数仅用于演示 Agent 如何组织判断，不能替代真实商业评估。",
        evidenceIds: brandSourceMap[normalizeBrand(overallBrand)] || []
      };
    }

    var feature = parts[0] || "功能";
    var brand = normalizeBrand(label);
    var score = scoreNumber(value);
    var param = String(value).split("｜")[1] || "暂无参数";
    var planned = brand === "我方规划";
    var positiveText = planned
      ? "当前分数来自产品规划目标：" + param + "。"
      : "当前分数综合结构化参数与公开页面信息：" + param + "。";
    var deduction = score !== null && score <= 5
      ? "公开信息不足、能力未配置或存在明显短板。"
      : score !== null && score <= 7
        ? "具备基础能力，但缺少独立实测或稳定用户反馈。"
        : "优势较明确，但尚未满足统一实测和长期验证条件。";

    return {
      title: feature + "｜" + (brand || "产品"),
      value: value,
      type: planned ? "规划目标" : "证据推断",
      typeClass: planned ? "plan" : "inference",
      confidence: planned ? "低" : (brand === "美的" ? "中高" : "中"),
      method: planned
        ? "依据我方产品定义与目标参数形成规划分，不代表样机实测结果。"
        : "依据结构化字段、商品页描述与公开评价形成规则化判断。",
      positives: [positiveText],
      deductions: [deduction],
      whyNotFull: featureWhyNotFull[feature] || "尚缺少统一口径的实测与用户验证，因此不作为满分结论。",
      evidenceIds: brandSourceMap[brand] || []
    };
  }

  function sourceButtons(ids) {
    if (!ids || !ids.length) return '<span class="score-evidence-empty">暂无外部来源；当前为规划或 Demo 模拟。</span>';
    return ids.map(function (id) {
      return '<button class="text-button score-source-link" type="button" data-source="' + escapeHtml(id) + '">查看来源 ' + escapeHtml(id) + '</button>';
    }).join("");
  }

  renderScoreExplanationPanel = function () {
    if (!runtime.selectedScore) {
      return '<div class="score-placeholder score-explanation-empty">点击评分单元格，可查看评分类型、主要依据、扣分原因和证据。无需逐项确认。</div>';
    }
    var info = buildScoreExplanation(runtime.selectedScore);
    return '<div class="score-explanation-card">' +
      '<div class="score-explanation-head"><div><b>' + escapeHtml(info.title) + '</b><div class="score-explanation-value">' + escapeHtml(info.value) + '</div></div>' +
      '<span class="data-type-badge ' + info.typeClass + '">' + escapeHtml(info.type) + '</span></div>' +
      '<div class="score-confidence">置信度：' + escapeHtml(info.confidence) + '</div>' +
      '<p class="score-method">' + escapeHtml(info.method) + '</p>' +
      '<div class="score-reason-row"><b>主要依据</b><span>' + escapeHtml(info.positives.join("；")) + '</span></div>' +
      '<div class="score-reason-row"><b>扣分原因</b><span>' + escapeHtml(info.deductions.join("；")) + '</span></div>' +
      '<div class="score-reason-row"><b>为何不是满分</b><span>' + escapeHtml(info.whyNotFull) + '</span></div>' +
      '<div class="score-evidence-links">' + sourceButtons(info.evidenceIds) + '</div>' +
      '</div>';
  };

  sortOpportunitiesByPriority = function (items) {
    var merged = (items || []).map(function (item) {
      var adjustment = workflowState.batch3bOpportunityAdjustments[item.feature] || {};
      return Object.assign({}, item, {
        priority: adjustment.priority || item.priority,
        excludedFromReport: Boolean(adjustment.excludedFromReport)
      });
    });
    return previousSortOpportunities(merged);
  };

  renderFinalPage = function () {
    var activeSort = sortOpportunitiesByPriority;
    sortOpportunitiesByPriority = function (items) {
      return activeSort(items).filter(function (item) { return !item.excludedFromReport; });
    };
    try {
      previousRenderFinalPage();
      var excluded = Object.keys(workflowState.batch3bOpportunityAdjustments || {}).filter(function (feature) {
        return workflowState.batch3bOpportunityAdjustments[feature].excludedFromReport;
      });
      if (excluded.length) {
        var headings = Array.prototype.slice.call(document.querySelectorAll('#final .report-main h2'));
        var chapterSix = headings.find(function (node) { return node.textContent.indexOf('第六章：产品策略建议') === 0; });
        if (chapterSix && !document.querySelector('#final .batch3b-report-adjustment')) {
          var notice = document.createElement('div');
          notice.className = 'batch3b-report-adjustment';
          notice.innerHTML = '<b>用户调整说明</b><p>' + escapeHtml(excluded.join('、')) + ' 已暂不纳入报告建议清单；如在分析正文中出现，仅作为市场观察，不构成当前产品建议。</p>';
          chapterSix.parentNode.insertBefore(notice, chapterSix);
        }
      }
    } finally {
      sortOpportunitiesByPriority = activeSort;
    }
  };

  function tag(text, cls) {
    return '<span class="data-type-badge ' + cls + '">' + text + '</span>';
  }

  function findCompareScale(titleStart) {
    var headings = Array.prototype.slice.call(document.querySelectorAll("#mainTask .compare-scale h3"));
    var heading = headings.find(function (node) { return node.textContent.trim().indexOf(titleStart) === 0; });
    return heading ? heading.closest(".compare-scale") : null;
  }

  function addBadgeToHeading(scale, badges) {
    if (!scale) return;
    var heading = scale.querySelector("h3");
    if (!heading || heading.querySelector(".data-type-badge")) return;
    var wrap = document.createElement("span");
    wrap.className = "data-type-inline";
    wrap.innerHTML = badges.join("");
    heading.appendChild(wrap);
  }

  function annotateOverallScores() {
    var scale = findCompareScale("综合评分排名");
    if (!scale) return;
    addBadgeToHeading(scale, [tag("Demo 模拟", "demo")]);
    if (!scale.querySelector(".batch3b-data-note")) {
      var note = document.createElement("p");
      note.className = "batch3b-data-note";
      note.textContent = "该表用于展示评分流程，市场份额、热销程度和利润率未接入真实经营数据，不作为正式商业结论。";
      scale.insertBefore(note, scale.querySelector("table"));
    }
    var rows = scale.querySelectorAll("tbody tr");
    var dimensions = ["市场份额", "热销程度", "去同质化", "独家技术", "利润率", "总分"];
    rows.forEach(function (row) {
      var cells = row.querySelectorAll("td");
      if (cells.length < 8) return;
      var brand = cells[1].textContent.trim();
      for (var i = 2; i <= 7; i += 1) {
        var cell = cells[i];
        cell.setAttribute("data-score", "");
        cell.setAttribute("data-score-label", "综合评分｜" + brand + "｜" + dimensions[i - 2]);
        cell.setAttribute("data-score-value", cell.textContent.trim() + (i === 7 ? "/100" : "/20"));
        cell.setAttribute("data-score-evidence", "Demo 模拟");
      }
    });
  }

  function annotateSectionTypes() {
    addBadgeToHeading(findCompareScale("六维痛点分析"), [tag("证据推断", "inference")]);
    addBadgeToHeading(findCompareScale("核心功能对比"), [tag("竞品：证据推断", "inference"), tag("我方：规划目标", "plan")]);
    addBadgeToHeading(findCompareScale("波士顿矩阵定位"), [tag("Demo 模拟", "demo")]);
    addBadgeToHeading(findCompareScale("SWOT分析"), [tag("证据推断", "inference")]);
    addBadgeToHeading(findCompareScale("差异化机会点与优先级"), [tag("证据推断", "inference")]);
    var bcg = findCompareScale("波士顿矩阵定位");
    if (bcg && !bcg.querySelector(".batch3b-data-note")) {
      var note = document.createElement("p");
      note.className = "batch3b-data-note";
      note.textContent = "矩阵坐标为课堂 Demo 模拟位置，用于展示定位方法，不代表真实市场份额与增长率。";
      bcg.insertBefore(note, bcg.querySelector(".bcg-matrix"));
    }
  }

  function addDataLegend() {
    var article = document.querySelector("#mainTask article.main-card");
    if (!article || !article.textContent.includes("商品对比分析与市场定位")) return;
    if (article.querySelector(".batch3b-data-legend")) return;
    var sectionHead = article.querySelector(".section-head");
    if (!sectionHead) return;
    var legend = document.createElement("div");
    legend.className = "batch3b-data-legend";
    legend.innerHTML = '<b>数据口径</b>' + tag("真实采集", "collected") + tag("证据推断", "inference") + tag("规划目标", "plan") + tag("Demo 模拟", "demo") + '<span>点击评分可查看具体依据。</span>';
    sectionHead.insertAdjacentElement("afterend", legend);
  }

  function markSelectedScore() {
    var selected = runtime.selectedScore && runtime.selectedScore.label;
    document.querySelectorAll("#mainTask [data-score]").forEach(function (cell) {
      cell.classList.toggle("is-selected-score", Boolean(selected && cell.dataset.scoreLabel === selected));
    });
  }

  function opportunityItems() {
    return sortOpportunitiesByPriority(useData("differentiationOpportunities", differentiationOpportunities));
  }

  function ensureOpportunityPopover() {
    var popover = document.getElementById("batch3bOpportunityPopover");
    if (popover) return popover;
    popover = document.createElement("div");
    popover.id = "batch3bOpportunityPopover";
    popover.className = "batch3b-opportunity-popover";
    popover.hidden = true;
    document.body.appendChild(popover);
    return popover;
  }

  function positionOpportunityPopover(anchor, popover) {
    var rect = anchor.getBoundingClientRect();
    var width = Math.min(330, window.innerWidth - 24);
    var left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    var top = rect.bottom + 8;
    if (top + 260 > window.innerHeight) top = Math.max(12, rect.top - 260);
    popover.style.width = width + "px";
    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  function openOpportunityPopover(feature, anchor) {
    var item = opportunityItems().find(function (op) { return op.feature === feature; });
    if (!item) return;
    workflowState.batch3bSelectedOpportunity = feature;
    var adjustment = workflowState.batch3bOpportunityAdjustments[feature] || {};
    var priority = adjustment.priority || item.priority;
    var excluded = Boolean(adjustment.excludedFromReport);
    var popover = ensureOpportunityPopover();
    popover.innerHTML = '<div class="batch3b-opportunity-head"><div><b>' + escapeHtml(feature) + '</b><span>默认已采纳 AI 推荐</span></div><button type="button" data-b3b-opportunity-close aria-label="关闭">×</button></div>' +
      '<label class="batch3b-opportunity-field">优先级<select id="batch3bOpportunityPriority"><option value="P0"' + (priority === "P0" ? " selected" : "") + '>P0｜优先验证</option><option value="P1"' + (priority === "P1" ? " selected" : "") + '>P1｜重要方向</option><option value="P2"' + (priority === "P2" ? " selected" : "") + '>P2｜观察方向</option></select></label>' +
      '<label class="batch3b-opportunity-check"><input id="batch3bOpportunityExclude" type="checkbox"' + (excluded ? " checked" : "") + '>暂不进入报告建议清单</label>' +
      '<p>只在需要覆盖 AI 推荐时调整；默认不需要逐项确认。</p>' +
      '<div class="batch3b-opportunity-actions"><button class="btn primary" type="button" data-b3b-opportunity-apply>应用调整</button><button class="btn" type="button" data-b3b-opportunity-close>取消</button></div>';
    popover.hidden = false;
    positionOpportunityPopover(anchor, popover);
  }

  function closeOpportunityPopover() {
    var popover = document.getElementById("batch3bOpportunityPopover");
    if (popover) popover.hidden = true;
  }

  function enhanceOpportunities() {
    var scale = findCompareScale("差异化机会点与优先级");
    if (!scale) return;
    if (!scale.querySelector(".batch3b-opportunity-hint")) {
      var hint = document.createElement("p");
      hint.className = "batch3b-opportunity-hint";
      hint.textContent = "默认采纳 AI 推荐并按 P0 → P1 → P2 排序；仅在需要时调整优先级或暂不纳入报告。";
      scale.insertBefore(hint, scale.querySelector(".diff-list"));
    }
    scale.querySelectorAll(".diff-item").forEach(function (node) {
      var featureNode = node.querySelector("b");
      if (!featureNode) return;
      var feature = featureNode.textContent.trim();
      var adjustment = workflowState.batch3bOpportunityAdjustments[feature] || {};
      node.classList.toggle("is-excluded-opportunity", Boolean(adjustment.excludedFromReport));
      if (node.querySelector("[data-b3b-opportunity-adjust]")) return;
      var host = node.lastElementChild || node;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "text-button batch3b-opportunity-adjust";
      button.dataset.b3bOpportunityAdjust = feature;
      button.textContent = adjustment.excludedFromReport ? "已排除｜调整" : "调整";
      host.appendChild(button);
    });
  }

  function enhanceCompareUI() {
    if (runtime.stage !== "compare" && runtime.viewStage !== "compare") return;
    addDataLegend();
    annotateOverallScores();
    annotateSectionTypes();
    enhanceOpportunities();
    markSelectedScore();
  }

  renderAll = function () {
    previousRenderAll();
    window.setTimeout(enhanceCompareUI, 0);
  };

  document.addEventListener("click", function (event) {
    var adjust = event.target.closest("[data-b3b-opportunity-adjust]");
    if (adjust) {
      event.preventDefault();
      event.stopPropagation();
      openOpportunityPopover(adjust.dataset.b3bOpportunityAdjust, adjust);
      return;
    }
    if (event.target.closest("[data-b3b-opportunity-close]")) {
      event.preventDefault();
      closeOpportunityPopover();
      return;
    }
    if (event.target.closest("[data-b3b-opportunity-apply]")) {
      event.preventDefault();
      var feature = workflowState.batch3bSelectedOpportunity;
      if (!feature) return;
      var priority = document.getElementById("batch3bOpportunityPriority").value;
      var excluded = document.getElementById("batch3bOpportunityExclude").checked;
      workflowState.batch3bOpportunityAdjustments[feature] = { priority: priority, excludedFromReport: excluded };
      if (typeof nextVersion === "function") {
        nextVersion("调整机会点：" + feature, ["机会点优先级", excluded ? "报告建议清单排除" : "报告建议清单"]);
      }
      runtime.statusText = "机会点设置已更新";
      showToast(excluded ? "该机会点已暂不纳入报告建议清单。" : "机会点优先级已更新。" );
      closeOpportunityPopover();
      renderAll();
      return;
    }
  }, true);

  window.addEventListener("resize", closeOpportunityPopover);
  window.setTimeout(enhanceCompareUI, 0);
})();
