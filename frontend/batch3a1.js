/* Batch 3A.1 — structure layout hotfix, unified QA choices and real Demo reruns. */
(function () {
  "use strict";

  var previousRenderInlineQAPanel = renderInlineQAPanel;
  var qaChoiceState = { collecting: {}, comparing: {} };
  workflowState.qaRerunResult = workflowState.qaRerunResult || {};
  workflowState.referenceWeightFixed = Boolean(workflowState.referenceWeightFixed);

  function qaIcon(name) {
    return typeof window.batch3Icon === "function" ? window.batch3Icon(name) : "";
  }

  function qaMeta(status) {
    var map = {
      PENDING: { cls: "pending", label: "待质检", icon: "clock" },
      CHECKING: { cls: "checking", label: "质检中", icon: "clock" },
      PASS: { cls: "pass", label: "已通过", icon: "check" },
      WARNING: { cls: "warning", label: "带风险通过", icon: "alert" },
      BLOCK: { cls: "block", label: "已阻断", icon: "block" }
    };
    return map[status] || map.PENDING;
  }

  function stageIssues(stageId, qa) {
    var issues = (qa.issues || []).slice();
    if (stageId === "collecting" && qa.qaStatus === "BLOCK") {
      issues.push({
        violatedRule: "价格时效性",
        issueLevel: "warning",
        issueDesc: "平台价格会随活动变化，当前价格快照只能作为阶段性线索。",
        rollbackTarget: "collecting",
        fixPrompt: "保留采集时间和价格类型，在报告中避免将活动价写成长期定价结论。"
      });
      issues.push({
        violatedRule: "评价样本代表性",
        issueLevel: "warning",
        issueDesc: "公开评价可能包含极端体验，不能直接代表全量用户满意度。",
        rollbackTarget: "collecting",
        fixPrompt: "将评价结果表述为趋势性信号，并在后续验证中补充访谈或售后数据。"
      });
    }
    return issues;
  }

  function issueKey(issue, index) {
    return String(issue.violatedRule || issue.violated_rule || "issue") + "__" + index;
  }

  function ensureChoice(stageId, key) {
    qaChoiceState[stageId] = qaChoiceState[stageId] || {};
    qaChoiceState[stageId][key] = qaChoiceState[stageId][key] || { decision: "", customText: "" };
    return qaChoiceState[stageId][key];
  }

  function renderChoiceCard(stageId, issue, index) {
    var blocker = (issue.issueLevel || issue.issue_level) === "blocker";
    var rule = issue.violatedRule || issue.violated_rule || "规则异常";
    var desc = issue.issueDesc || issue.issue_desc || "";
    var fix = issue.fixPrompt || issue.fix_prompt || "";
    var key = issueKey(issue, index);
    var state = ensureChoice(stageId, key);
    var name = "qa_choice_" + stageId + "_" + index;
    var custom = state.decision === "custom"
      ? '<textarea class="qa-choice-custom" data-qa-choice-custom="' + escapeHtml(stageId) + '" data-qa-choice-key="' + escapeHtml(key) + '" placeholder="输入你希望采用的处理方式。">' + escapeHtml(state.customText || "") + '</textarea>'
      : "";
    return '<div class="qa-choice-card ' + (blocker ? "blocker" : "warning") + '">' +
      '<div class="qa-choice-head"><span class="qa-choice-title">' + escapeHtml(rule) + '</span><span class="qa-choice-level">' + (blocker ? "Blocker" : "Warning") + '</span></div>' +
      '<p class="qa-choice-problem"><b>问题：</b>' + escapeHtml(desc) + '</p>' +
      '<p class="qa-choice-fix"><b>AI 建议：</b>' + escapeHtml(fix || "保留为风险并降低相关结论强度。") + '</p>' +
      '<div class="qa-choice-options">' +
        '<label class="qa-choice-option"><input type="radio" name="' + name + '" value="accept" data-qa-choice-stage="' + stageId + '" data-qa-choice-key="' + escapeHtml(key) + '"' + (state.decision === "accept" ? " checked" : "") + '>采纳 AI 建议</label>' +
        '<label class="qa-choice-option"><input type="radio" name="' + name + '" value="ignore" data-qa-choice-stage="' + stageId + '" data-qa-choice-key="' + escapeHtml(key) + '"' + (state.decision === "ignore" ? " checked" : "") + '>' + (blocker ? "暂不处理，保留阻断" : "忽略并保留风险") + '</label>' +
        '<label class="qa-choice-option"><input type="radio" name="' + name + '" value="custom" data-qa-choice-stage="' + stageId + '" data-qa-choice-key="' + escapeHtml(key) + '"' + (state.decision === "custom" ? " checked" : "") + '>使用自定义方案</label>' +
      '</div>' + custom + '</div>';
  }

  function qaSummary(stageId, qa, issues) {
    var blockers = issues.filter(function (issue) { return (issue.issueLevel || issue.issue_level) === "blocker"; }).length;
    var warnings = issues.length - blockers;
    if (qa.qaStatus === "PENDING" || qa.qaStatus === "CHECKING") return qa.qaSummary || "";
    if (qa.qaStatus === "PASS") return "本阶段规则已完成校验，未发现需要处理的问题。";
    if (qa.qaStatus === "WARNING") return "本阶段没有阻断问题，存在 " + Math.max(warnings, workflowState.qaRerunResult[stageId] ? 1 : 0) + " 项非阻断风险，可继续进入下一阶段。";
    return "发现 " + blockers + " 项关键异常和 " + warnings + " 项非阻断警告，需先处理关键异常。";
  }

  function passedButton(qa) {
    var count = (qa.checkedRules || []).filter(function (rule) { return rule.status === "PASS"; }).length;
    return count ? '<button class="qa-passed-toggle" type="button" onclick="openQARulesDrawer(\'passed\')">' + qaIcon("check") + '查看已通过的 ' + count + ' 项规则</button>' : "";
  }

  renderInlineQAPanel = function () {
    var stageId = getCurrentStageId();
    if (stageId === "structuring" || stageId === "planning" || stageId === "writing") {
      return previousRenderInlineQAPanel();
    }
    if (runtime.stage === "input") return "";
    var qa = typeof window.batch3EffectiveQA === "function" ? window.batch3EffectiveQA(stageId) : stageQAResults[stageId];
    var meta = qaMeta(qa.qaStatus);
    var issues = stageIssues(stageId, qa);
    var body = passedButton(qa);

    if ((qa.qaStatus === "BLOCK" || qa.qaStatus === "WARNING") && issues.length) {
      body += '<div class="qa-problem-group"><div class="qa-problem-title">需处理的问题（' + issues.length + '）</div><div class="qa-choice-list">' +
        issues.map(function (issue, index) { return renderChoiceCard(stageId, issue, index); }).join("") +
        '</div><div class="qa-choice-actions"><button class="btn primary" type="button" data-qa-choice-apply="' + stageId + '">应用所选方案并模拟重跑</button><button class="btn" type="button" data-qa-choice-later="' + stageId + '">稍后处理</button></div></div>';
    } else if (workflowState.qaRerunResult[stageId]) {
      body += '<div class="qa-rerun-result">' + escapeHtml(workflowState.qaRerunResult[stageId]) + '</div>';
    } else if (qa.qaStatus === "PASS") {
      body += '<div style="color:var(--green);font-size:13px;font-weight:650">本阶段已通过，可继续进入下一阶段。</div>';
    }

    return '<section class="qa-unified ' + meta.cls + '">' +
      '<div class="qa-unified-header"><span class="qa-unified-status">' + qaIcon(meta.icon) + meta.label + '</span>' +
      '<div class="qa-unified-copy"><b>' + escapeHtml((qa.stageName || "阶段质检").replace(/质检$/, "") + "质检") + '</b><p>' + escapeHtml(qaSummary(stageId, qa, issues)) + '</p></div>' +
      '<span class="qa-unified-count">' + (issues.length ? issues.length + " 个问题" : "") + '</span></div>' +
      '<div class="qa-unified-body">' + body + '</div></section>';
  };

  function allChoicesComplete(stageId, issues) {
    for (var i = 0; i < issues.length; i += 1) {
      var key = issueKey(issues[i], i);
      var state = ensureChoice(stageId, key);
      if (!state.decision) {
        showToast("请先为每个问题选择处理方式。");
        return false;
      }
      if (state.decision === "custom" && !String(state.customText || "").trim()) {
        showToast("请填写自定义处理方案。");
        return false;
      }
    }
    return true;
  }

  function addComparisonEvidence(customText) {
    if (!sources.some(function (source) { return source.id === "S006"; })) {
      sources.push({
        id: "S006",
        sku: "跨 SKU 用户评价样本",
        name: "补充评价主题 Demo 样本",
        type: "用户评价主题",
        platform: "电商公开评价",
        url: "https://example.com/air-fryer-cleaning-review-themes",
        captured: new Date().toLocaleString("zh-CN", { hour12: false }),
        excerpt: customText || "新增 24 条评价样本，清洁麻烦、油污残留和炸篮拆洗是高频负向主题。",
        fields: ["用户评价", "清洁痛点", "机会点证据"],
        credibility: "中高",
        risk: "仍为 Demo 样本，正式项目需替换为真实评价数据。",
        claims: ["C005"]
      });
    }
    var chain = useData("evidenceChains", evidenceChains).find(function (item) { return item.id === "C005"; });
    if (chain && !chain.sourceIds.includes("S006")) chain.sourceIds.push("S006");
    if (chain) {
      chain.confidence = "中高";
      chain.logic = customText || "新增评价主题后，清洁困难在多 SKU 评价中重复出现，且与可拆洗结构和小家庭高频使用场景直接相关。";
      chain.uncertainty = "仍需真实售后数据和样机试用确认清洁结构是否能降低负评。";
    }
    workflowState.reviewEvidenceFixed = true;
  }

  function refreshComparingQA(processed) {
    var result = stageQAResults.comparing;
    var ignored = processed.filter(function (item) { return item.decision === "ignore"; });
    result.checkedRules = (result.checkedRules || []).map(function (rule) {
      var item = processed.find(function (entry) { return entry.rule === rule.ruleName; });
      if (!item) return rule;
      if (item.decision === "ignore") return { ruleName: rule.ruleName, status: "FAIL", reason: "用户选择保留该风险，相关结论已降低强度并进入风险披露。" };
      return { ruleName: rule.ruleName, status: "PASS", reason: item.decision === "custom" ? "已按用户自定义方案完成局部更新并重新校验。" : "已采纳 AI 建议完成局部更新并重新校验。" };
    });
    result.issues = [];
    result.qaStatus = ignored.length ? "WARNING" : "PASS";
    result.score = ignored.length ? 82 : 88;
    result.qaSummary = ignored.length
      ? "对比分析已按所选方案更新；仍有 " + ignored.length + " 项风险被保留并进入报告边界说明。"
      : "对比分析已按所选方案完成局部重跑，全部规则重新校验通过。";
  }

  function applyComparingChoices(issues) {
    var processed = [];
    issues.forEach(function (issue, index) {
      var key = issueKey(issue, index);
      var state = ensureChoice("comparing", key);
      var rule = issue.violatedRule || issue.violated_rule || "规则异常";
      if (state.decision !== "ignore" && rule.indexOf("证据支撑") >= 0) addComparisonEvidence(state.decision === "custom" ? state.customText.trim() : "");
      if (state.decision !== "ignore" && rule.indexOf("参照竞品权重") >= 0) workflowState.referenceWeightFixed = true;
      processed.push({ rule: rule, decision: state.decision, customText: state.customText || "" });
    });

    refreshComparingQA(processed);
    runtime.running = false;
    runtime.stage = "compare";
    runtime.viewStage = "compare";
    runtime.activeAgent = "comparing";
    runtime.viewAgent = "comparing";
    runtime.progress = stageConfig.compare.progress;
    runtime.statusText = "对比分析已按所选方案更新，等待用户确认";
    runtime.qualityText = stageQAResults.comparing.qaStatus === "PASS" ? "对比分析 QA 已通过" : "对比分析 QA 带风险通过";
    workflowState.rerunSummary = {
      reason: "对比分析 QA 问题处理",
      changedSections: ["评价证据", "参照竞品权重", "机会点结论", "对比分析 QA"],
      unchanged: ["任务规划", "SKU 基础规格", "价格与促销字段"]
    };
    var version = typeof nextVersion === "function" ? nextVersion("对比分析 QA 局部重跑", ["评价证据", "参照竞品权重", "机会点结论"]) : null;
    if (typeof recordAgentRun === "function") recordAgentRun("comparing", "completed", "用户所选 QA 处理方案", "已更新证据强度与参照竞品权重", "局部重跑", ["对比分析", "阶段 QA"]);
    workflowState.qaRerunResult.comparing = "已完成 Demo 局部重跑：评价证据与参照竞品权重已按所选方案更新，QA 已重新校验" + (version ? "，生成 " + version.versionId : "") + "。";
    showToast("对比分析已完成模拟重跑，页面与 QA 状态已更新。");
    renderAll();
  }

  function applyCollectingChoices(issues) {
    var retained = false;
    var customText = "";
    var resolved = false;
    issues.forEach(function (issue, index) {
      var state = ensureChoice("collecting", issueKey(issue, index));
      if (state.decision === "ignore") retained = true;
      else {
        resolved = true;
        if (state.decision === "custom") customText = state.customText.trim();
      }
    });

    if (resolved && typeof batch2ApplyCollectingGapFix === "function") {
      batch2ApplyCollectingGapFix(customText);
      workflowState.qaRerunResult.collecting = "已完成 Demo 补充采集并重新验收；新增来源已写入信息来源列表。";
      renderAll();
      return;
    }
    if (retained) {
      workflowState.collectingGapWaived = true;
      stageQAResults.collecting.qaStatus = "WARNING";
      stageQAResults.collecting.qaSummary = "采集结果带风险通过；信息缺口已保留并进入后续置信度与报告边界说明。";
      stageQAResults.collecting.issues = [];
      runtime.qualityText = "带风险通过";
      workflowState.qaRerunResult.collecting = "已保留当前信息缺口，相关结论将降低强度并进入风险披露。";
      showToast("已保留风险，采集结果可继续流转。");
      renderAll();
    }
  }

  function applyQaChoices(stageId) {
    var qa = typeof window.batch3EffectiveQA === "function" ? window.batch3EffectiveQA(stageId) : stageQAResults[stageId];
    var issues = stageIssues(stageId, qa);
    if (!issues.length) return;
    if (!allChoicesComplete(stageId, issues)) return;
    var unresolvedBlocker = issues.some(function (issue, index) {
      return (issue.issueLevel || issue.issue_level) === "blocker" && ensureChoice(stageId, issueKey(issue, index)).decision === "ignore";
    });
    if (unresolvedBlocker) {
      showToast("关键异常选择了暂不处理，当前阶段仍保持阻断。");
      return;
    }
    runtime.running = true;
    runtime.statusText = (stageId === "collecting" ? "信息采集" : "对比分析") + "正在按所选方案模拟重跑";
    runtime.qualityText = "质检中";
    renderAll();
    window.setTimeout(function () {
      if (stageId === "collecting") applyCollectingChoices(issues);
      if (stageId === "comparing") applyComparingChoices(issues);
    }, 650);
  }

  /* Existing entry points now perform the same real Demo update and stay on comparing. */
  applyReviewEvidenceFix = function () {
    var qa = typeof window.batch3EffectiveQA === "function" ? window.batch3EffectiveQA("comparing") : stageQAResults.comparing;
    var issues = stageIssues("comparing", qa);
    issues.forEach(function (issue, index) {
      var state = ensureChoice("comparing", issueKey(issue, index));
      state.decision = "accept";
    });
    applyQaChoices("comparing");
  };

  function syncStructureLayout() {
    var workbench = document.querySelector("#home .workbench");
    if (!workbench) return;
    workbench.classList.toggle("batch3a1-structure-mode", getDisplayStage() === "execution");
  }

  function markReferenceRow() {
    if (!workflowState.referenceWeightFixed || getDisplayStage() !== "compare") return;
    var scales = Array.from(document.querySelectorAll("#mainTask .compare-scale"));
    var ranking = scales.find(function (node) {
      var h3 = node.querySelector("h3");
      return h3 && h3.textContent.indexOf("综合评分排名") >= 0;
    });
    if (!ranking) return;
    Array.from(ranking.querySelectorAll("tbody tr")).forEach(function (row) {
      if (row.textContent.indexOf("小熊") < 0) return;
      row.style.opacity = "0.72";
      var first = row.children[0];
      var total = row.children[7];
      var recommend = row.children[8];
      if (first) first.innerHTML = '<span class="status-tag waiting">参照</span>';
      if (total) total.innerHTML = '<span class="muted">不计核心分</span>';
      if (recommend) recommend.innerHTML = '<span class="status-tag waiting">价格下限参考</span>';
    });
  }

  var previousRenderAll = renderAll;
  renderAll = function () {
    previousRenderAll();
    syncStructureLayout();
    markReferenceRow();
  };

  document.addEventListener("change", function (event) {
    var radio = event.target.closest("[data-qa-choice-stage]");
    if (!radio) return;
    var stageId = radio.dataset.qaChoiceStage;
    var key = radio.dataset.qaChoiceKey;
    var state = ensureChoice(stageId, key);
    state.decision = radio.value;
    renderAll();
  });

  document.addEventListener("input", function (event) {
    var input = event.target.closest("[data-qa-choice-custom]");
    if (!input) return;
    var state = ensureChoice(input.dataset.qaChoiceCustom, input.dataset.qaChoiceKey);
    state.customText = input.value;
  });

  document.addEventListener("click", function (event) {
    var apply = event.target.closest("[data-qa-choice-apply]");
    if (apply) {
      event.preventDefault();
      applyQaChoices(apply.dataset.qaChoiceApply);
      return;
    }
    var later = event.target.closest("[data-qa-choice-later]");
    if (later) {
      event.preventDefault();
      showToast("已保留当前问题，稍后仍可继续处理。");
    }
  });

  renderAll();
}());
