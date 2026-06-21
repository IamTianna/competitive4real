/* Batch 3A Lite — additive structured-field table and field-level context. */
(function () {
  "use strict";

  var structuredFields = [
    {
      productId: "P001", skuName: "美的炎烤空气炸锅 KZC6502XM",
      values: {
        capacity: { label: "容量", value: "5.0L" },
        power: { label: "功率", value: "1500W" },
        heat: { label: "加热方式", value: "热风循环" },
        window: { label: "可视窗", value: "明确强调" },
        cleaning: { id: "P001.cleaning", label: "清洁结构", value: "易清洁炸篮，清洁细节仍需确认", status: "warning", statusLabel: "细节待确认", confidence: "中高", sourceIds: ["S001", "S005"], rationale: "商品页明确强调易清洁，但公开资料未完整披露炸篮拆洗范围与清洁死角。", recommendation: "保留“易清洁炸篮”作为结构化结果，同时将清洁细节标记为待确认。", recommendedValue: "易清洁炸篮；拆洗细节待确认", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        price: { id: "P001.price", label: "价格口径", value: "约 399–499 元，受活动影响", status: "warning", statusLabel: "活动波动", confidence: "中高", sourceIds: ["S001", "S005"], rationale: "公开页面同时包含标价与活动价格，当前仅能形成阶段性价格区间。", recommendation: "保留 399–499 元为公开价格区间，并继续标注受活动影响。", recommendedValue: "约 399–499 元（活动价格区间）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        feedback: { label: "用户反馈", value: "关注清洁死角与真实容量" },
        confidence: { label: "置信度", value: "中高" }
      }
    },
    {
      productId: "P002", skuName: "九阳 KL55-VF736",
      values: {
        capacity: { label: "容量", value: "5.5L" },
        power: { label: "功率", value: "1500W" },
        heat: { label: "加热方式", value: "热风循环" },
        window: { id: "P002.window", label: "可视窗", value: "未明确", status: "warning", statusLabel: "信息不足", confidence: "中", sourceIds: ["S002", "S005"], rationale: "当前商品页与问答摘录没有形成可验证的可视窗结论。", recommendation: "不推断是否配备可视窗，保留为“未明确”。", recommendedValue: "未明确（公开信息不足）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        cleaning: { id: "P002.cleaning", label: "清洁结构", value: "公开信息不足", status: "warning", statusLabel: "信息不足", confidence: "中", sourceIds: ["S002", "S005"], rationale: "问答中存在清洁咨询，但公开资料未明确炸篮结构和可拆洗范围。", recommendation: "保留缺失状态，不根据咨询内容反推产品结构。", recommendedValue: "公开信息不足（保留缺失）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        price: { id: "P002.price", label: "价格口径", value: "约 299–429 元，受会员价和券影响", status: "warning", statusLabel: "活动波动", confidence: "中", sourceIds: ["S002", "S005"], rationale: "会员价与限时券会改变短期到手价，当前区间不等于长期稳定价格。", recommendation: "保留公开价格区间，并将会员价与限时券视为促销线索。", recommendedValue: "约 299–429 元（会员价与券影响）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        feedback: { id: "P002.feedback", label: "用户反馈", value: "对噪音、清洁和炸制均匀性存在波动反馈", status: "warning", statusLabel: "趋势信号", confidence: "中", sourceIds: ["S002"], rationale: "公开问答和评价样本可提示问题方向，但样本不足以代表全部用户。", recommendation: "将该结论表述为趋势性反馈，不写成确定性质量结论。", recommendedValue: "噪音、清洁与均匀性存在趋势性反馈", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        confidence: { label: "置信度", value: "中" }
      }
    },
    {
      productId: "P003", skuName: "苏泊尔 KD60D830",
      values: {
        capacity: { id: "P003.capacity", label: "容量", value: "6.0L", status: "conflict", statusLabel: "套餐边界待拆分", confidence: "中高", sourceIds: ["S003", "S005"], rationale: "主商品容量为 6L，但部分来源把赠品套餐描述混入同一字段。", recommendation: "基础商品容量统一为 6.0L，赠品与套餐内容单独记录。", recommendedValue: "6.0L（主商品；套餐信息单列）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        power: { label: "功率", value: "1500W" },
        heat: { label: "加热方式", value: "热风循环" },
        window: { id: "P003.window", label: "可视窗", value: "待确认", status: "warning", statusLabel: "待确认", confidence: "中", sourceIds: ["S003", "S005"], rationale: "现有来源没有提供足够一致的可视窗信息。", recommendation: "保留为待确认，不根据同系列商品外观进行推断。", recommendedValue: "待确认（无一致公开证据）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        cleaning: { id: "P003.cleaning", label: "清洁结构", value: "公开信息不足", status: "warning", statusLabel: "信息不足", confidence: "中", sourceIds: ["S003", "S005"], rationale: "当前来源重点覆盖价格与规格，没有形成可验证的清洁结构描述。", recommendation: "保留缺失状态，并在后续采集时补充官方详情页。", recommendedValue: "公开信息不足（待补官方详情）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        price: { id: "P003.price", label: "价格口径", value: "活动价可能接近 500 元，常态价待确认", status: "conflict", statusLabel: "口径冲突", confidence: "中高", sourceIds: ["S003", "S005"], rationale: "同一 SKU 同时出现标价、券后价与赠品套餐价，不能直接压缩为一个可比价格。", recommendation: "将日常单品价、活动价和套餐价分开记录；套餐价不进入核心价格评分。", recommendedValue: "日常价 429 元；活动价 399 元；套餐价 499 元（不进入核心评分）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        feedback: { label: "用户反馈", value: "体积偏大，价格敏感" },
        confidence: { label: "置信度", value: "中高" }
      }
    },
    {
      productId: "P004", skuName: "小熊 QZG-A15T2",
      values: {
        capacity: { label: "容量", value: "4.5L" },
        power: { label: "功率", value: "1300W" },
        heat: { label: "加热方式", value: "热风循环" },
        window: { id: "P004.window", label: "可视窗", value: "未明确", status: "warning", statusLabel: "信息不足", confidence: "中", sourceIds: ["S004", "S005"], rationale: "当前评价与结构化资料没有形成稳定的可视窗信息。", recommendation: "保留为未明确，不把同品牌其他型号特征迁移到该 SKU。", recommendedValue: "未明确（公开信息不足）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        cleaning: { id: "P004.cleaning", label: "清洁结构", value: "公开信息不足", status: "warning", statusLabel: "信息不足", confidence: "中", sourceIds: ["S004", "S005"], rationale: "公开评价讨论质感与耐用性，但不能据此推断具体清洁结构。", recommendation: "保留缺失状态，等待商品详情或说明书证据。", recommendedValue: "公开信息不足（待补商品详情）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        price: { id: "P004.price", label: "价格口径", value: "约 199–329 元，秒杀和低价券明显", status: "warning", statusLabel: "活动波动", confidence: "中", sourceIds: ["S004", "S005"], rationale: "价格受秒杀和低价券影响，适合用作价格带参照，不宜与中端新品做等权比较。", recommendation: "保留价格区间并标记为价格带参照。", recommendedValue: "约 199–329 元（价格带参照）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        feedback: { id: "P004.feedback", label: "用户反馈", value: "价格正向，质感和耐用反馈分化", status: "warning", statusLabel: "样本偏差", confidence: "中", sourceIds: ["S004"], rationale: "公开评价能提供趋势信号，但可能放大极端体验。", recommendation: "保留分化判断，并明确其为公开评价趋势。", recommendedValue: "价格评价偏正向；质感与耐用反馈分化（趋势）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        confidence: { label: "置信度", value: "中" }
      }
    },
    {
      productId: "P005", skuName: "我方产品（规划）",
      values: {
        capacity: { id: "P005.capacity", label: "容量", value: "4.5–5.0L（规划）", status: "planned", statusLabel: "规划值", confidence: "低", sourceIds: [], rationale: "该值来自产品规划，并非已上市商品或样机实测。", recommendation: "继续以 4.5–5.0L 作为目标范围，并明确标记为规划值。", recommendedValue: "4.5–5.0L（规划目标）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        power: { label: "功率", value: "1500W（目标）" },
        heat: { label: "加热方式", value: "热风循环（规划）" },
        window: { id: "P005.window", label: "可视窗", value: "明确规划", status: "planned", statusLabel: "规划值", confidence: "低", sourceIds: [], rationale: "该字段是产品定义目标，尚未经过样机与用户验证。", recommendation: "保留可视窗为规划能力，并与竞品真实能力分开表达。", recommendedValue: "可视窗（规划目标，待验证）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        cleaning: { id: "P005.cleaning", label: "清洁结构", value: "可拆洗炸篮（规划）", status: "planned", statusLabel: "规划值", confidence: "低", sourceIds: [], rationale: "该字段来自产品策略建议，并非已经验证的产品能力。", recommendation: "保留为规划目标，并在进入开发前安排样机清洗测试。", recommendedValue: "可拆洗炸篮（规划目标，待样机验证）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        price: { id: "P005.price", label: "价格口径", value: "500 元以内（目标）", status: "planned", statusLabel: "目标值", confidence: "低", sourceIds: [], rationale: "该价格为立项目标，而非真实成交价。", recommendation: "继续作为目标价格上限，并避免与竞品实时价格直接等同。", recommendedValue: "500 元以内（规划目标）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        feedback: { id: "P005.feedback", label: "用户反馈", value: "尚无真实用户反馈", status: "planned", statusLabel: "待验证", confidence: "低", sourceIds: [], rationale: "产品尚处于规划阶段，没有真实评价、售后或复购数据。", recommendation: "保留为空，并在报告中明确需要样机试用与目标用户访谈。", recommendedValue: "尚无真实用户反馈（待样机验证）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" },
        confidence: { id: "P005.confidence", label: "置信度", value: "低", status: "planned", statusLabel: "规划数据", confidence: "低", sourceIds: [], rationale: "我方字段全部来自内部规划，缺少公开商品页、样机或用户证据。", recommendation: "维持低置信度标记，直到完成样机测试和用户验证。", recommendedValue: "低（规划数据，待验证）", impact: "此修改仅记录在新增结构化字段面板与版本记录中。" }
      }
    }
  ];

  var columnOrder = ["capacity", "power", "heat", "window", "cleaning", "price", "feedback", "confidence"];
  var decisions = {};
  runtime.selectedStructuredField = runtime.selectedStructuredField || null;

  function allInteractiveFields() {
    var list = [];
    structuredFields.forEach(function (row) {
      Object.keys(row.values).forEach(function (key) {
        var field = row.values[key];
        if (field && field.id) {
          field.productId = row.productId;
          field.skuName = row.skuName;
          field.fieldKey = key;
          list.push(field);
        }
      });
    });
    return list;
  }

  function findField(id) {
    return allInteractiveFields().find(function (field) { return field.id === id; }) || null;
  }

  function fieldBlockMarkup(field, label) {
    if (!field) return '<div class="structured-subfield"><span class="structured-subfield-label">' + escapeHtml(label || "字段") + '</span><span class="structured-subfield-value">—</span></div>';
    var selected = runtime.selectedStructuredField === field.id;
    var classes = ["structured-subfield", field.status || "", field.updated ? "updated" : "", selected ? "selected" : ""].filter(Boolean).join(" ");
    var content = '<span class="structured-subfield-label">' + escapeHtml(label || field.label || "字段") + '</span>'
      + '<span class="structured-subfield-value">' + escapeHtml(field.value) + '</span>'
      + (field.statusLabel ? '<span class="structured-cell-note">' + escapeHtml(field.statusLabel) + '</span>' : '');
    if (!field.id) return '<div class="' + classes + '">' + content + '</div>';
    return '<button class="' + classes + '" type="button" data-structured-field="' + escapeHtml(field.id) + '" aria-pressed="' + String(selected) + '">' + content + '</button>';
  }

  function compoundCellMarkup(items) {
    return '<div class="structured-compound-cell">' + items.map(function(item) {
      return fieldBlockMarkup(item.field, item.label);
    }).join("") + '</div>';
  }

  function summarizeRowStatus(row) {
    var values = Object.keys(row.values).map(function(key) { return row.values[key]; }).filter(Boolean);
    var priority = { conflict: 4, warning: 3, planned: 2, updated: 1 };
    var chosen = values.slice().sort(function(a, b) {
      return (priority[b.status] || 0) - (priority[a.status] || 0);
    })[0];
    if (!chosen || !chosen.status) return { status: "", label: "已标准化" };
    return { status: chosen.status || "", label: chosen.statusLabel || "需关注" };
  }

  function renderStructuredFieldTable() {
    var headers = ["商品 / SKU", "基础规格", "结构设计", "价格口径", "用户反馈", "置信度 / 状态"];
    return '<section class="structured-field-section">' +
      '<div class="structured-field-head"><div><h3>关键结构化字段</h3><p>点击带状态提示的字段，可在右侧查看处理依据并记录方案。</p></div></div>' +
      '<div class="structured-field-table-wrap"><table class="structured-field-table"><thead><tr>' +
      headers.map(function (header) { return '<th>' + header + '</th>'; }).join("") + '</tr></thead><tbody>' +
      structuredFields.map(function (row) {
        var rowStatus = summarizeRowStatus(row);
        var confidence = row.values.confidence || { label: "置信度", value: "未标注" };
        return '<tr><td><div class="structured-sku-cell">' + escapeHtml(row.skuName) + '</div></td>' +
          '<td>' + compoundCellMarkup([
            { label: "容量", field: row.values.capacity },
            { label: "功率", field: row.values.power },
            { label: "加热", field: row.values.heat }
          ]) + '</td>' +
          '<td>' + compoundCellMarkup([
            { label: "可视窗", field: row.values.window },
            { label: "清洁", field: row.values.cleaning }
          ]) + '</td>' +
          '<td>' + fieldBlockMarkup(row.values.price, "价格") + '</td>' +
          '<td>' + fieldBlockMarkup(row.values.feedback, "反馈") + '</td>' +
          '<td><div class="structured-status-cell">' +
            fieldBlockMarkup(confidence, "置信度") +
            '<span class="structured-row-status ' + escapeHtml(rowStatus.status) + '">' + escapeHtml(rowStatus.label) + '</span>' +
          '</div></td></tr>';
      }).join("") + '</tbody></table></div></section>';
  }

  var oldRenderExecutionStage = renderExecutionStage;
  renderExecutionStage = function () {
    var html = oldRenderExecutionStage();
    var marker = '<!-- 对比量表 1: 核心数据 -->';
    if (html.indexOf(marker) >= 0) return html.replace(marker, renderStructuredFieldTable() + marker);
    return html;
  };

  function renderFieldContext() {
    var field = findField(runtime.selectedStructuredField);
    if (!field) {
      return '<section class="batch3a-context-panel"><h3>结构化字段说明</h3><div class="batch3a-context-empty">点击新增表格中带状态提示的字段，可查看当前结果、简短依据和来源。</div></section>';
    }
    var state = decisions[field.id] || { decision: "", customText: "" };
    decisions[field.id] = state;
    var sourceButtons = (field.sourceIds || []).length
      ? field.sourceIds.map(function (id) { return '<button class="text-button" type="button" data-source="' + escapeHtml(id) + '">查看来源 ' + escapeHtml(id) + '</button>'; }).join("")
      : '<span class="muted" style="font-size:12px">规划字段暂无外部来源</span>';
    var custom = state.decision === "custom"
      ? '<textarea class="batch3a-custom-input" data-structured-custom="' + escapeHtml(field.id) + '" placeholder="输入你希望采用的字段值或处理方式。">' + escapeHtml(state.customText || "") + '</textarea>'
      : '';
    return '<section class="batch3a-context-panel">' +
      '<h3>结构化字段说明</h3>' +
      '<div class="batch3a-field-summary"><b>' + escapeHtml(field.skuName) + '｜' + escapeHtml(field.label) + '</b><span class="field-current-value">' + escapeHtml(field.value) + '</span><span class="muted" style="font-size:12px">置信度：' + escapeHtml(field.confidence || "未标注") + '</span></div>' +
      '<p class="batch3a-rationale"><b style="color:var(--ink)">为什么这样处理：</b>' + escapeHtml(field.rationale || "暂无补充说明。") + '</p>' +
      '<div class="batch3a-source-row">' + sourceButtons + '</div>' +
      '<div class="batch3a-decision-group">' +
        '<label class="batch3a-decision-option"><input type="radio" name="batch3a-field-decision" value="accept" data-structured-decision="' + escapeHtml(field.id) + '"' + (state.decision === "accept" ? " checked" : "") + '>采纳 AI 建议</label>' +
        '<label class="batch3a-decision-option"><input type="radio" name="batch3a-field-decision" value="keep" data-structured-decision="' + escapeHtml(field.id) + '"' + (state.decision === "keep" ? " checked" : "") + '>保留当前结果</label>' +
        '<label class="batch3a-decision-option"><input type="radio" name="batch3a-field-decision" value="custom" data-structured-decision="' + escapeHtml(field.id) + '"' + (state.decision === "custom" ? " checked" : "") + '>自定义修改</label>' +
      '</div>' + custom +
      '<details class="batch3a-detail"><summary>查看详细依据</summary><div><p><b>AI 建议：</b>' + escapeHtml(field.recommendation || "暂无") + '</p><p><b>影响范围：</b>' + escapeHtml(field.impact || "仅记录本字段") + '</p></div></details>' +
      '<div class="batch3a-context-action"><button class="btn primary" type="button" data-structured-apply="' + escapeHtml(field.id) + '">应用修改</button></div>' +
      '<p class="batch3a-context-footnote">本批只新增字段面板及其记录能力，原有商品卡片与四类量表保持不变。</p>' +
    '</section>';
  }

  var oldRenderContextPanel = renderContextPanel;
  renderContextPanel = function () {
    oldRenderContextPanel();
    if (getDisplayStage() !== "execution") return;
    var host = document.getElementById("contextPanel");
    if (!host || host.closest(".context-panel").classList.contains("is-hidden")) return;
    host.insertAdjacentHTML("afterbegin", renderFieldContext());
  };

  function applyFieldDecision(id) {
    var field = findField(id);
    var state = decisions[id] || { decision: "", customText: "" };
    if (!field || !state.decision) {
      showToast("请先选择处理方式。");
      return;
    }
    if (state.decision === "custom" && !String(state.customText || "").trim()) {
      showToast("请输入自定义修改内容。");
      return;
    }
    var previous = field.value;
    if (state.decision === "accept") field.value = field.recommendedValue || field.value;
    if (state.decision === "custom") field.value = String(state.customText).trim();
    field.updated = true;
    field.statusLabel = state.decision === "keep" ? "已保留" : "已更新";
    field.userDecision = state.decision;
    var reason = state.decision === "accept" ? "采纳 AI 字段建议" : state.decision === "custom" ? "采用用户自定义字段方案" : "保留当前字段结果";
    var version = typeof nextVersion === "function" ? nextVersion(reason + "：" + field.skuName + "｜" + field.label, ["新增结构化字段面板"]) : null;
    if (typeof addMessage === "function") addMessage((version ? version.versionId + "｜" : "") + field.skuName + "的“" + field.label + "”已记录：" + previous + " → " + field.value + "。原有商品卡片与四类量表未改动。");
    showToast("字段处理已记录" + (version ? "，已生成 " + version.versionId : "") + "。");
    renderAll();
  }

  document.addEventListener("click", function (event) {
    var fieldButton = event.target.closest("[data-structured-field]");
    if (fieldButton) {
      runtime.selectedStructuredField = fieldButton.dataset.structuredField;
      runtime.contextCollapsed.execution = false;
      renderAll();
      return;
    }
    var applyButton = event.target.closest("[data-structured-apply]");
    if (applyButton) {
      applyFieldDecision(applyButton.dataset.structuredApply);
    }
  });

  document.addEventListener("change", function (event) {
    var radio = event.target.closest("[data-structured-decision]");
    if (!radio) return;
    var id = radio.dataset.structuredDecision;
    decisions[id] = decisions[id] || { decision: "", customText: "" };
    decisions[id].decision = radio.value;
    renderContextPanel();
  });

  document.addEventListener("input", function (event) {
    var textarea = event.target.closest("[data-structured-custom]");
    if (!textarea) return;
    var id = textarea.dataset.structuredCustom;
    decisions[id] = decisions[id] || { decision: "custom", customText: "" };
    decisions[id].customText = textarea.value;
  });

  window.batch3aStructuredFields = structuredFields;
  renderAll();
}());
