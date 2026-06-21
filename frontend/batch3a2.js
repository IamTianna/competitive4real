/* Batch 3A.2 — default AI handling, optional detail adjustments, and adjacent field actions. */
(function () {
  "use strict";

  var previousRenderInlineQAPanel = renderInlineQAPanel;
  workflowState.batch3a2Expanded = workflowState.batch3a2Expanded || { collecting: false, structuring: false, comparing: false };
  workflowState.batch3a2Choices = workflowState.batch3a2Choices || { collecting: {}, comparing: {} };
  var quickFieldId = null;
  var quickCustomOpen = false;
  var quickAnchor = null;

  // Structure-stage context starts closed. Field actions happen next to the selected cell;
  // the drawer opens only when the user asks for detailed evidence.
  if (!runtime.selectedStructuredField) runtime.contextCollapsed.execution = true;

  function icon(name) {
    return typeof window.batch3Icon === "function" ? window.batch3Icon(name) : "";
  }

  function effectiveQA(stageId) {
    return typeof window.batch3EffectiveQA === "function" ? window.batch3EffectiveQA(stageId) : stageQAResults[stageId];
  }

  function effectiveIssues(stageId, qa) {
    var issues = (qa.issues || []).slice();
    if (stageId === "collecting" && qa.qaStatus === "BLOCK") {
      issues.push({
        violatedRule: "价格时效性",
        issueLevel: "warning",
        issueDesc: "平台价格会随活动变化，当前价格快照只能作为阶段性线索。",
        fixPrompt: "保留采集时间和价格类型，在报告中避免将活动价写成长期定价结论。"
      });
      issues.push({
        violatedRule: "评价样本代表性",
        issueLevel: "warning",
        issueDesc: "公开评价可能包含极端体验，不能直接代表全量用户满意度。",
        fixPrompt: "将评价结果表述为趋势性信号，并在后续验证中补充访谈或售后数据。"
      });
    }
    return issues;
  }

  function statusMeta(status) {
    var map = {
      PENDING: { cls: "pending", label: "待质检", icon: "clock" },
      CHECKING: { cls: "checking", label: "质检中", icon: "clock" },
      PASS: { cls: "pass", label: "已通过", icon: "check" },
      WARNING: { cls: "warning", label: "带风险通过", icon: "alert" },
      BLOCK: { cls: "block", label: "已阻断", icon: "block" }
    };
    return map[status] || map.PENDING;
  }

  function issueKey(issue, index) {
    return String(issue.violatedRule || issue.violated_rule || "issue") + "__" + index;
  }

  function ensureChoice(stageId, issue, index) {
    var key = issueKey(issue, index);
    var stage = workflowState.batch3a2Choices[stageId] || (workflowState.batch3a2Choices[stageId] = {});
    if (!stage[key]) stage[key] = { decision: "accept", customText: "" };
    return stage[key];
  }

  function recommendationItems(stageId, issues) {
    if (stageId === "structuring") {
      return [
        "日常单品价作为主价格口径，活动价与套餐价分开记录。",
        "基础商品容量与赠品套餐字段分离。",
        "模糊价格描述改为结构化字段，无法确认的值标记缺失。"
      ];
    }
    return issues.map(function (issue) {
      return issue.fixPrompt || issue.fix_prompt || "保留风险并降低相关结论强度。";
    }).slice(0, 3);
  }

  function detailChoiceCard(stageId, issue, index) {
    var state = ensureChoice(stageId, issue, index);
    var blocker = (issue.issueLevel || issue.issue_level) === "blocker";
    var rule = issue.violatedRule || issue.violated_rule || "规则异常";
    var desc = issue.issueDesc || issue.issue_desc || "";
    var fix = issue.fixPrompt || issue.fix_prompt || "保留风险并降低相关结论强度。";
    var key = issueKey(issue, index);
    var custom = state.decision === "custom"
      ? '<textarea class="qa-choice-custom" data-b3a2-custom-stage="' + stageId + '" data-b3a2-custom-key="' + escapeHtml(key) + '" placeholder="输入自定义处理方案。">' + escapeHtml(state.customText || "") + '</textarea>'
      : "";
    return '<div class="qa-choice-card ' + (blocker ? "blocker" : "warning") + '">' +
      '<div class="qa-choice-head"><span class="qa-choice-title">' + escapeHtml(rule) + '</span><span class="qa-choice-level">' + (blocker ? "Blocker" : "Warning") + '</span></div>' +
      '<p class="qa-choice-problem"><b>问题：</b>' + escapeHtml(desc) + '</p>' +
      '<p class="qa-choice-fix"><b>AI 建议：</b>' + escapeHtml(fix) + '</p>' +
      '<div class="qa-choice-options">' +
        '<label class="qa-choice-option"><input type="radio" name="b3a2_' + stageId + '_' + index + '" value="accept" data-b3a2-choice-stage="' + stageId + '" data-b3a2-choice-key="' + escapeHtml(key) + '"' + (state.decision === "accept" ? " checked" : "") + '>采纳 AI 建议</label>' +
        '<label class="qa-choice-option"><input type="radio" name="b3a2_' + stageId + '_' + index + '" value="ignore" data-b3a2-choice-stage="' + stageId + '" data-b3a2-choice-key="' + escapeHtml(key) + '"' + (state.decision === "ignore" ? " checked" : "") + '>' + (blocker ? "暂不处理，保留阻断" : "保留风险") + '</label>' +
        '<label class="qa-choice-option"><input type="radio" name="b3a2_' + stageId + '_' + index + '" value="custom" data-b3a2-choice-stage="' + stageId + '" data-b3a2-choice-key="' + escapeHtml(key) + '"' + (state.decision === "custom" ? " checked" : "") + '>自定义方案</label>' +
      '</div>' + custom + '</div>';
  }

  function structuringDetail() {
    return '<div class="qa-detail-panel"><p class="qa-detail-note">默认已选中 AI 推荐方案。只有需要覆盖默认处理时才调整。</p>' +
      structuringResolutionRules.map(function (rule) {
        var state = structuringResolutionState[rule.key];
        if (!state.decision) state.decision = "accept_ai";
        var blocker = rule.level === "Blocker";
        var custom = state.decision === "custom"
          ? '<textarea class="qa-choice-custom" data-b3a2-struct-custom="' + rule.key + '" placeholder="输入自定义处理方案。">' + escapeHtml(state.customText || "") + '</textarea>'
          : "";
        return '<div class="qa-choice-card ' + (blocker ? "blocker" : "warning") + '">' +
          '<div class="qa-choice-head"><span class="qa-choice-title">' + escapeHtml(rule.ruleName) + '</span><span class="qa-choice-level">' + rule.level + '</span></div>' +
          '<p class="qa-choice-problem"><b>问题：</b>' + escapeHtml(rule.issueDesc) + '</p>' +
          '<p class="qa-choice-fix"><b>AI 建议：</b>' + escapeHtml(rule.aiSuggestion) + '</p>' +
          '<div class="qa-choice-options">' +
            '<label class="qa-choice-option"><input type="radio" name="b3a2_struct_' + rule.key + '" value="accept_ai" data-b3a2-struct-choice="' + rule.key + '"' + (state.decision === "accept_ai" ? " checked" : "") + '>采纳 AI 建议</label>' +
            '<label class="qa-choice-option"><input type="radio" name="b3a2_struct_' + rule.key + '" value="ignore" data-b3a2-struct-choice="' + rule.key + '"' + (state.decision === "ignore" ? " checked" : "") + '>' + (blocker ? "暂不处理，保留阻断" : "保留风险") + '</label>' +
            '<label class="qa-choice-option"><input type="radio" name="b3a2_struct_' + rule.key + '" value="custom" data-b3a2-struct-choice="' + rule.key + '"' + (state.decision === "custom" ? " checked" : "") + '>自定义方案</label>' +
          '</div>' + custom + '</div>';
      }).join("") +
      '<div class="qa-compact-actions"><button class="btn primary" type="button" data-b3a2-apply-adjusted="structuring">应用调整并模拟重跑</button></div></div>';
  }

  function issueDetail(stageId, issues) {
    return '<div class="qa-detail-panel"><p class="qa-detail-note">未调整的项目默认采用 AI 推荐方案，无需逐项点击。</p>' +
      issues.map(function (issue, index) { return detailChoiceCard(stageId, issue, index); }).join("") +
      '<div class="qa-compact-actions"><button class="btn primary" type="button" data-b3a2-apply-adjusted="' + stageId + '">应用调整并模拟重跑</button></div></div>';
  }

  function compactCard(stageId, qa, issues) {
    var blockerCount = issues.filter(function (issue) { return (issue.issueLevel || issue.issue_level) === "blocker"; }).length;
    var isBlock = blockerCount > 0 || qa.qaStatus === "BLOCK";
    var title = stageId === "structuring"
      ? "苏泊尔 KD60D830 价格与套餐口径冲突"
      : isBlock
        ? "发现 " + blockerCount + " 项关键异常"
        : "发现 " + issues.length + " 项非阻断问题";
    var description = stageId === "structuring"
      ? "AI 已生成统一处理方案。应用后将拆分价格与套餐口径，并重新执行结构化质检。"
      : "AI 已根据当前问题生成推荐处理方案，可一键应用；需要精细控制时再展开调整。";
    var items = recommendationItems(stageId, issues);
    var expanded = Boolean(workflowState.batch3a2Expanded[stageId]);
    var optionalAction = isBlock
      ? '<button class="btn" type="button" data-b3a2-later="' + stageId + '">稍后处理</button>'
      : '<button class="btn" type="button" data-b3a2-risk-continue="' + stageId + '">带风险继续</button>';
    var detail = expanded ? (stageId === "structuring" ? structuringDetail() : issueDetail(stageId, issues)) : "";
    return '<div class="qa-compact-card ' + (isBlock ? "blocker" : "warning") + '">' +
      '<div class="qa-compact-head"><div><h3 class="qa-compact-title">' + escapeHtml(title) + '</h3><p class="qa-compact-description">' + escapeHtml(description) + '</p></div><span class="qa-compact-badge">' + (isBlock ? "需处理" : "非阻断") + '</span></div>' +
      '<div class="qa-recommendation-box"><b>AI 推荐处理</b><ul>' + items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ul></div>' +
      '<div class="qa-compact-actions"><button class="btn primary" type="button" data-b3a2-apply-recommended="' + stageId + '">应用 AI 推荐方案</button>' + optionalAction + '<button class="text-button" type="button" data-b3a2-toggle-detail="' + stageId + '">' + (expanded ? "收起调整" : "查看并调整") + '</button></div>' +
      detail + '</div>';
  }

  renderInlineQAPanel = function () {
    if (runtime.stage === "input") return "";
    var stageId = getCurrentStageId();
    var qa = effectiveQA(stageId);
    var issues = effectiveIssues(stageId, qa);
    var shouldCompact = (stageId === "collecting" || stageId === "comparing") && (qa.qaStatus === "WARNING" || qa.qaStatus === "BLOCK") && issues.length;
    var structuringRoot = stageId === "structuring" && qa.qaStatus === "BLOCK" && issues.some(function (issue) { return (issue.issueLevel || issue.issue_level) === "blocker"; });
    if (!shouldCompact && !structuringRoot) return previousRenderInlineQAPanel();

    var meta = statusMeta(qa.qaStatus);
    var passedCount = (qa.checkedRules || []).filter(function (rule) { return rule.status === "PASS"; }).length;
    var passed = passedCount ? '<button class="qa-passed-toggle" type="button" onclick="openQARulesDrawer(\'passed\')">' + icon("check") + '查看已通过的 ' + passedCount + ' 项规则</button>' : "";
    var summary = structuringRoot
      ? "存在 1 项根问题；应用推荐方案后即可重新质检。"
      : qa.qaStatus === "BLOCK"
        ? "存在关键异常，需处理后继续。"
        : "没有阻断问题；可一键采用推荐方案，也可直接带风险继续。";
    return '<section class="qa-unified ' + meta.cls + '"><div class="qa-unified-header"><span class="qa-unified-status">' + icon(meta.icon) + meta.label + '</span>' +
      '<div class="qa-unified-copy"><b>' + escapeHtml((qa.stageName || "阶段质检").replace(/质检$/, "") + "质检") + '</b><p>' + escapeHtml(summary) + '</p></div><span class="qa-unified-count">' + (structuringRoot ? '1 个根问题' : issues.length + ' 个问题') + '</span></div>' +
      '<div class="qa-unified-body">' + passed + compactCard(stageId, qa, issues) + '</div></section>';
  };

  function addComparisonEvidence(customText) {
    if (!sources.some(function (source) { return source.id === "S006"; })) {
      sources.push({
        id: "S006", sku: "跨 SKU 用户评价样本", name: "补充评价主题 Demo 样本", type: "用户评价主题", platform: "电商公开评价",
        url: "https://example.com/air-fryer-cleaning-review-themes", captured: new Date().toLocaleString("zh-CN", { hour12: false }),
        excerpt: customText || "新增 24 条评价样本，清洁麻烦、油污残留和炸篮拆洗是高频负向主题。",
        fields: ["用户评价", "清洁痛点", "机会点证据"], credibility: "中高", risk: "仍为 Demo 样本，正式项目需替换为真实评价数据。", claims: ["C005"]
      });
    }
    var chain = useData("evidenceChains", evidenceChains).find(function (item) { return item.id === "C005"; });
    if (chain && !chain.sourceIds.includes("S006")) chain.sourceIds.push("S006");
    if (chain) {
      chain.confidence = "中高";
      chain.logic = customText || "新增评价主题后，清洁困难在多 SKU 评价中重复出现，且与可拆洗结构和小家庭高频使用场景直接相关。";
    }
    workflowState.reviewEvidenceFixed = true;
  }

  function applyComparingAdjusted(issues) {
    var retained = 0;
    issues.forEach(function (issue, index) {
      var state = ensureChoice("comparing", issue, index);
      var rule = issue.violatedRule || issue.violated_rule || "";
      if (state.decision === "ignore") retained += 1;
      if (state.decision !== "ignore" && rule.indexOf("证据支撑") >= 0) addComparisonEvidence(state.decision === "custom" ? state.customText.trim() : "");
      if (state.decision !== "ignore" && rule.indexOf("参照竞品权重") >= 0) workflowState.referenceWeightFixed = true;
    });
    stageQAResults.comparing.checkedRules = (stageQAResults.comparing.checkedRules || []).map(function (rule) {
      var matchIndex = issues.findIndex(function (issue) { return (issue.violatedRule || issue.violated_rule) === rule.ruleName; });
      if (matchIndex < 0) return rule;
      var state = ensureChoice("comparing", issues[matchIndex], matchIndex);
      return state.decision === "ignore"
        ? { ruleName: rule.ruleName, status: "FAIL", reason: "用户选择保留风险，相关结论已降低强度并进入风险披露。" }
        : { ruleName: rule.ruleName, status: "PASS", reason: state.decision === "custom" ? "已按用户自定义方案更新并重新校验。" : "已采纳 AI 推荐方案更新并重新校验。" };
    });
    stageQAResults.comparing.issues = [];
    stageQAResults.comparing.qaStatus = retained ? "WARNING" : "PASS";
    stageQAResults.comparing.score = retained ? 82 : 88;
    stageQAResults.comparing.qaSummary = retained ? "对比分析已更新，保留风险已进入报告边界说明。" : "对比分析已按推荐方案完成局部重跑，全部规则通过。";
    runtime.running = false;
    runtime.stage = "compare";
    runtime.viewStage = "compare";
    runtime.activeAgent = "comparing";
    runtime.viewAgent = "comparing";
    runtime.statusText = "对比分析已更新，等待用户确认";
    runtime.qualityText = retained ? "对比分析 QA 带风险通过" : "对比分析 QA 已通过";
    var version = typeof nextVersion === "function" ? nextVersion("对比分析 QA 快速处理", ["评价证据", "参照竞品权重", "机会点结论"]) : null;
    workflowState.qaRerunResult = workflowState.qaRerunResult || {};
    workflowState.qaRerunResult.comparing = "已完成 Demo 局部重跑，评价证据与参照竞品权重已同步" + (version ? "，生成 " + version.versionId : "") + "。";
    showToast("对比分析已完成模拟重跑，页面与 QA 状态已更新。");
    renderAll();
  }

  function applyCollectingAdjusted(issues) {
    var retained = issues.some(function (issue, index) { return ensureChoice("collecting", issue, index).decision === "ignore"; });
    var custom = "";
    issues.forEach(function (issue, index) {
      var state = ensureChoice("collecting", issue, index);
      if (state.decision === "custom" && state.customText.trim()) custom = state.customText.trim();
    });
    if (!retained && typeof batch2ApplyCollectingGapFix === "function") {
      batch2ApplyCollectingGapFix(custom);
      workflowState.qaRerunResult = workflowState.qaRerunResult || {};
      workflowState.qaRerunResult.collecting = "已完成 Demo 补充采集并重新验收。";
      return;
    }
    workflowState.collectingGapWaived = true;
    stageQAResults.collecting.qaStatus = "WARNING";
    stageQAResults.collecting.qaSummary = "采集结果带风险通过；信息缺口已进入后续置信度和报告边界说明。";
    stageQAResults.collecting.issues = [];
    runtime.running = false;
    runtime.qualityText = "带风险通过";
    workflowState.qaRerunResult = workflowState.qaRerunResult || {};
    workflowState.qaRerunResult.collecting = "已保留当前信息缺口，相关结论将降低强度。";
    showToast("已保留风险，采集结果可继续流转。");
    renderAll();
  }

  function validateAdjusted(stageId, issues) {
    for (var i = 0; i < issues.length; i += 1) {
      var state = ensureChoice(stageId, issues[i], i);
      if (state.decision === "custom" && !String(state.customText || "").trim()) {
        showToast("请填写自定义处理方案。");
        return false;
      }
      if ((issues[i].issueLevel || issues[i].issue_level) === "blocker" && state.decision === "ignore") {
        showToast("关键异常选择了暂不处理，当前阶段仍保持阻断。");
        return false;
      }
    }
    return true;
  }

  function runStageUpdate(stageId, callback) {
    runtime.running = true;
    runtime.statusText = (stageId === "collecting" ? "信息采集" : stageId === "structuring" ? "结构化处理" : "对比分析") + "正在按方案模拟重跑";
    runtime.qualityText = "质检中";
    renderAll();
    window.setTimeout(callback, 520);
  }

  function applyRecommended(stageId) {
    if (stageId === "structuring") {
      if (typeof window.applyRecommendedStructuringFix === "function") {
        window.applyRecommendedStructuringFix();
        return;
      }
      structuringResolutionRules.forEach(function (rule) {
        structuringResolutionState[rule.key].decision = "accept_ai";
        structuringResolutionState[rule.key].customText = "";
      });
      applySkuConflictFix();
      return;
    }
    var qa = effectiveQA(stageId);
    var issues = effectiveIssues(stageId, qa);
    issues.forEach(function (issue, index) {
      var state = ensureChoice(stageId, issue, index);
      state.decision = "accept";
      state.customText = "";
    });
    runStageUpdate(stageId, function () {
      if (stageId === "collecting") applyCollectingAdjusted(issues);
      if (stageId === "comparing") applyComparingAdjusted(issues);
    });
  }

  function applyAdjusted(stageId) {
    if (stageId === "structuring") {
      var invalid = structuringResolutionRules.find(function (rule) {
        var state = structuringResolutionState[rule.key];
        return (state.decision === "custom" && !String(state.customText || "").trim()) || (rule.level === "Blocker" && state.decision === "ignore");
      });
      if (invalid) {
        showToast(invalid.level === "Blocker" && structuringResolutionState[invalid.key].decision === "ignore" ? "价格口径仍未处理，结构化阶段保持阻断。" : "请填写自定义处理方案。");
        return;
      }
      applySkuConflictFix();
      return;
    }
    var qa = effectiveQA(stageId);
    var issues = effectiveIssues(stageId, qa);
    if (!validateAdjusted(stageId, issues)) return;
    runStageUpdate(stageId, function () {
      if (stageId === "collecting") applyCollectingAdjusted(issues);
      if (stageId === "comparing") applyComparingAdjusted(issues);
    });
  }

  function continueWithRisk(stageId) {
    var qa = effectiveQA(stageId);
    var issues = effectiveIssues(stageId, qa);
    issues.forEach(function (issue, index) { ensureChoice(stageId, issue, index).decision = "ignore"; });
    if (stageId === "collecting") applyCollectingAdjusted(issues);
    if (stageId === "comparing") applyComparingAdjusted(issues);
  }

  function findStructuredField(id) {
    var rows = window.batch3aStructuredFields || [];
    for (var i = 0; i < rows.length; i += 1) {
      var keys = Object.keys(rows[i].values || {});
      for (var j = 0; j < keys.length; j += 1) {
        var field = rows[i].values[keys[j]];
        if (field && field.id === id) return Object.assign(field, { skuName: rows[i].skuName });
      }
    }
    return null;
  }

  function ensurePopover() {
    var popover = document.getElementById("batch3a2FieldPopover");
    if (!popover) {
      popover = document.createElement("div");
      popover.id = "batch3a2FieldPopover";
      popover.className = "batch3a2-field-popover";
      popover.hidden = true;
      document.body.appendChild(popover);
    }
    return popover;
  }

  function closePopover() {
    var popover = ensurePopover();
    popover.hidden = true;
    popover.innerHTML = "";
    quickFieldId = null;
    quickCustomOpen = false;
    quickAnchor = null;
  }

  function positionPopover(popover, anchor) {
    var rect = anchor.getBoundingClientRect();
    var margin = 10;
    var width = Math.min(340, window.innerWidth - 24);
    var left = rect.right + margin;
    if (left + width > window.innerWidth - 12) left = Math.max(12, rect.left - width - margin);
    var top = rect.top;
    popover.style.left = left + "px";
    popover.style.top = Math.max(12, Math.min(top, window.innerHeight - 360)) + "px";
  }

  function renderPopover() {
    var popover = ensurePopover();
    var field = findStructuredField(quickFieldId);
    if (!field || !quickAnchor || !document.body.contains(quickAnchor)) { closePopover(); return; }
    popover.hidden = false;
    popover.innerHTML = '<div class="batch3a2-popover-head"><h3 class="batch3a2-popover-title">' + escapeHtml(field.skuName + "｜" + field.label) + '</h3><button class="batch3a2-popover-close" type="button" data-b3a2-popover-close aria-label="关闭">×</button></div>' +
      '<p class="batch3a2-popover-value">当前：' + escapeHtml(field.value) + '</p>' +
      '<p class="batch3a2-popover-recommendation"><b>AI 建议：</b>' + escapeHtml(field.recommendation || "保留当前结果并标记不确定性。") + '</p>' +
      '<div class="batch3a2-popover-actions"><button class="btn primary" type="button" data-b3a2-field-action="accept">采纳建议</button><button class="btn" type="button" data-b3a2-field-action="keep">保留当前</button><button class="btn" type="button" data-b3a2-field-action="custom">自定义</button></div>' +
      (quickCustomOpen ? '<div class="batch3a2-popover-custom"><textarea id="batch3a2QuickCustom" placeholder="输入新的字段值或处理方式。"></textarea><button class="btn primary" type="button" data-b3a2-field-action="apply-custom">应用自定义修改</button></div>' : "") +
      '<button class="batch3a2-popover-detail" type="button" data-b3a2-field-action="details">查看详细依据与来源</button>';
    positionPopover(popover, quickAnchor);
  }

  function recordQuickField(field, decision, customValue) {
    var previous = field.value;
    if (decision === "accept") field.value = field.recommendedValue || field.value;
    if (decision === "custom") field.value = customValue;
    field.updated = true;
    field.statusLabel = decision === "keep" ? "已保留" : "已更新";
    field.userDecision = decision;
    if (field.id === "P003.price" && decision !== "keep") {
      structuringResolutionState.priceConsistency.decision = decision === "custom" ? "custom" : "accept_ai";
      structuringResolutionState.priceConsistency.customText = decision === "custom" ? customValue : "";
      structuringResolutionState.normalizationQuality.decision = decision === "custom" ? "custom" : "accept_ai";
      structuringResolutionState.normalizationQuality.customText = decision === "custom" ? customValue : "";
    }
    if (field.id === "P003.capacity" && decision !== "keep") {
      structuringResolutionState.conflictHandling.decision = decision === "custom" ? "custom" : "accept_ai";
      structuringResolutionState.conflictHandling.customText = decision === "custom" ? customValue : "";
    }
    var reason = decision === "accept" ? "采纳 AI 字段建议" : decision === "custom" ? "采用用户自定义字段方案" : "保留当前字段结果";
    var version = typeof nextVersion === "function" ? nextVersion(reason + "：" + field.skuName + "｜" + field.label, ["关键结构化字段"]) : null;
    if (typeof addMessage === "function") addMessage((version ? version.versionId + "｜" : "") + field.skuName + "的“" + field.label + "”已更新：" + previous + " → " + field.value + "。");
    showToast(decision === "keep" ? "已保留当前字段结果。" : "字段已更新；阶段 QA 将在统一重跑时重新校验。");
    closePopover();
    renderAll();
  }

  document.addEventListener("click", function (event) {
    var fieldButton = event.target.closest("[data-structured-field]");
    if (!fieldButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    quickFieldId = fieldButton.dataset.structuredField;
    quickAnchor = fieldButton;
    quickCustomOpen = false;
    renderPopover();
  }, true);

  document.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-b3a2-toggle-detail]");
    if (toggle) {
      var stageId = toggle.dataset.b3a2ToggleDetail;
      workflowState.batch3a2Expanded[stageId] = !workflowState.batch3a2Expanded[stageId];
      renderAll();
      return;
    }
    var recommended = event.target.closest("[data-b3a2-apply-recommended]");
    if (recommended) { applyRecommended(recommended.dataset.b3a2ApplyRecommended); return; }
    var adjusted = event.target.closest("[data-b3a2-apply-adjusted]");
    if (adjusted) { applyAdjusted(adjusted.dataset.b3a2ApplyAdjusted); return; }
    var risk = event.target.closest("[data-b3a2-risk-continue]");
    if (risk) { continueWithRisk(risk.dataset.b3a2RiskContinue); return; }
    var later = event.target.closest("[data-b3a2-later]");
    if (later) { showToast("已保留当前问题，稍后仍可处理。"); return; }

    var action = event.target.closest("[data-b3a2-field-action]");
    if (action) {
      event.stopPropagation();
      var field = findStructuredField(quickFieldId);
      if (!field) return;
      var type = action.dataset.b3a2FieldAction;
      if (type === "accept" || type === "keep") { recordQuickField(field, type, ""); return; }
      if (type === "custom") { quickCustomOpen = true; renderPopover(); return; }
      if (type === "apply-custom") {
        var input = document.getElementById("batch3a2QuickCustom");
        var value = input ? input.value.trim() : "";
        if (!value) { showToast("请输入自定义修改内容。"); return; }
        recordQuickField(field, "custom", value);
        return;
      }
      if (type === "details") {
        runtime.selectedStructuredField = field.id;
        runtime.contextCollapsed.execution = false;
        closePopover();
        renderAll();
        return;
      }
    }
    if (event.target.closest("[data-b3a2-popover-close]")) { closePopover(); return; }
    var popover = document.getElementById("batch3a2FieldPopover");
    if (popover && !popover.hidden && !event.target.closest("#batch3a2FieldPopover")) closePopover();
  });

  // This card is rendered by several progressively loaded UI layers. Handle
  // the primary action during capture so an earlier delegated handler cannot
  // replace the card before its own recommendation action runs.
  document.addEventListener("click", function (event) {
    var recommended = event.target.closest("[data-b3a2-apply-recommended]");
    if (!recommended) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applyRecommended(recommended.dataset.b3a2ApplyRecommended);
  }, true);

  document.addEventListener("change", function (event) {
    var choice = event.target.closest("[data-b3a2-choice-stage]");
    if (choice) {
      var stage = workflowState.batch3a2Choices[choice.dataset.b3a2ChoiceStage] || (workflowState.batch3a2Choices[choice.dataset.b3a2ChoiceStage] = {});
      stage[choice.dataset.b3a2ChoiceKey] = stage[choice.dataset.b3a2ChoiceKey] || { decision: "accept", customText: "" };
      stage[choice.dataset.b3a2ChoiceKey].decision = choice.value;
      renderAll();
      return;
    }
    var structChoice = event.target.closest("[data-b3a2-struct-choice]");
    if (structChoice) {
      structuringResolutionState[structChoice.dataset.b3a2StructChoice].decision = structChoice.value;
      renderAll();
    }
  });

  document.addEventListener("input", function (event) {
    var custom = event.target.closest("[data-b3a2-custom-stage]");
    if (custom) {
      var stage = workflowState.batch3a2Choices[custom.dataset.b3a2CustomStage] || (workflowState.batch3a2Choices[custom.dataset.b3a2CustomStage] = {});
      stage[custom.dataset.b3a2CustomKey] = stage[custom.dataset.b3a2CustomKey] || { decision: "custom", customText: "" };
      stage[custom.dataset.b3a2CustomKey].customText = custom.value;
      return;
    }
    var structCustom = event.target.closest("[data-b3a2-struct-custom]");
    if (structCustom) structuringResolutionState[structCustom.dataset.b3a2StructCustom].customText = structCustom.value;
  });

  // Keep the structure-stage drawer explanation-only and remove the old generic edit form.
  var batch3a2PreviousRenderContextPanel = renderContextPanel;
  renderContextPanel = function () {
    batch3a2PreviousRenderContextPanel();
    if (getDisplayStage() !== "execution") return;
    var host = document.getElementById("contextPanel");
    if (!host) return;
    var fieldPanel = host.querySelector(":scope > .batch3a-context-panel");
    var heading = host.querySelector(":scope > .context-heading");
    if (heading) {
      var title = heading.querySelector("h2");
      if (title) title.textContent = "字段依据与来源";
    }
    Array.from(host.children).forEach(function (child) {
      if (child !== fieldPanel && child !== heading) child.remove();
    });
  };

  window.addEventListener("resize", function () { if (quickFieldId) renderPopover(); });
  window.addEventListener("scroll", function () { if (quickFieldId) closePopover(); }, true);

  renderAll();
}());
