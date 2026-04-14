import { useEffect, useState, useCallback, useRef } from "react";
import DetailField from "../components/DetailField";
import { styles } from "../styles";

const UNIT_OPTIONS = ["м²", "м.п."];

const SemiFinishedSection = () => {
  const [semiFinished, setSemiFinished] = useState([]);
  const [semiLoading, setSemiLoading] = useState(false);
  const [semiError, setSemiError] = useState("");
  const [semiSearch, setSemiSearch] = useState("");
  const [selectedSemiId, setSelectedSemiId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState({
    semi_finished_name: "",
    unit_of_measure: "",
    degas_days: 0,
    is_active: true,
  });
  const [importState, setImportState] = useState({
    importing: false,
    summary: null,
    error: "",
  });
  const fileInputRef = useRef(null);
  const [saveState, setSaveState] = useState({
    saving: false,
    success: "",
    error: "",
  });

  const normalizeUnit = useCallback(
    (unit) => (UNIT_OPTIONS.includes(unit) ? unit : UNIT_OPTIONS[0]),
    []
  );

  const loadSemiFinished = async () => {
    setSemiLoading(true);
    setSemiError("");
    try {
      const response = await fetch("http://127.0.0.1:8000/semi-finished");
      if (!response.ok) {
        throw new Error("Ошибка загрузки полуфабрикатов");
      }
      const data = await response.json();
      setSemiFinished(data);
      if (data.length > 0) {
        setSelectedSemiId(data[0].semi_finished_id);
      } else {
        setSelectedSemiId(null);
      }
    } catch (err) {
      setSemiError(err.message || "Ошибка загрузки полуфабрикатов");
    } finally {
      setSemiLoading(false);
    }
  };

  useEffect(() => {
    loadSemiFinished();
  }, []);

  const filteredSemiFinished = semiFinished.filter((item) => {
    const query = semiSearch.toLowerCase();
    const code = (item.semi_finished_code ?? "").toString().toLowerCase();
    const name = (item.semi_finished_name ?? "").toLowerCase();
    return code.includes(query) || name.includes(query);
  });

  useEffect(() => {
    if (filteredSemiFinished.length === 0) {
      setSelectedSemiId(null);
      return;
    }
    const stillVisible = filteredSemiFinished.some(
      (item) => item.semi_finished_id === selectedSemiId
    );
    if (!stillVisible) {
      setSelectedSemiId(filteredSemiFinished[0].semi_finished_id);
    }
  }, [filteredSemiFinished, selectedSemiId]);

  const selectedSemi =
    semiFinished.find((item) => item.semi_finished_id === selectedSemiId) ||
    null;

  // синхронизируем форму с выбранным элементом
  useEffect(() => {
    if (!selectedSemi) {
      setIsEditing(false);
      return;
    }
    setFormValues({
      semi_finished_name: selectedSemi.semi_finished_name,
      unit_of_measure: normalizeUnit(selectedSemi.unit_of_measure || ""),
       degas_days:
         typeof selectedSemi.degas_days === "number"
           ? selectedSemi.degas_days
           : Number(selectedSemi.degas_days) || 0,
       is_active: selectedSemi.is_active ?? true,
    });
    setIsEditing(false);
    setSaveState({ saving: false, success: "", error: "" });
  }, [selectedSemi, normalizeUnit]);

  const handleSave = async () => {
    if (!selectedSemi) return;
    const payload = {};
    if (formValues.semi_finished_name !== selectedSemi.semi_finished_name) {
      payload.semi_finished_name = formValues.semi_finished_name;
    }
    if (
      formValues.unit_of_measure !== selectedSemi.unit_of_measure ||
      !UNIT_OPTIONS.includes(selectedSemi.unit_of_measure || "")
    ) {
      payload.unit_of_measure = formValues.unit_of_measure;
    }
    const degasVal = Number(formValues.degas_days);
    if (Number.isNaN(degasVal) || degasVal < 0) {
      setSaveState({
        saving: false,
        success: "",
        error: "Дегазация должна быть неотрицательным числом",
      });
      return;
    }
    if (degasVal !== Number(selectedSemi.degas_days || 0)) {
      payload.degas_days = degasVal;
    }
    if (
      typeof formValues.is_active === "boolean" &&
      formValues.is_active !== !!selectedSemi.is_active
    ) {
      payload.is_active = formValues.is_active;
    }

    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      setSaveState({ saving: false, success: "Нет изменений", error: "" });
      return;
    }

    setSaveState({ saving: true, success: "", error: "" });
    try {
      const resp = await fetch(
        `http://127.0.0.1:8000/semi-finished/${selectedSemi.semi_finished_code}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Ошибка сохранения");
      }
      const data = await resp.json();
      setSemiFinished((prev) =>
        prev.map((item) =>
          item.semi_finished_id === selectedSemi.semi_finished_id
            ? { ...item, ...data }
            : item
        )
      );
      setSaveState({ saving: false, success: "Сохранено", error: "" });
      setIsEditing(false);
    } catch (e) {
      setSaveState({
        saving: false,
        success: "",
        error: e.message || "Ошибка сохранения",
      });
    }
  };

  return (
    <>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Полуфабрикаты</h1>
        <div style={styles.headerRight}>
          <div style={styles.searchBar}>
            <input
              type="text"
              placeholder="Поиск по коду или названию"
              value={semiSearch}
              onChange={(e) => setSemiSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={styles.headerActions}>
            <button
              style={styles.secondaryButton}
              onClick={async () => {
                try {
                  const resp = await fetch(
                    "http://127.0.0.1:8000/semi-finished/import-template"
                  );
                  if (!resp.ok) throw new Error("Ошибка скачивания шаблона");
                  const blob = await resp.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "semi_finished_import_template.xlsx";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (e) {
                  alert(e.message || "Ошибка скачивания шаблона");
                }
              }}
            >
              Скачать шаблон
            </button>
            <button
              style={styles.primaryButton}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={importState.importing}
            >
              {importState.importing ? "Импорт..." : "Импорт"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportState({ importing: true, summary: null, error: "" });
                const formData = new FormData();
                formData.append("file", file);
                try {
                  const resp = await fetch(
                    "http://127.0.0.1:8000/semi-finished/import",
                    {
                      method: "POST",
                      body: formData,
                    }
                  );
                  if (!resp.ok) {
                    const txt = await resp.text();
                    throw new Error(txt || "Ошибка импорта");
                  }
                  const data = await resp.json();
                  setImportState({ importing: false, summary: data, error: "" });
                  await loadSemiFinished();
                } catch (err) {
                  setImportState({
                    importing: false,
                    summary: null,
                    error: err.message || "Ошибка импорта",
                  });
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>
      </div>

      {importState.summary && (
        <div style={styles.importResult}>
          <div>
            Импорт завершён: создано {importState.summary.created_count}, обновлено{" "}
            {importState.summary.updated_count}, ошибок{" "}
            {importState.summary.error_count}.
          </div>
          {importState.summary.errors?.length > 0 && (
            <ul style={styles.errorList}>
              {importState.summary.errors.map((err) => (
                <li key={err.row} style={styles.error}>
                  Строка {err.row}: {err.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {importState.error && (
        <div style={styles.importResultError}>{importState.error}</div>
      )}

      <div style={styles.contentSplit}>
        <div style={styles.card}>
          {semiLoading && <p>Загрузка полуфабрикатов...</p>}
          {semiError && <p style={styles.error}>{semiError}</p>}
          {!semiLoading && !semiError && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Код</th>
                  <th style={styles.th}>Наименование</th>
                  <th style={styles.th}>Дегазация, дни</th>
                  <th style={styles.th}>Ед. изм.</th>
                  <th style={styles.th}>Активность</th>
                </tr>
              </thead>
              <tbody>
                {filteredSemiFinished.map((item) => {
                  const isSelected = item.semi_finished_id === selectedSemiId;
                  return (
                    <tr
                      key={item.semi_finished_id}
                      style={{
                        ...styles.row,
                        ...(isSelected ? styles.rowSelected : {}),
                      }}
                      onClick={() => setSelectedSemiId(item.semi_finished_id)}
                    >
                      <td style={styles.td}>{item.semi_finished_code}</td>
                      <td style={styles.td}>{item.semi_finished_name}</td>
                      <td style={styles.td}>
                        {item.degas_days === 0
                          ? "0"
                          : item.degas_days ?? "—"}
                      </td>
                      <td style={styles.td}>
                        {UNIT_OPTIONS.includes(item.unit_of_measure || "")
                          ? item.unit_of_measure
                          : "—"}
                      </td>
                      <td style={styles.td}>
                        {item.is_active ? "Да" : "Нет"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.detailCard}>
          {!selectedSemi && !semiLoading && (
            <p style={{ color: "#6d7b98" }}>Нет выбранного полуфабриката</p>
          )}
          {selectedSemi && (
            <>
              <div style={styles.detailHeader}>
                <h2 style={styles.detailTitle}>Карточка полуфабриката</h2>
                {!isEditing && (
                  <button
                    style={styles.primaryGhostButton}
                    onClick={() => {
                      setIsEditing(true);
                      setSaveState({ saving: false, success: "", error: "" });
                    }}
                  >
                    Редактировать
                  </button>
                )}
                {isEditing && (
                  <div style={styles.editActions}>
                    <button
                      style={{
                        ...styles.primaryButton,
                        opacity: saveState.saving ? 0.7 : 1,
                        cursor: saveState.saving ? "wait" : "pointer",
                      }}
                      onClick={handleSave}
                      disabled={saveState.saving}
                    >
                      {saveState.saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => {
                        if (!selectedSemi) return;
                        setFormValues({
                          semi_finished_name: selectedSemi.semi_finished_name,
                          unit_of_measure: normalizeUnit(
                            selectedSemi.unit_of_measure || ""
                          ),
                        });
                        setIsEditing(false);
                        setSaveState({ saving: false, success: "", error: "" });
                      }}
                    >
                      Отменить
                    </button>
                  </div>
                )}
              </div>
              <div style={styles.detailBody}>
                <DetailField label="Code" value={selectedSemi.semi_finished_code} />
                {!isEditing && (
                  <>
                    <DetailField label="Name" value={selectedSemi.semi_finished_name} />
                    <DetailField
                      label="Ед. изм."
                      value={
                        UNIT_OPTIONS.includes(selectedSemi.unit_of_measure || "")
                          ? selectedSemi.unit_of_measure
                          : "—"
                      }
                    />
                    <DetailField
                      label="Активность"
                      value={selectedSemi.is_active ? "Активен" : "Неактивен"}
                    />
                    <DetailField
                      label="Дегазация, дней"
                      value={
                        selectedSemi.degas_days === 0
                          ? "0"
                          : selectedSemi.degas_days ?? "—"
                      }
                    />
                  </>
                )}
                {isEditing && (
                  <>
                    <EditableField
                      label="Name"
                      value={formValues.semi_finished_name}
                      onChange={(val) =>
                        setFormValues((v) => ({ ...v, semi_finished_name: val }))
                      }
                    />
                    <EditableSelect
                      label="Ед. изм."
                      value={formValues.unit_of_measure}
                      options={UNIT_OPTIONS}
                      onChange={(val) =>
                        setFormValues((v) => ({ ...v, unit_of_measure: val }))
                      }
                    />
                    <EditableNumber
                      label="Дегазация, дней"
                      value={formValues.degas_days}
                      onChange={(val) =>
                        setFormValues((v) => ({ ...v, degas_days: val }))
                      }
                      min={0}
                    />
                    <EditableToggle
                      label="Активность"
                      value={formValues.is_active}
                      onChange={(val) =>
                        setFormValues((v) => ({ ...v, is_active: val }))
                      }
                    />
                  </>
                )}
              </div>
              {saveState.success && (
                <p style={styles.successText}>{saveState.success}</p>
              )}
              {saveState.error && <p style={styles.error}>{saveState.error}</p>}
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

function EditableSelect({ label, value, options, onChange }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function EditableNumber({ label, value, onChange, min = 0 }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <input
        type="number"
        min={min}
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

export default SemiFinishedSection;


