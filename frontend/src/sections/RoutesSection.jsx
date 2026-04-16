import { useEffect, useState, useCallback } from "react";
import DetailField from "../components/DetailField";
import { styles } from "../styles";
import { apiUrl } from "../config/api";

const getResponseErrorMessage = async (resp, fallback) => {
  const raw = (await resp.text()).trim();
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
    if (typeof parsed?.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    return raw;
  }

  return raw;
};

const RoutesSection = () => {
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({
    route_code: "",
    route_name: "",
    is_active: true,
  });

  const [processes, setProcesses] = useState([]);
  const [steps, setSteps] = useState([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState("");
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [stepForm, setStepForm] = useState({
    process_id: null,
    notes: "",
  });
  const [saveRouteState, setSaveRouteState] = useState({
    saving: false,
    success: "",
    error: "",
  });
  const [saveStepState, setSaveStepState] = useState({
    saving: false,
    success: "",
    error: "",
  });

  const isNewRoute = selectedRouteId === "__new__";

  const loadProcesses = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/processes"));
      if (!resp.ok) throw new Error("Ошибка загрузки переделов");
      const data = await resp.json();
      setProcesses(data.filter((p) => p.is_active));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadRoutes = useCallback(async (keepCode = null) => {
    setRoutesLoading(true);
    setRoutesError("");
    try {
      const resp = await fetch(apiUrl("/routes"));
      if (!resp.ok) throw new Error("Ошибка загрузки маршрутов");
      const data = await resp.json();
      setRoutes(data);
      if (data.length === 0) {
        setSelectedRouteId(null);
      } else if (keepCode) {
        const found = data.find((r) => r.route_code === keepCode);
        setSelectedRouteId(found ? found.route_id : data[0].route_id);
      } else {
        setSelectedRouteId(data[0].route_id);
      }
    } catch (e) {
      setRoutesError(e.message || "Ошибка загрузки маршрутов");
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  const loadSteps = useCallback(async (routeId) => {
    if (!routeId || routeId === "__new__") {
      setSteps([]);
      setSelectedStepId(null);
      return;
    }

    setStepsLoading(true);
    setStepsError("");
    try {
      const resp = await fetch(apiUrl(`/routes/${routeId}/steps`));
      if (!resp.ok) throw new Error("Ошибка загрузки шагов");
      const data = await resp.json();
      setSteps(data);
      if (data.length > 0) setSelectedStepId(data[0].route_step_id);
      else setSelectedStepId(null);
    } catch (e) {
      setStepsError(e.message || "Ошибка загрузки шагов");
    } finally {
      setStepsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProcesses();
    loadRoutes();
  }, [loadProcesses, loadRoutes]);

  useEffect(() => {
    loadSteps(selectedRouteId);
  }, [selectedRouteId, loadSteps]);

  const filteredRoutes = routes.filter((r) => {
    const q = routeSearch.toLowerCase();
    return (
      r.route_code.toLowerCase().includes(q) ||
      r.route_name.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isNewRoute) return;
    if (filteredRoutes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    const stillVisible = filteredRoutes.some((r) => r.route_id === selectedRouteId);
    if (!stillVisible) setSelectedRouteId(filteredRoutes[0].route_id);
  }, [filteredRoutes, selectedRouteId, isNewRoute]);

  const selectedRoute = routes.find((r) => r.route_id === selectedRouteId) || null;

  useEffect(() => {
    if (!selectedRoute) {
      setIsEditingRoute(false);
      return;
    }
    setRouteForm({
      route_code: selectedRoute.route_code || "",
      route_name: selectedRoute.route_name || "",
      is_active: selectedRoute.is_active ?? true,
    });
    setIsEditingRoute(isNewRoute);
    setSaveRouteState({ saving: false, success: "", error: "" });
  }, [selectedRoute, isNewRoute]);

  useEffect(() => {
    const sel = steps.find((s) => s.route_step_id === selectedStepId);
    if (sel) {
      setStepForm({ process_id: sel.process_id, notes: sel.notes || "" });
      setSaveStepState({ saving: false, success: "", error: "" });
    } else {
      setStepForm({ process_id: processes[0]?.process_id || null, notes: "" });
      setSaveStepState({ saving: false, success: "", error: "" });
    }
  }, [selectedStepId, steps, processes]);

  const handleAddRoute = () => {
    const temp = {
      route_id: "__new__",
      route_code: "",
      route_name: "",
      is_active: true,
    };
    setRoutes((prev) => [temp, ...prev.filter((r) => r.route_id !== "__new__")]);
    setRouteForm({
      route_code: "",
      route_name: "",
      is_active: true,
    });
    setSteps([]);
    setSelectedStepId(null);
    setSelectedRouteId("__new__");
    setIsEditingRoute(true);
    setSaveRouteState({ saving: false, success: "", error: "" });
  };

  const handleCancelRoute = () => {
    if (isNewRoute) {
      setRoutes((prev) => prev.filter((r) => r.route_id !== "__new__"));
      if (routes.length > 1) setSelectedRouteId(routes[1].route_id);
      else setSelectedRouteId(null);
    }
    setIsEditingRoute(false);
    setSaveRouteState({ saving: false, success: "", error: "" });
  };

  const handleSaveRoute = async () => {
    const code = routeForm.route_code.trim();
    const name = routeForm.route_name.trim();
    if (!code) {
      setSaveRouteState({ saving: false, success: "", error: "Код обязателен" });
      return;
    }
    if (!name) {
      setSaveRouteState({ saving: false, success: "", error: "Наименование обязательно" });
      return;
    }

    const payload = {
      route_code: code,
      route_name: name,
      is_active: !!routeForm.is_active,
    };
    setSaveRouteState({ saving: true, success: "", error: "" });

    try {
      let resp;
      if (isNewRoute) {
        resp = await fetch(apiUrl("/routes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const delta = {};
        const current = routes.find((r) => r.route_id === selectedRouteId);
        if (code !== current.route_code) delta.route_code = code;
        if (name !== current.route_name) delta.route_name = name;
        if (!!routeForm.is_active !== !!current.is_active) delta.is_active = !!routeForm.is_active;
        if (Object.keys(delta).length === 0) {
          setIsEditingRoute(false);
          setSaveRouteState({ saving: false, success: "Нет изменений", error: "" });
          return;
        }
        resp = await fetch(apiUrl(`/routes/${selectedRouteId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delta),
        });
      }

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Ошибка сохранения маршрута");
      }

      const data = await resp.json();
      if (isNewRoute) {
        setRoutes((prev) => [data, ...prev.filter((r) => r.route_id !== "__new__")]);
        setSelectedRouteId(data.route_id);
      } else {
        setRoutes((prev) =>
          prev.map((r) => (r.route_id === selectedRouteId ? { ...r, ...data } : r))
        );
      }
      setIsEditingRoute(false);
      setSaveRouteState({ saving: false, success: "Сохранено", error: "" });
    } catch (e) {
      setSaveRouteState({
        saving: false,
        success: "",
        error: e.message || "Ошибка сохранения",
      });
    }
  };

  const selectedStep = steps.find((s) => s.route_step_id === selectedStepId) || null;
  const canEditSteps = isEditingRoute && !isNewRoute;
  const isStepControlsReadOnly = !isEditingRoute;

  const ensureRouteSaved = () => {
    if (isNewRoute) {
      setSaveStepState({ saving: false, success: "", error: "Сначала сохраните маршрут" });
      return false;
    }
    return true;
  };

  const ensureStepsEditable = () => {
    if (!isEditingRoute) {
      setSaveStepState({
        saving: false,
        success: "",
        error: "Чтобы редактировать шаги, включите режим редактирования маршрута",
      });
      return false;
    }
    return true;
  };

  const handleAddStep = async () => {
    if (!ensureStepsEditable() || !ensureRouteSaved()) return;
    const processId = stepForm.process_id || processes[0]?.process_id;
    if (!processId) {
      setSaveStepState({ saving: false, success: "", error: "Нет доступных переделов" });
      return;
    }

    setSaveStepState({ saving: true, success: "", error: "" });
    try {
      const resp = await fetch(apiUrl(`/routes/${selectedRouteId}/steps`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ process_id: processId, notes: stepForm.notes }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Ошибка добавления шага");
      }

      const data = await resp.json();
      await loadSteps(selectedRouteId);
      setSelectedStepId(data.route_step_id);
      setSaveStepState({ saving: false, success: "Шаг добавлен", error: "" });
    } catch (e) {
      setSaveStepState({
        saving: false,
        success: "",
        error: e.message || "Ошибка добавления шага",
      });
    }
  };

  const handleSaveStep = async () => {
    if (!ensureStepsEditable() || !ensureRouteSaved()) return;
    if (!selectedStep) {
      setSaveStepState({ saving: false, success: "", error: "Выберите шаг" });
      return;
    }
    if (!stepForm.process_id) {
      setSaveStepState({ saving: false, success: "", error: "Передел обязателен" });
      return;
    }

    const delta = {};
    if (stepForm.process_id !== selectedStep.process_id) delta.process_id = stepForm.process_id;
    if ((stepForm.notes || "") !== (selectedStep.notes || "")) delta.notes = stepForm.notes;
    if (Object.keys(delta).length === 0) {
      setSaveStepState({ saving: false, success: "Нет изменений", error: "" });
      return;
    }

    setSaveStepState({ saving: true, success: "", error: "" });
    try {
      const resp = await fetch(
        apiUrl(`/route-steps/${selectedStep.route_step_id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delta),
        }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Ошибка сохранения шага");
      }

      await loadSteps(selectedRouteId);
      setSaveStepState({ saving: false, success: "Сохранено", error: "" });
    } catch (e) {
      setSaveStepState({
        saving: false,
        success: "",
        error: e.message || "Ошибка сохранения шага",
      });
    }
  };

  const handleDeleteStep = async () => {
    if (!ensureStepsEditable() || !ensureRouteSaved() || !selectedStep) return;
    setSaveStepState({ saving: true, success: "", error: "" });

    try {
      const resp = await fetch(
        apiUrl(`/route-steps/${selectedStep.route_step_id}`),
        { method: "DELETE" }
      );
      if (!resp.ok) {
        const txt = await getResponseErrorMessage(resp, "Ошибка удаления шага");
        throw new Error(txt || "Ошибка удаления шага");
      }

      await loadSteps(selectedRouteId);
      setSaveStepState({ saving: false, success: "Удалено", error: "" });
    } catch (e) {
      setSaveStepState({
        saving: false,
        success: "",
        error: e.message || "Ошибка удаления шага",
      });
    }
  };

  return (
    <>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Маршруты</h1>
        <div style={styles.headerRight}>
          <div style={styles.searchBar}>
            <input
              type="text"
              placeholder="Поиск по коду или названию"
              value={routeSearch}
              onChange={(e) => setRouteSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={styles.headerActions}>
            <button style={styles.primaryButton} onClick={handleAddRoute}>
              + Добавить маршрут
            </button>
          </div>
        </div>
      </div>

      <div style={styles.contentSplit}>
        <div style={styles.card}>
          {routesLoading && <p>Загрузка...</p>}
          {routesError && <p style={styles.error}>{routesError}</p>}
          {!routesLoading && !routesError && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Код</th>
                  <th style={styles.th}>Наименование</th>
                  <th style={styles.th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((r) => {
                  const isSelected = r.route_id === selectedRouteId;
                  return (
                    <tr
                      key={r.route_id}
                      style={{
                        ...styles.row,
                        ...(isSelected ? styles.rowSelected : {}),
                      }}
                      onClick={() => {
                        setSelectedRouteId(r.route_id);
                        setIsEditingRoute(false);
                        setSaveRouteState({ saving: false, success: "", error: "" });
                      }}
                    >
                      <td style={styles.td}>{r.route_code}</td>
                      <td style={styles.td}>{r.route_name}</td>
                      <td style={styles.td}>{r.is_active ? "Активен" : "Неактивен"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.detailCard}>
          {!selectedRoute && !routesLoading && (
            <p style={{ color: "#6d7b98" }}>Нет выбранного маршрута</p>
          )}
          {selectedRoute && (
            <>
              <div style={styles.detailHeader}>
                <h2 style={styles.detailTitle}>
                  {isNewRoute ? "Новый маршрут" : "Карточка маршрута"}
                </h2>
                {!isEditingRoute && (
                  <button
                    style={styles.primaryGhostButton}
                    onClick={() => setIsEditingRoute(true)}
                  >
                    Редактировать
                  </button>
                )}
                {isEditingRoute && (
                  <div style={styles.editActions}>
                    <button
                      style={{
                        ...styles.primaryButton,
                        opacity: saveRouteState.saving ? 0.7 : 1,
                        cursor: saveRouteState.saving ? "wait" : "pointer",
                      }}
                      onClick={handleSaveRoute}
                      disabled={saveRouteState.saving}
                    >
                      {saveRouteState.saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <button style={styles.secondaryButton} onClick={handleCancelRoute}>
                      Отменить
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.detailBody}>
                {!isEditingRoute && (
                  <>
                    <DetailField label="Code" value={routeForm.route_code} />
                    <DetailField label="Name" value={routeForm.route_name} />
                    <DetailField
                      label="Статус"
                      value={routeForm.is_active ? "Активен" : "Неактивен"}
                    />
                  </>
                )}
                {isEditingRoute && (
                  <>
                    <EditableField
                      label="Code"
                      value={routeForm.route_code}
                      onChange={(v) => setRouteForm((prev) => ({ ...prev, route_code: v }))}
                    />
                    <EditableField
                      label="Name"
                      value={routeForm.route_name}
                      onChange={(v) => setRouteForm((prev) => ({ ...prev, route_name: v }))}
                    />
                    <EditableToggle
                      label="Статус"
                      value={routeForm.is_active}
                      onChange={(v) => setRouteForm((prev) => ({ ...prev, is_active: v }))}
                    />
                  </>
                )}
              </div>

              {saveRouteState.success && (
                <p style={styles.successText}>{saveRouteState.success}</p>
              )}
              {saveRouteState.error && <p style={styles.error}>{saveRouteState.error}</p>}

              <hr style={{ border: "none", borderTop: "1px solid #eef1f6", margin: "16px 0" }} />

              <h3 style={styles.detailTitle}>Шаги маршрута</h3>
              {!isEditingRoute && !isNewRoute && (
                <p style={{ color: "#6d7b98", marginTop: 8 }}>
                  Для редактирования шагов нажмите "Редактировать" в карточке маршрута.
                </p>
              )}
              {stepsLoading && <p>Загрузка шагов...</p>}
              {stepsError && <p style={styles.error}>{stepsError}</p>}
              {!stepsLoading && !stepsError && (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Шаг</th>
                      <th style={styles.th}>Передел</th>
                      <th style={styles.th}>Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((s) => {
                      const isSel = s.route_step_id === selectedStepId;
                      return (
                        <tr
                          key={s.route_step_id}
                          style={{
                            ...styles.row,
                            ...(isSel ? styles.rowSelected : {}),
                          }}
                          onClick={() => setSelectedStepId(s.route_step_id)}
                        >
                          <td style={styles.td}>{s.step_no}</td>
                          <td style={styles.td}>{s.process_name}</td>
                          <td style={styles.td}>{s.notes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={{
                    ...styles.primaryButton,
                    opacity: isStepControlsReadOnly ? 0.55 : 1,
                    cursor: isStepControlsReadOnly
                      ? "not-allowed"
                      : saveStepState.saving
                        ? "wait"
                        : "pointer",
                  }}
                  onClick={handleAddStep}
                  disabled={!canEditSteps || saveStepState.saving}
                >
                  + Добавить шаг
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={handleDeleteStep}
                  disabled={!canEditSteps || !selectedStep}
                >
                  Удалить шаг
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ ...styles.detailLabel, display: "block", marginBottom: 6 }}>
                  Передел
                </label>
                <select
                  value={stepForm.process_id || ""}
                  onChange={(e) =>
                    setStepForm((prev) => ({ ...prev, process_id: Number(e.target.value) }))
                  }
                  style={styles.select}
                  disabled={!canEditSteps || processes.length === 0}
                >
                  {processes.map((p) => (
                    <option key={p.process_id} value={p.process_id}>
                      {p.process_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={styles.detailLabel}>Примечание</label>
                <textarea
                  value={stepForm.notes}
                  onChange={(e) => setStepForm((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{ ...styles.input, minHeight: 64, width: "100%" }}
                  disabled={!canEditSteps}
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  style={{
                    ...styles.primaryButton,
                    opacity: isStepControlsReadOnly ? 0.55 : 1,
                    cursor: isStepControlsReadOnly
                      ? "not-allowed"
                      : saveStepState.saving
                        ? "wait"
                        : "pointer",
                  }}
                  onClick={handleSaveStep}
                  disabled={!canEditSteps || saveStepState.saving}
                >
                  {saveStepState.saving ? "Сохранение..." : "Сохранить шаг"}
                </button>
              </div>

              {saveStepState.success && (
                <p style={styles.successText}>{saveStepState.success}</p>
              )}
              {saveStepState.error && <p style={styles.error}>{saveStepState.error}</p>}
            </>
          )}
        </div>
      </div>
    </>
  );
};

function EditableField({ label, value, onChange }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </div>
  );
}

function EditableToggle({ label, value, onChange }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <label style={styles.toggleLabel}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          style={styles.checkbox}
        />
        {value ? "Активен" : "Неактивен"}
      </label>
    </div>
  );
}

export default RoutesSection;
