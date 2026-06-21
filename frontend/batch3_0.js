/* Batch 3.0 — information hierarchy, QA semantics and report synthesis. */
(function () {
  "use strict";

  function icon(name, extraClass) {
    var cls = "ui-icon" + (extraClass ? " " + extraClass : "");
    var paths = {
      check: '<path d="M4 8.5 7 11.5 12.5 5.5"/>',
      alert: '<path d="M8 2.5 14 13H2L8 2.5Z"/><path d="M8 6.2v3.2"/><path d="M8 11.5h.01"/>',
      block: '<circle cx="8" cy="8" r="5.5"/><path d="m5.8 5.8 4.4 4.4M10.2 5.8 5.8 10.2"/>',
      clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 4.8V8l2.2 1.4"/>',
      info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.2v3.2"/><path d="M8 5.2h.01"/>',
      shield: '<path d="M8 2.2 13 4v3.5c0 3.2-2.1 5.3-5 6.4-2.9-1.1-5-3.2-5-6.4V4l5-1.8Z"/><path d="m5.8 8 1.5 1.5 3-3"/>',
      document: '<path d="M4 2.5h5l3 3V13.5H4Z"/><path d="M9 2.5v3h3M6 8h4M6 10.5h4"/>'
    };
    return '<svg class="' + cls + '" viewBox="0 0 16 16" aria-hidden="true">' + (paths[name] || paths.info) + '</svg>';
  }

  window.batch3Icon = icon;

  var stageRank = { input: 0, plan: 1, collecting: 2, execution: 3, compare: 4, report: 5 };
  var qaStageRank = { planning: 1, collecting: 2, structuring: 3, comparing: 4, writing: 5 };

  function planningConfirmed() {
    return Boolean(workflowState.planStep_taskConfirmed && workflowState.planStep_competitorsConfirmed && workflowState.planStep_dimensionsConfirmed);
  }

  function effectiveQA(stageId) {
    var base = stageQAResults[stageId] || { stageName: stageId, qaStatus: "PENDING", checkedRules: [], issues: [] };
    var result = {
      stage: base.stage,
      stageName: base.stageName,
      qaStatus: base.qaStatus,
      qaSummary: base.qaSummary,
      score: base.score,
      checkedAt: base.checkedAt,
      passedItems: (base.passedItems || []).slice(),
      checkedRules: (base.checkedRules || []).slice(),
      issues: (base.issues || []).slice()
    };
    var currentRank = stageRank[runtime.stage] || 0;

    if (stageId === "planning" && !planningConfirmed()) {
      result.qaStatus = "PENDING";
      result.qaSummary = "完成任务信息、竞品范围、分析维度与来源计划确认后，系统再执行规划质检。";
      result.checkedRules = [];
      result.issues = [];
      result.score = null;
      return result;
    }
    if (currentRank < qaStageRank[stageId]) {
      result.qaStatus = "PENDING";
      result.qaSummary = "本阶段尚未执行，暂无质检结果。";
      result.checkedRules = [];
      result.issues = [];
      result.score = null;
      return result;
    }
    if (stageId === "collecting" && evaluateCollectingState() === "EXECUTING") {
      result.qaStatus = "CHECKING";
      result.qaSummary = "采集仍在执行。全部 Skill 完成后，系统将检查字段覆盖、来源有效性与信息缺口。";
      result.checkedRules = [];
      result.issues = [];
      result.score = null;
      return result;
    }
    return result;
  }

  window.batch3EffectiveQA = effectiveQA;

  function stageStatusMeta(status) {
    var meta = {
      PENDING: { cls: "pending", label: "待质检", icon: "clock" },
      CHECKING: { cls: "checking", label: "质检中", icon: "clock" },
      PASS: { cls: "pass", label: "已通过", icon: "check" },
      WARNING: { cls: "warning", label: "带风险通过", icon: "alert" },
      BLOCK: { cls: "block", label: "已阻断", icon: "block" }
    };
    return meta[status] || meta.PENDING;
  }

  statusClass = function (status) {
    status = String(status || "");
    if (/阻断|回退|冲突|需处理/.test(status)) return "rework";
    if (/执行|生成|采集|运行/.test(status)) return "running";
    if (/完成|已确认|已生成|通过/.test(status)) return "done";
    if (/警告|风险/.test(status)) return "review";
    if (/待|等待|尚未/.test(status)) return "waiting";
    return "waiting";
  };

  var oldGetStageQA = getStageQA;
  getStageQA = function (agentId) {
    var stageMap = { planning: "planning", collecting: "collecting", structuring: "structuring", comparing: "comparing", writing: "writing" };
    var stageId = stageMap[agentId];
    if (!stageId) return oldGetStageQA(agentId);
    var qa = effectiveQA(stageId);
    var meta = stageStatusMeta(qa.qaStatus);
    return {
      stage: stageId,
      status: qa.qaStatus === "BLOCK" ? "blocked" : qa.qaStatus === "WARNING" ? "warning" : qa.qaStatus === "PASS" ? "pass" : qa.qaStatus === "CHECKING" ? "checking" : "pending",
      label: meta.label,
      issueIds: (qa.issues || []).map(function (issue) { return issue.issueId || issue.violatedRule || issue.violated_rule || ""; }).filter(Boolean),
      checkedAt: qa.checkedAt || ""
    };
  };

  function sourceRiskWarningsForBlockedCollection() {
    if (evaluateCollectingState() !== "BLOCKED_MANUAL_INTERVENTION") return [];
    return [
      {
        violatedRule: "价格时效性",
        issueLevel: "warning",
        issueDesc: "平台价格会随活动变化，当前价格快照只能作为阶段性线索。",
        rollbackTarget: "collecting",
        fixPrompt: "保留采集时间和价格类型，在报告中避免将活动价写成长期定价结论。"
      },
      {
        violatedRule: "评价样本代表性",
        issueLevel: "warning",
        issueDesc: "公开评价可能包含极端体验，不能直接代表全量用户满意度。",
        rollbackTarget: "collecting",
        fixPrompt: "将评价结果表述为趋势性信号，并在后续验证中补充访谈或售后数据。"
      }
    ];
  }

  function effectiveIssues(stageId, qa) {
    var issues = (qa.issues || []).slice();
    if (stageId === "collecting" && qa.qaStatus === "BLOCK") {
      issues = issues.concat(sourceRiskWarningsForBlockedCollection());
    }
    return issues;
  }

  function passedRulesButton(qa) {
    var passed = (qa.checkedRules || []).filter(function (rule) { return rule.status === "PASS"; });
    if (!passed.length) return "";
    return '<button class="qa-passed-toggle" type="button" onclick="openQARulesDrawer(\'passed\')">' +
      icon("check", "small") + '查看已通过的 ' + passed.length + ' 项规则</button>';
  }

  function issueCard(issue, idx) {
    var blocker = (issue.issueLevel || issue.issue_level) === "blocker";
    var rule = issue.violatedRule || issue.violated_rule || "规则异常";
    var desc = issue.issueDesc || issue.issue_desc || "";
    var fix = issue.fixPrompt || issue.fix_prompt || "";
    return '<div class="qa-issue-card ' + (blocker ? "blocker" : "warning") + '">' +
      '<div class="qa-issue-meta"><b style="color:' + (blocker ? 'var(--red)' : 'var(--amber)') + '">' + (blocker ? "关键异常" : "警告") + '</b>' +
      '<span class="qa-violated-rule' + (blocker ? '' : ' warning-rule') + '">' + escapeHtml(rule) + '</span></div>' +
      '<div style="font-size:13px;margin:8px 0;line-height:1.6">' + escapeHtml(desc) + '</div>' +
      (fix ? '<div class="qa-fix-prompt">' + escapeHtml(fix) + '</div>' : '') +
      '<div class="qa-three-actions">' +
      '<button class="btn-accept" type="button" onclick="onAdoptAI(' + idx + ')">采纳 AI 建议</button>' +
      (!blocker ? '<button class="btn-force-pass" type="button" onclick="onForcePass(' + idx + ')">保留风险并继续</button>' : '') +
      '<div class="qa-three-actions-input-wrap"><input type="text" id="v12_custom_' + idx + '" placeholder="输入自定义处理方案"><button class="btn-submit-feedback" type="button" onclick="onCustomFix(' + idx + ')">提交方案</button></div>' +
      '</div></div>';
  }

  function issueGroups(stageId, qa) {
    var issues = effectiveIssues(stageId, qa);
    var blockers = issues.filter(function (issue) { return (issue.issueLevel || issue.issue_level) === "blocker"; });
    var warnings = issues.filter(function (issue) { return (issue.issueLevel || issue.issue_level) !== "blocker"; });
    var html = "";
    if (blockers.length) {
      html += '<div class="qa-problem-group"><div class="qa-problem-title">关键异常</div>' + blockers.map(function (issue) {
        return issueCard(issue, issues.indexOf(issue));
      }).join("") + '</div>';
    }
    if (warnings.length) {
      html += '<div class="qa-problem-group"><div class="qa-problem-title">' + (qa.qaStatus === "BLOCK" ? "其他警告" : "非阻断警告") + '</div>' + warnings.map(function (issue) {
        return issueCard(issue, issues.indexOf(issue));
      }).join("") + '</div>';
    }
    return html;
  }

  function inheritedRisks() {
    if ((stageRank[runtime.stage] || 0) < stageRank.execution) return "";
    var collecting = effectiveQA("collecting");
    var inherited = (collecting.issues || []).filter(function (issue) { return issue.issueLevel === "warning"; });
    if (!inherited.length && !workflowState.collectingGapWaived) return "";
    var text = inherited.length
      ? inherited.map(function (issue) { return escapeHtml(issue.issueDesc); }).join("；")
      : "采集阶段存在已保留的信息缺口，已降低关联字段置信度。";
    return '<details class="qa-inherited-risk"><summary>继承的上游风险：' + Math.max(inherited.length, 1) + ' 项</summary><div><p>' + text + '</p><p style="margin-top:6px">这些风险来自信息采集阶段，已纳入字段置信度，不属于结构化处理新增异常。</p></div></details>';
  }

  function structuringRootBody(qa) {
    if (runtime.running) {
      return '<div class="qa-problem-group"><div class="qa-issue-card blocker"><b>正在按所选方案模拟重跑</b><p style="margin:8px 0 0;font-size:13px">结构化 Agent 正在更新价格与套餐口径，完成后将重新执行本阶段规则校验。</p></div></div>';
    }
    return '<div class="qa-problem-group"><div class="qa-problem-title">本阶段关键异常</div><div class="qa-issue-card blocker">' +
      '<div class="qa-issue-meta"><b style="color:var(--red)">阻断</b><span class="qa-violated-rule">QI-SKU-001</span></div>' +
      '<div style="font-size:14px;font-weight:800;margin:8px 0">苏泊尔 KD60D830 价格与套餐口径冲突</div>' +
      '<div style="font-size:13px;line-height:1.6">同一 SKU 同时存在标价、券后价和赠品套餐价，当前无法统一为可比较的日常到手价。</div>' +
      structuringResolutionRules.map(renderStructuringResolutionRule).join("") +
      '<div class="button-row" style="margin-top:14px"><button class="btn primary" type="button" data-workflow-action="applyStructuringResolution">应用所选方案并模拟重跑</button><button class="btn" type="button" data-workflow-action="deferStructuringResolution">稍后处理</button><button class="text-button" type="button" onclick="openQARulesDrawer(\'failed\')">查看规则</button></div>' +
      '</div></div>';
  }

  function qaSummary(stageId, qa) {
    var issues = effectiveIssues(stageId, qa);
    var blockers = issues.filter(function (issue) { return (issue.issueLevel || issue.issue_level) === "blocker"; }).length;
    var warnings = issues.length - blockers;
    if (qa.qaStatus === "PENDING") return qa.qaSummary;
    if (qa.qaStatus === "CHECKING") return qa.qaSummary;
    if (qa.qaStatus === "PASS") return "本阶段规则已完成校验，未发现需要处理的问题。";
    if (qa.qaStatus === "WARNING") return "本阶段没有阻断问题，存在 " + warnings + " 项非阻断风险，可继续进入下一阶段。";
    return "发现 " + blockers + " 项关键异常和 " + warnings + " 项非阻断警告，需先处理关键异常。";
  }

  renderInlineQAPanel = function () {
    if (runtime.stage === "input") return "";
    var stageId = getCurrentStageId();
    var qa = effectiveQA(stageId);
    var meta = stageStatusMeta(qa.qaStatus);
    var issues = effectiveIssues(stageId, qa);
    var countText = qa.qaStatus === "PENDING" || qa.qaStatus === "CHECKING" ? "" : issues.length + " 个问题";
    var body = "";

    if (stageId === "structuring") body += inheritedRisks();

    var isStructuringRoot = stageId === "structuring" && qa.qaStatus === "BLOCK" && (qa.issues || []).some(function (issue) { return issue.issueLevel === "blocker"; });
    if (isStructuringRoot) {
      body += structuringRootBody(qa);
    } else if (stageId === "structuring" && workflowState.skuConflictFixed && qa.qaStatus === "WARNING") {
      body += '<div class="qa-problem-group"><div class="qa-issue-card warning"><b>结构化结果可继续使用，但仍有风险被保留</b><p style="margin:8px 0 0;font-size:13px">未处理的 Warning 不会阻止进入对比分析；风险会进入字段置信度和最终报告边界说明。</p></div></div>';
    } else if (qa.qaStatus === "BLOCK" || qa.qaStatus === "WARNING") {
      body += issueGroups(stageId, qa);
    } else if (qa.qaStatus === "PASS") {
      body += '<div style="color:var(--green);font-size:13px;font-weight:650">本阶段已通过，可继续进入下一阶段。</div>';
    }

    if (qa.qaStatus !== "PENDING" && qa.qaStatus !== "CHECKING") body = passedRulesButton(qa) + body;

    return '<section class="qa-unified ' + meta.cls + '">' +
      '<div class="qa-unified-header"><span class="qa-unified-status">' + icon(meta.icon) + meta.label + '</span>' +
      '<div class="qa-unified-copy"><b>' + escapeHtml((qa.stageName || "阶段质检").replace(/质检$/, "") + "质检") + '</b><p>' + escapeHtml(qaSummary(stageId, qa)) + '</p></div>' +
      '<span class="qa-unified-count">' + countText + '</span></div>' +
      '<div class="qa-unified-body">' + body + '</div></section>';
  };

  getAllCheckedRules = function () {
    var rules = [];
    ["planning", "collecting", "structuring", "comparing", "writing"].forEach(function (stageId) {
      var qa = effectiveQA(stageId);
      if (qa.qaStatus === "PENDING" || qa.qaStatus === "CHECKING") return;
      (qa.checkedRules || []).forEach(function (rule) {
        rules.push({ ruleName: rule.ruleName, status: rule.status, reason: rule.reason, stageId: stageId });
      });
    });
    return rules;
  };

  renderQAOverview = function () {
    var stages = ["planning", "collecting", "structuring", "comparing", "writing"].map(effectiveQA);
    var completed = stages.filter(function (qa) { return qa.qaStatus !== "PENDING" && qa.qaStatus !== "CHECKING"; });
    var blocked = completed.filter(function (qa) { return qa.qaStatus === "BLOCK"; }).length;
    var warnings = completed.filter(function (qa) { return qa.qaStatus === "WARNING"; }).length;
    var passed = completed.filter(function (qa) { return qa.qaStatus === "PASS"; }).length;
    var pending = stages.length - completed.length;
    var scores = completed.map(function (qa) { return qa.score; }).filter(function (score) { return typeof score === "number" && score > 0; });
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : "—";
    var overall = blocked ? { label: "存在阻断", cls: "block", icon: "block" } : warnings ? { label: "带风险通过", cls: "warning", icon: "alert" } : completed.length ? { label: "当前已通过", cls: "pass", icon: "check" } : { label: "等待质检", cls: "pending", icon: "clock" };
    return '<div class="qa-gate-card"><div class="qa-unified-status ' + overall.cls + '">' + icon(overall.icon) + overall.label + '</div><div class="qa-gate-score">' + avg + '</div><span style="font-size:12px;color:var(--muted)">已执行阶段平均分</span></div>' +
      '<div class="qa-gate-card"><div style="font-size:30px;font-weight:900;color:var(--red)">' + blocked + '</div><span style="font-size:12px;color:var(--muted)">已阻断</span></div>' +
      '<div class="qa-gate-card"><div style="font-size:30px;font-weight:900;color:var(--amber)">' + warnings + '</div><span style="font-size:12px;color:var(--muted)">带风险通过</span></div>' +
      '<div class="qa-gate-card"><div style="font-size:30px;font-weight:900;color:var(--muted)">' + pending + '</div><span style="font-size:12px;color:var(--muted)">待质检阶段</span></div>';
  };

  renderQATimeline = function () {
    var names = { planning: "规划质检", collecting: "采集质检", structuring: "结构化质检", comparing: "对比分析质检", writing: "报告质检" };
    return ["planning", "collecting", "structuring", "comparing", "writing"].map(function (stageId, index) {
      var qa = effectiveQA(stageId);
      var meta = stageStatusMeta(qa.qaStatus);
      var passed = (qa.checkedRules || []).filter(function (rule) { return rule.status === "PASS"; }).length;
      var total = (qa.checkedRules || []).length;
      var disabled = qa.qaStatus === "PENDING" || qa.qaStatus === "CHECKING";
      return '<button class="qa-stage-card ' + meta.cls + '" type="button" data-qa-stage-detail="' + stageId + '"' + (disabled ? ' disabled' : '') + '>' +
        '<div class="qa-stage-num ' + meta.cls + '">' + (index + 1) + '</div><h3>' + names[stageId] + '</h3>' +
        '<span class="qa-tag" style="display:flex;align-items:center;gap:5px;color:var(--' + (meta.cls === 'pass' ? 'green' : meta.cls === 'warning' ? 'amber' : meta.cls === 'block' ? 'red' : 'muted') + ')">' + icon(meta.icon, "small") + meta.label + '</span>' +
        '<span style="font-size:11px;color:var(--muted)">' + (disabled ? "尚无质检结果" : passed + "/" + total + " 规则通过") + '</span></button>';
    }).join("");
  };

  renderQAIssueList = function () {
    var entries = [];
    ["planning", "collecting", "structuring", "comparing", "writing"].forEach(function (stageId) {
      var qa = effectiveQA(stageId);
      if (qa.qaStatus === "PENDING" || qa.qaStatus === "CHECKING") return;
      effectiveIssues(stageId, qa).forEach(function (issue) { entries.push({ stageId: stageId, qa: qa, issue: issue }); });
    });
    if (!entries.length) return '<div class="qa-empty"><h3>当前没有待处理问题</h3><p>只展示已经执行过的阶段；未来阶段不会提前生成质检结论。</p></div>';
    return entries.map(function (entry, idx) {
      var issue = entry.issue;
      var blocker = (issue.issueLevel || issue.issue_level) === "blocker";
      var actionId = "qa_action_" + entry.stageId + "_" + idx;
      return '<div class="qa-issue-card ' + (blocker ? "blocker" : "warning") + '" id="' + actionId + '">' +
        '<div class="qa-issue-meta"><b style="color:' + (blocker ? 'var(--red)' : 'var(--amber)') + '">' + (blocker ? "关键异常" : "警告") + '</b><b>阶段</b> ' + escapeHtml(entry.qa.stageName || entry.stageId) + '<span class="qa-violated-rule' + (blocker ? '' : ' warning-rule') + '">' + escapeHtml(issue.violatedRule || issue.violated_rule || "规则异常") + '</span></div>' +
        '<div style="font-size:13px;line-height:1.6;margin:8px 0">' + escapeHtml(issue.issueDesc || issue.issue_desc || "") + '</div>' +
        ((issue.fixPrompt || issue.fix_prompt) ? '<div class="qa-fix-prompt">' + escapeHtml(issue.fixPrompt || issue.fix_prompt) + '</div>' : '') +
        '</div>';
    }).join("");
  };

  renderQAPassedList = function () {
    var passed = getAllCheckedRules().filter(function (rule) { return rule.status === "PASS"; });
    if (!passed.length) return '<p class="muted">暂无已执行并通过的规则。</p>';
    return '<button class="qa-report-rules-btn" type="button" id="openRulesDrawer">' + icon("check", "small") + '查看已通过的 ' + passed.length + ' 项规则</button>';
  };

  var oldRenderQADashboard = renderQADashboard;
  renderQADashboard = function () {
    oldRenderQADashboard();
    var h1 = document.querySelector("#qa-dashboard .section-head h1");
    var p = document.querySelector("#qa-dashboard .section-head p");
    if (h1) h1.textContent = "阶段质检报告";
    if (p) p.textContent = "只展示已经执行过的阶段；质检状态统一为待质检、质检中、已通过、带风险通过和已阻断。";
  };

  function addChapterSummaryBefore(heading, text) {
    if (!heading || heading.previousElementSibling && heading.previousElementSibling.classList.contains("chapter-summary")) return;
    var box = document.createElement("div");
    box.className = "chapter-summary";
    box.innerHTML = '<div class="chapter-summary-title">' + icon("document", "small") + '<span>本章结论</span></div><p>' + text + '</p>';
    heading.parentNode.insertBefore(box, heading);
  }

  function polishFinalReport() {
    var final = document.getElementById("final");
    if (!final) return;
    var main = final.querySelector(".report-main");
    if (!main) return;

    main.querySelectorAll(".chapter-conclusion").forEach(function (box) {
      if (box.dataset.batch3Done) return;
      var parts = Array.from(box.querySelectorAll(".ch-c-item p")).map(function (p) { return p.innerHTML.trim(); }).filter(Boolean);
      box.innerHTML = '<div class="chapter-summary-title">' + icon("document", "small") + '<span>本章结论</span></div><p>' +
        (parts[0] || "") + (parts[1] ? " 需要注意：" + parts[1] : "") + (parts[2] ? " 因此建议：" + parts[2] : "") + '</p>';
      box.dataset.batch3Done = "1";
    });

    var headings = Array.from(main.querySelectorAll("h2"));
    function findHeading(prefix) { return headings.find(function (h) { return h.textContent.trim().indexOf(prefix) === 0; }); }
    addChapterSummaryBefore(findHeading("第二章"), "本次研究以 500 元以内、1—3 人家庭的空气炸锅新品立项为目标。公开资料可以支持竞品结构、卖点和用户痛点比较，但不能替代真实销量、投放和用户调研数据。 ");
    addChapterSummaryBefore(findHeading("第七章"), "综合竞品能力和用户痛点，我方适合进入 500 元以内的小家庭空气炸锅市场，但不应通过单纯低价或大容量上探建立差异。首版产品应优先验证易清洁、小份量烹饪与低噪音的组合价值。 ");
    addChapterSummaryBefore(findHeading("第八章"), "当前报告可以作为产品立项的方向性输入，但所有活动价格、公开评价和规划目标均需保留边界说明；进入开发决策前仍应补充样机测试、目标用户访谈和真实业务数据。 ");

    var chapter6 = findHeading("第六章");
    if (chapter6 && !chapter6.nextElementSibling.classList.contains("chapter-lead")) {
      var lead = document.createElement("p");
      lead.className = "chapter-lead";
      lead.textContent = "综合竞品能力、用户痛点与证据强度，我方适合进入 500 元以内的小家庭空气炸锅市场。策略重点不是堆叠功能，而是用易清洁、小份量烹饪和低噪音形成清晰的组合价值。";
      chapter6.insertAdjacentElement("afterend", lead);
    }

    var riskHeading = findHeading("第七章");
    if (riskHeading) riskHeading.id = "reportRiskBoundary";

    var sideHeadings = Array.from(final.querySelectorAll(".report-side h2"));
    var deliveryHeading = sideHeadings.find(function (h) { return h.textContent.indexOf("最终交付检查") >= 0 || h.textContent.indexOf("交付状态") >= 0; });
    if (deliveryHeading) {
      deliveryHeading.textContent = "交付状态";
      var container = deliveryHeading.nextElementSibling;
      if (container && container.classList.contains("context-list")) {
        var gate = getFinalDeliveryGate();
        container.innerHTML = '<div class="delivery-status-card ' + (gate.unresolvedBlockers ? 'blocked' : '') + '"><b>' +
          (gate.unresolvedBlockers ? "暂不可交付｜仍有 " + gate.unresolvedBlockers + " 项阻断" : "可交付｜存在 " + gate.unresolvedWarnings + " 项风险边界") +
          '</b><p>' + (gate.unresolvedBlockers ? "先处理阻断问题，再生成正式交付版本。" : "风险已统一纳入第七章，不再单独展示系统警告面板。") + '</p></div>' +
          '<button class="btn subtle" type="button" data-report-risk-boundary>' + icon("shield", "small") + '查看风险与分析边界</button>';
      }
    }
  }

  var oldRenderFinalPage = renderFinalPage;
  renderFinalPage = function () {
    oldRenderFinalPage();
    polishFinalReport();
  };

  var oldRenderMainTask = renderMainTask;
  renderMainTask = function () {
    oldRenderMainTask();
    document.querySelectorAll("#mainTask .handoff-contract").forEach(function (node) { node.remove(); });
    document.querySelectorAll("#mainTask [data-qa-drawer]").forEach(function (button) {
      if (button.textContent.indexOf("查看警告") >= 0) button.remove();
    });
  };

  var oldRenderAll = renderAll;
  renderAll = function () {
    if (runtime.stage === "report") {
      runtime.qualityText = getFinalDeliveryGate().unresolvedBlockers ? "暂不可交付" : "可交付";
    }
    oldRenderAll();
    document.querySelectorAll(".handoff-contract").forEach(function (node) { node.remove(); });
    if (runtime.page === "final") polishFinalReport();
  };

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-report-risk-boundary]");
    if (!button) return;
    event.preventDefault();
    if (runtime.page !== "final") goTo("final");
    window.setTimeout(function () {
      var target = document.getElementById("reportRiskBoundary");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  });

  /* Agent identity is expressed by position and state, not five competing colors. */
  agents.forEach(function (agent) { agent.accent = "#3560d4"; });

  renderAll();
}());
