import { useEffect, useState, useCallback } from "react";
import DetailField from "../components/DetailField";
import { styles } from "../styles";

const ProcessesSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState({
    process_code: "",
    process_name: "",
    is_active: true,
  });
  const [saveState, setSaveState] = useState({
    saving: false,
    success: "",
    error: "",
  });

  const isNew = selectedId === "__new__";

  const loadProcesses = useCallback(async (keepSelectedCode = null) => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("http://127.0.0.1:8000/processes");
      if (!resp.ok) throw new Error("Ошибка загрузки переделов");
      const data = await resp.json();
      setItems(data);
      if (data.length === 0) {
        setSelectedId(null);
      } else if (keepSelectedCode) {
        const found = data.find((p) => p.process_code === keepSelectedCode);
        setSelectedId(found ? found.process_id : data[0].process_id);
      } else {
        setSelectedId(data[0].process_id);
      }
    } catch (e) {
      setError(e.message || "Ошибка загрузки переделов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  // keep selection within filtered list
  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.process_code.toLowerCase().includes(q) ||
      p.process_name.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillThere = filtered.some((p) => p.process_id === selectedId);
    if (!stillThere) setSelectedId(filtered[0].process_id);
  }, [filtered, selectedId]);

  const selected =
    items.find((p) => p.process_id === selectedId) || (isNew ? formValues : null);

  useEffect(() => {
    if (!selected) {
      setIsEditing(false);
      return;
    }
    setFormValues({
      process_code: selected.process_code || "",
      process_name: selected.process_name || "",
      is_active: selected.is_active ?? true,
    });
    setIsEditing(isNew ? true : false);
    setSaveState({ saving: false, success: "", error: "" });
  }, [selected, isNew]);

  const handleAdd = () => {
    const temp = {
      process_id: "__new__",
      process_code: "",
      process_name: "",
      is_active: true,
    };
    setItems((prev) => [temp, ...prev.filter((p) => p.process_id !== "__new__")]);
    setSelectedId("__new__");
    setIsEditing(true);
    setSaveState({ saving: false, success: "", error: "" });
    setFormValues({
      process_code: "",
      process_name: "",
      is_active: true,
    });
  };

  const handleCancel = () => {
    if (isNew) {
      setItems((prev) => prev.filter((p) => p.process_id !== "__new__"));
      if (items.length > 1) {
        setSelectedId(items[1].process_id);
      } else {
        setSelectedId(null);
      }
    }
    if (selected) {
      setFormValues({
        process_code: selected.process_code || "",
        process_name: selected.process_name || "",
        is_active: selected.is_active ?? true,
      });
    }
    setIsEditing(false);
    setSaveState({ saving: false, success: "", error: "" });
  };

  const handleSave = async () => {
    const code = formValues.process_code.trim();
    const name = formValues.process_name.trim();
    if (!code) {
      setSaveState({ saving: false, success: "", error: "Код обязателен" });
      return;
    }
    if (!name) {
      setSaveState({ saving: false, success: "", error: "Наименование обязательно" });
      return;
    }

    const payload = {
      process_code: code,
      process_name: name,
      is_active: !!formValues.is_active,
    };

    setSaveState({ saving: true, success: "", error: "" });

    try {
      let resp;
      if (isNew) {
        resp = await fetch("http://127.0.0.1:8000/processes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const delta = {};
        if (code !== selected.process_code) delta.process_code = code;
        if (name !== selected.process_name) delta.process_name = name;
        if (!!formValues.is_active !== !!selected.is_active) {
          delta.is_active = !!formValues.is_active;
        }
        if (Object.keys(delta).length === 0) {
          setIsEditing(false);
          setSaveState({ saving: false, success: "Нет изменений", error: "" });
          return;
        }
        resp = await fetch(
          `http://127.0.0.1:8000/processes/${selected.process_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(delta),
          }
        );
      }

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Ошибка сохранения");
      }
      const data = await resp.json();
      if (isNew) {
        setItems((prev) =>
          [data, ...prev.filter((p) => p.process_id !== "__new__")]
        );
        setSelectedId(data.process_id);
      } else {
        setItems((prev) =>
          prev.map((p) =>
            p.process_id === selected.process_id ? { ...p, ...data } : p
          )
        );
      }
      setIsEditing(false);
      setSaveState({ saving: false, success: "Сохранено", error: "" });
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
        <h1 style={styles.title}>Переделы</h1>
        <div style={styles.headerRight}>
          <div style={styles.searchBar}>
            <input
              type="text"
              placeholder="Поиск по коду или названию"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={styles.headerActions}>
            <button style={styles.primaryButton} onClick={handleAdd}>
              + Добавить
            </button>
          </div>
        </div>
      </div>

      <div style={styles.contentSplit}>
        <div style={styles.card}>
          {loading && <p>Загрузка...</p>}
          {error && <p style={styles.error}>{error}</p>}
          {!loading && !error && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Код</th>
                  <th style={styles.th}>Наименование</th>
                  <th style={styles.th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isSelected = item.process_id === selectedId;
                  return (
                    <tr
                      key={item.process_id}
                      style={{
                        ...styles.row,
                        ...(isSelected ? styles.rowSelected : {}),
                      }}
                      onClick={() => {
                        setSelectedId(item.process_id);
                        setIsEditing(false);
                        setSaveState({ saving: false, success: "", error: "" });
                      }}
                    >
                      <td style={styles.td}>{item.process_code}</td>
                      <td style={styles.td}>{item.process_name}</td>
                      <td style={styles.td}>{item.is_active ? "Активен" : "Неактивен"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.detailCard}>
          {!selected && !loading && (
            <p style={{ color: "#6d7b98" }}>Нет выбранного передела</p>
          )}
          {selected && (
            <>
              <div style={styles.detailHeader}>
                <h2 style={styles.detailTitle}>Карточка передела</h2>
                {!isEditing && (
                  <button
                    style={styles.primaryGhostButton}
                    onClick={() => setIsEditing(true)}
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
                    <button style={styles.secondaryButton} onClick={handleCancel}>
                      Отменить
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.detailBody}>
                {!isEditing && (
                  <>
                    <DetailField label="Code" value={selected.process_code} />
                    <DetailField label="Name" value={selected.process_name} />
                    <DetailField
                      label="Статус"
                      value={selected.is_active ? "Активен" : "Неактивен"}
                    />
                  </>
                )}

                {isEditing && (
                  <>
                    <EditableField
                      label="Code"
                      value={formValues.process_code}
                      onChange={(val) =>
                        setFormValues((v) => ({ ...v, process_code: val }))
                      }
                    />
                    <EditableField
                      label="Name"
                      value={formValues.process_name}
                      onChange={(val) =>
                        setFormValues((v) => ({ ...v, process_name: val }))
                      }
                    />
                    <EditableToggle
                      label="Статус"
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

export default ProcessesSection;
