/* Connect the visible workflow to the FastAPI pipeline when served by it. */
(function () {
  "use strict";

  // A course submission can be opened directly as a standalone Demo. In that
  // case no HTTP server exists, so preserve the local interactive flow rather
  // than showing a failed backend connection.
  if (location.protocol === "file:" || !window.ENABLE_LIVE_PIPELINE && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;

  var apiBase = window.location.origin;
  var live = { runId: "", status: null, result: null, artifacts: {}, timer: null, starting: false };
  window.livePipeline = live;

  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
    });
  }

  function splitItems(value) {
    return String(value || "").split(/[、,，\n]/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function taskPayload() {
    persistForm();
    return {
      industry: String(taskState.category || "商品竞品分析").trim(),
      target_companies: splitItems(taskState.competitors),
      dimensions: splitItems(taskState.dimensions),
      report_usage: String(taskState.purpose || "竞品分析").trim(),
      source_scope: splitItems(taskState.sources),
      price_range: String(taskState.priceRange || "").trim(),
      target_product: String(taskState.targetProduct || "").trim(),
      target_audience: String(taskState.targetAudience || "").trim(),
      decision_question: String(taskState.decisionQuestion || "").trim()
    };
  }

  async function request(path, options) {
    var response = await fetch(apiBase + path, options);
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.detail || ("请求失败（" + response.status + "）"));
    return body;
  }

  function setStageFromStatus(status) {
    var mapping = { planning: "plan", collecting: "collecting", structuring: "execution", comparing: "compare", writing: "report", final: "report" };
    var stage = mapping[status.current_agent] || mapping[status.current_phase] || runtime.stage;
    runtime.stage = stage;
    runtime.viewStage = stage;
    runtime.activeAgent = status.current_agent || stageConfig[stage].agent;
    runtime.viewAgent = runtime.activeAgent;
    runtime.progress = Number(status.progress || 0);
    runtime.running = status.status === "running" || status.status === "waiting";
    runtime.statusText = status.latest_log || "真实分析任务运行中";
    runtime.qualityText = status.qa_status ? "QA：" + status.qa_status : "等待阶段质检";
    analysisTask.currentAgent = runtime.activeAgent;
    analysisTask.status = status.status;
  }

  async function loadArtifacts() {
    if (!live.runId) return;
    var result = await request("/api/runs/" + encodeURIComponent(live.runId) + "/result");
    live.result = result;
    live.artifacts.planning = result.planning_result || {};
    live.artifacts.collected = result.collected_sources || {};
    live.artifacts.structured = result.structured_schema_table || {};
    live.artifacts.comparing = result.comparison_analysis || {};
  }

  async function poll() {
    if (!live.runId) return;
    try {
      var status = await request("/api/runs/" + encodeURIComponent(live.runId) + "/status");
      live.status = status;
      setStageFromStatus(status);
      if (status.status === "completed" || status.status === "blocked" || status.status === "failed") {
        runtime.running = false;
        await loadArtifacts();
        if (live.result && live.result.final_report_markdown) {
          runtime.stage = "report";
          runtime.viewStage = "report";
          runtime.activeAgent = "writing";
          runtime.viewAgent = "writing";
          runtime.reportGenerated = true;
        }
        renderAll();
        return;
      }
      renderAll();
      live.timer = window.setTimeout(poll, 1200);
    } catch (error) {
      runtime.running = false;
      runtime.statusText = "无法读取后端运行状态：" + error.message;
      renderAll();
    }
  }

  async function startRun() {
    if (live.starting) return false;
    var payload = taskPayload();
    if (!payload.industry || !payload.target_companies.length) {
      showToast("请先填写品类和至少一个竞品。");
      return false;
    }
    live.starting = true;
    runtime.running = true;
    runtime.statusText = "正在向后端提交真实竞品分析任务";
    runtime.qualityText = "等待后端启动";
    renderAll();
    try {
      var created = await request("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      live.runId = created.run_id;
      window.history.replaceState(null, "", "/runs/" + encodeURIComponent(live.runId));
      runtime.statusText = created.demo_mode ? "后端以 Demo 资料运行；配置 Key 后可使用真实联网数据" : "真实联网分析任务已启动";
      poll();
      return true;
    } catch (error) {
      runtime.running = false;
      runtime.statusText = "后端未启动任务：" + error.message;
      showToast(error.message);
      renderAll();
      return false;
    } finally {
      live.starting = false;
    }
  }

  function qaCard() {
    if (!live.status) return "";
    var label = live.status.qa_status || (live.status.status === "failed" ? "BLOCK" : "运行中");
    return '<section class="qa-unified ' + (label === "PASS" ? "pass" : label === "WARNING" ? "warning" : label === "BLOCK" ? "block" : "checking") + '">'
      + '<div class="qa-unified-header"><span class="qa-unified-status">真实运行</span><div class="qa-unified-copy"><b>后端阶段状态</b><p>' + escape(live.status.latest_log || "等待后端返回") + '</p></div><span class="qa-unified-count">' + escape(label) + '</span></div></section>';
  }

  function structuredView() {
    var rows = (live.artifacts.structured || {}).schema_table || [];
    if (!rows.length) return null;
    return '<article class="panel main-card"><div class="section-head"><div><span class="demo-note">03｜结构化处理 Agent｜真实后端产物</span><h1>竞品结构化结果</h1><p>以下数据来自本次后端运行，不再使用空气炸锅示例。</p></div></div>'
      + '<div class="compare-scale"><table class="matrix"><thead><tr><th>竞品</th><th>定位</th><th>核心特征</th><th>价格口径</th><th>可信度</th></tr></thead><tbody>'
      + rows.map(function (row) { return '<tr><td><b>' + escape(row.competitor_name) + '</b></td><td>' + escape(row.product_positioning) + '</td><td>' + escape((row.core_features || []).join('、')) + '</td><td>' + escape(row.pricing_model) + '</td><td>' + escape(row.confidence_level) + '</td></tr>'; }).join('')
      + '</tbody></table></div></article>';
  }

  function comparingView() {
    var data = live.artifacts.comparing || {};
    if (!data.comparison_matrix) return null;
    var findings = (data.key_differences || []).map(function (item) { return '<li>' + escape(item) + '</li>'; }).join('');
    var opportunities = (data.opportunity_points || []).map(function (item) { return '<tr><td>' + escape(item.opportunity) + '</td><td>' + escape(item.logic) + '</td><td>' + escape(item.confidence) + '</td></tr>'; }).join('');
    return '<article class="panel main-card"><div class="section-head"><div><span class="demo-note">04｜对比分析 Agent｜真实后端产物</span><h1>竞品对比分析</h1><p>关键结论与机会点均取自本次任务的结构化资料。</p></div></div>'
      + '<div class="finding-card"><h2>关键差异</h2><ul>' + (findings || '<li>暂无可用差异结论。</li>') + '</ul></div>'
      + '<div class="compare-scale"><h3>机会点</h3><table class="matrix"><thead><tr><th>机会点</th><th>推导逻辑</th><th>置信度</th></tr></thead><tbody>' + opportunities + '</tbody></table></div></article>';
  }

  function reportView() {
    if (!live.result) return null;
    var markdown = live.result.final_report_markdown || "";
    var quality = (live.result.quality_report || {}).qa_status || live.status && live.status.qa_status || "";
    return '<article class="panel main-card"><div class="section-head"><div><span class="demo-note">05｜报告撰写 Agent｜真实后端产物</span><h1>' + escape((live.artifacts.planning || {}).category || taskState.category || "竞品") + '竞品分析报告</h1><p>运行编号：' + escape(live.runId) + ' ｜ 最终 QA：' + escape(quality) + '</p></div></div>'
      + (markdown ? '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75;font:14px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:10px;padding:22px">' + escape(markdown) + '</pre>' : '<div class="risk-card amber"><b>报告尚未生成</b><p>后端任务未完成或被 QA 阻断；请查看运行状态和质检详情。</p></div>')
      + '</article>';
  }

  var originalRequestStageTransition = requestStageTransition;
  requestStageTransition = function (targetStage) {
    if (targetStage === "collecting" && !live.runId) return startRun();
    return originalRequestStageTransition(targetStage);
  };

  var originalExecutionView = renderExecutionStage;
  renderExecutionStage = function () { return structuredView() || originalExecutionView(); };
  var originalComparingView = renderCompareStage;
  renderCompareStage = function () { return comparingView() || originalComparingView(); };
  var originalReportView = renderReportStage;
  renderReportStage = function () { return reportView() || originalReportView(); };
  var originalInlineQA = renderInlineQAPanel;
  renderInlineQAPanel = function () { return live.runId ? qaCard() : originalInlineQA(); };

  var embeddedRun = location.pathname.match(/^\/runs\/([^/]+)$/);
  if (embeddedRun) {
    live.runId = decodeURIComponent(embeddedRun[1]);
    poll();
  }
}());
