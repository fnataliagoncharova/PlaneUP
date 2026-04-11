import { useEffect, useState, useRef } from "react";
import {
  Box,
  Layers,
  Route,
  BarChart3,
  ClipboardList,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function App() {
  const UNIT_OPTIONS = ["м²", "м"];
  const [collapsed, setCollapsed] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [activeTab, setActiveTab] = useState("Main");
  const [relations, setRelations] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationsError, setRelationsError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState({
    product_name: "",
    unit_of_measure: "",
    is_active: true,
  });
  const [saveState, setSaveState] = useState({
    saving: false,
    success: "",
    error: "",
  });
  const [importState, setImportState] = useState({
    importing: false,
    summary: null,
    error: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.title = "Номенклатура готовой продукции";
  }, []);

  const loadProducts = async (preferCode = null) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:8000/products");
      if (!response.ok) {
        throw new Error("Ошибка загрузки продукции");
      }
      const data = await response.json();
      setProducts(data);
      if (data.length > 0) {
        const preferred = preferCode
          ? data.find((p) => p.product_code === preferCode)
          : null;
        setSelectedProductId(
          preferred ? preferred.product_id : data[0].product_id
        );
      } else {
        setSelectedProductId(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const query = search.toLowerCase();
    return (
      product.product_code.toLowerCase().includes(query) ||
      product.product_name.toLowerCase().includes(query)
    );
  });

  // Keep selection consistent with filtered list
  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSelectedProductId(null);
      return;
    }
    const stillVisible = filteredProducts.some(
      (p) => p.product_id === selectedProductId
    );
    if (!stillVisible) {
      setSelectedProductId(filteredProducts[0].product_id);
    }
  }, [filteredProducts, selectedProductId]);

  const selectedProduct =
    products.find((p) => p.product_id === selectedProductId) || null;

  const normalizeUnit = (unit) =>
    UNIT_OPTIONS.includes(unit) ? unit : UNIT_OPTIONS[0];

  // Sync form values with selected product
  useEffect(() => {
    if (!selectedProduct) {
      setIsEditing(false);
      return;
    }
    setFormValues({
      product_name: selectedProduct.product_name,
      unit_of_measure: normalizeUnit(selectedProduct.unit_of_measure),
      is_active: selectedProduct.is_active,
    });
    setIsEditing(false);
    setSaveState({ saving: false, success: "", error: "" });
  }, [selectedProduct]);

  // Load relations when Relations tab is active and product selected
  useEffect(() => {
    if (activeTab !== "Relations" || !selectedProduct) {
      return;
    }
    setRelationsLoading(true);
    setRelationsError("");
    setRelations([]);
    fetch(
      `http://127.0.0.1:8000/products/${selectedProduct.product_code}/structure`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Ошибка загрузки связей продукта");
        }
        return response.json();
      })
      .then((data) => {
        setRelations(data.components || []);
        setRelationsLoading(false);
      })
      .catch((err) => {
        setRelationsError(err.message);
        setRelationsLoading(false);
      });
  }, [activeTab, selectedProduct]);

  return (
    <div style={styles.app}>
      <aside
        style={{
          ...styles.sidebar,
          width: collapsed ? "80px" : "260px",
        }}
      >
        <div style={styles.collapseBtn}>
          <button onClick={() => setCollapsed(!collapsed)} style={styles.btn}>
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        {!collapsed && <div style={styles.logo}>ПланПро</div>}

        <div style={styles.menu}>
          <MenuItem icon={<Box />} label="Продукция" collapsed={collapsed} active />
          <MenuItem icon={<Layers />} label="Полуфабрикаты" collapsed={collapsed} />
          <MenuItem icon={<Route />} label="Маршруты" collapsed={collapsed} />
          <MenuItem icon={<BarChart3 />} label="План продаж" collapsed={collapsed} />
          <MenuItem icon={<ClipboardList />} label="Задания" collapsed={collapsed} />
          <MenuItem icon={<CheckCircle />} label="Факт" collapsed={collapsed} />
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>Продукция</h1>
          <div style={styles.headerRight}>
            <div style={styles.searchBar}>
              <input
                type="text"
                placeholder="Поиск по коду или названию продукции"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <div style={styles.headerActions}>
              <button
                style={styles.secondaryButton}
                onClick={async () => {
                  try {
                    const resp = await fetch(
                      "http://127.0.0.1:8000/products/import-template"
                    );
                    if (!resp.ok) throw new Error("Ошибка скачивания шаблона");
                    const blob = await resp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "products_import_template.xlsx";
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
                      "http://127.0.0.1:8000/products/import",
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
                    setImportState({
                      importing: false,
                      summary: data,
                      error: "",
                    });
                    await loadProducts(
                      selectedProduct ? selectedProduct.product_code : null
                    );
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
              {importState.summary.updated_count}, ошибок {importState.summary.error_count}.
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
            {loading && <p>Загрузка продукции...</p>}
            {error && <p style={styles.error}>{error}</p>}

            {!loading && !error && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Код продукта</th>
                    <th style={styles.th}>Наименование</th>
                    <th style={styles.th}>Ед. изм.</th>
                    <th style={styles.th}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isSelected = product.product_id === selectedProductId;
                    return (
                      <tr
                        key={product.product_id}
                        style={{
                          ...styles.row,
                          ...(isSelected ? styles.rowSelected : {}),
                        }}
                        onClick={() => setSelectedProductId(product.product_id)}
                      >
                        <td style={styles.td}>{product.product_code}</td>
                        <td style={styles.td}>{product.product_name}</td>
                        <td style={styles.td}>{product.unit_of_measure}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              ...(product.is_active
                                ? styles.badgeActive
                                : styles.badgeInactive),
                            }}
                          >
                            {product.is_active ? "Активна" : "Неактивна"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={styles.detailCard}>
            {!selectedProduct && (
              <p style={{ color: "#6d7b98" }}>Нет выбранной позиции</p>
            )}
            {selectedProduct && (
              <>
                <div style={styles.detailHeader}>
                  <h2 style={styles.detailTitle}>Карточка продукта</h2>
                  <span
                    style={{
                      ...styles.badge,
                      ...(selectedProduct.is_active
                        ? styles.badgeActive
                        : styles.badgeInactive),
                    }}
                  >
                    {selectedProduct.is_active ? "Активна" : "Неактивна"}
                  </span>
                </div>

                <div style={styles.tabs}>
                  {["Main", "Relations"].map((tab) => (
                    <button
                      key={tab}
                      style={{
                        ...styles.tabButton,
                        ...(activeTab === tab ? styles.tabButtonActive : {}),
                      }}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === "Main" && (
                  <div style={styles.detailBody}>
                    <div style={styles.mainHeader}>
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
                            onClick={async () => {
                              if (!selectedProduct) return;

                              const payload = {};
                              if (
                                formValues.product_name !==
                                selectedProduct.product_name
                              ) {
                                payload.product_name = formValues.product_name;
                              }
                              if (
                                formValues.unit_of_measure !==
                                  selectedProduct.unit_of_measure ||
                                !UNIT_OPTIONS.includes(
                                  selectedProduct.unit_of_measure
                                )
                              ) {
                                payload.unit_of_measure = formValues.unit_of_measure;
                              }
                              if (
                                formValues.is_active !== selectedProduct.is_active
                              ) {
                                payload.is_active = formValues.is_active;
                              }

                              if (Object.keys(payload).length === 0) {
                                setIsEditing(false);
                                setSaveState({
                                  saving: false,
                                  success: "Нет изменений",
                                  error: "",
                                });
                                return;
                              }

                              setSaveState({ saving: true, success: "", error: "" });
                              try {
                                const resp = await fetch(
                                  `http://127.0.0.1:8000/products/${selectedProduct.product_code}`,
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

                                // Update list and selection
                                setProducts((prev) =>
                                  prev.map((p) =>
                                    p.product_id === selectedProduct.product_id
                                      ? { ...p, ...data }
                                      : p
                                  )
                                );

                                setSaveState({
                                  saving: false,
                                  success: "Сохранено",
                                  error: "",
                                });
                                setIsEditing(false);
                              } catch (e) {
                                setSaveState({
                                  saving: false,
                                  success: "",
                                  error: e.message || "Ошибка сохранения",
                                });
                              }
                            }}
                            disabled={saveState.saving}
                          >
                            {saveState.saving ? "Сохранение..." : "Сохранить"}
                          </button>
                          <button
                            style={styles.secondaryButton}
                            onClick={() => {
                              if (!selectedProduct) return;
                              setFormValues({
                                product_name: selectedProduct.product_name,
                                unit_of_measure: selectedProduct.unit_of_measure,
                                is_active: selectedProduct.is_active,
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

                    <div
                      style={{
                        ...styles.editablePanel,
                        ...(isEditing ? styles.editablePanelActive : {}),
                      }}
                    >
                      <DetailField
                        label="Код продукта"
                        value={selectedProduct.product_code}
                      />

                      {!isEditing && (
                        <>
                          <DetailField
                            label="Наименование"
                            value={selectedProduct.product_name}
                          />
                          <DetailField
                            label="Ед. изм."
                            value={selectedProduct.unit_of_measure}
                          />
                          <DetailField
                            label="Статус"
                            value={selectedProduct.is_active ? "Активен" : "Неактивен"}
                          />
                        </>
                      )}

                      {isEditing && (
                        <>
                          <EditableField
                            label="Наименование"
                            value={formValues.product_name}
                            onChange={(val) =>
                              setFormValues((v) => ({ ...v, product_name: val }))
                            }
                          />
                          <EditableSelect
                            label="Ед. изм."
                            value={formValues.unit_of_measure}
                            options={UNIT_OPTIONS}
                            onChange={(val) =>
                              setFormValues((v) => ({
                                ...v,
                                unit_of_measure: val,
                              }))
                            }
                          />
                          <EditableToggle
                            label="Статус"
                            checked={formValues.is_active}
                            onChange={(checked) =>
                              setFormValues((v) => ({ ...v, is_active: checked }))
                            }
                          />
                        </>
                      )}
                    </div>

                    {saveState.success && (
                      <p style={styles.successText}>{saveState.success}</p>
                    )}
                    {saveState.error && (
                      <p style={styles.error}>{saveState.error}</p>
                    )}
                  </div>
                )}

                {activeTab === "Relations" && (
                  <div style={styles.relationsBody}>
                    {relationsLoading && (
                      <p style={{ color: "#6d7b98" }}>Загрузка связей...</p>
                    )}
                    {relationsError && (
                      <p style={styles.error}>{relationsError}</p>
                    )}
                    {!relationsLoading &&
                      !relationsError &&
                      relations.length === 0 && (
                        <p style={{ color: "#6d7b98" }}>
                          Нет связанных компонентов для этого продукта
                        </p>
                      )}
                    {!relationsLoading &&
                      !relationsError &&
                      relations.length > 0 && (
                        <table style={styles.relationsTable}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Код полуфабриката</th>
                              <th style={styles.th}>Название</th>
                              <th style={styles.th}>Кол-во</th>
                              <th style={styles.th}>Маршрут</th>
                              <th style={styles.th}>Название маршрута</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relations.map((item, idx) => (
                              <tr key={`${item.semi_finished_code}-${idx}`}>
                                <td style={styles.td}>
                                  {item.semi_finished_code}
                                </td>
                                <td style={styles.td}>
                                  {item.semi_finished_name}
                                </td>
                                <td style={styles.td}>{item.component_qty}</td>
                                <td style={styles.td}>{item.route_code}</td>
                                <td style={styles.td}>{item.route_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

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

function EditableToggle({ label, checked, onChange }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <label style={styles.toggleLabel}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={styles.checkbox}
        />
        <span>{checked ? "Активен" : "Неактивен"}</span>
      </label>
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

function MenuItem({ icon, label, collapsed, active }) {
  return (
    <div
      title={collapsed ? label : ""}
      style={{
        ...styles.menuItem,
        ...(active ? styles.activeItem : {}),
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      {icon}
      {!collapsed && <span style={{ marginLeft: "12px" }}>{label}</span>}
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    minHeight: "100vh",
    background: "#f4f6fb",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    background: "#0d224f",
    color: "white",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    transition: "0.3s",
  },
  collapseBtn: {
    display: "flex",
    justifyContent: "flex-end",
  },
  btn: {
    background: "transparent",
    border: "none",
    color: "white",
    cursor: "pointer",
  },
  logo: {
    fontSize: "24px",
    fontWeight: "700",
    margin: "20px 0",
  },
  menu: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    borderRadius: "10px",
    cursor: "pointer",
  },
  activeItem: {
    background: "#1a366f",
  },
  main: {
    flex: 1,
    padding: "30px",
  },
  contentSplit: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr",
    gap: "18px",
    alignItems: "start",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    width: "100%",
    maxWidth: "720px",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  title: {
    marginBottom: "8px",
    color: "#11224d",
    fontSize: "44px",
    lineHeight: "110%",
  },
  searchBar: {
    marginBottom: 0,
    minWidth: "260px",
    flex: "0 1 360px",
  },
  searchInput: {
    width: "100%",
    maxWidth: "420px",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #d9dfeb",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#11224d",
  },
  card: {
    background: "white",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #dfe5f0",
    color: "#11224d",
    fontSize: "14px",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #eef2f7",
    color: "#33415c",
    fontSize: "14px",
  },
  row: {
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s",
  },
  rowSelected: {
    background: "#eef3ff",
    boxShadow: "inset 2px 0 0 #1a366f",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.02em",
  },
  badgeActive: {
    background: "#e7f6ec",
    color: "#1f7a39",
    border: "1px solid #c7e8d0",
  },
  badgeInactive: {
    background: "#f9eded",
    color: "#a12d2d",
    border: "1px solid #edcfcf",
  },
  primaryButton: {
    background: "#11224d",
    color: "white",
    border: "1px solid #11224d",
    borderRadius: "10px",
    padding: "10px 16px",
    fontWeight: 700,
  },
  secondaryButton: {
    background: "white",
    color: "#11224d",
    border: "1px solid #dfe5f0",
    borderRadius: "10px",
    padding: "10px 16px",
    fontWeight: 600,
  },
  primaryGhostButton: {
    background: "white",
    color: "#11224d",
    border: "1px solid #dfe5f0",
    borderRadius: "10px",
    padding: "8px 14px",
    fontWeight: 600,
  },
  mainHeader: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "8px",
  },
  editActions: {
    display: "flex",
    gap: "8px",
  },
  editablePanel: {
    border: "1px solid #eef2f7",
    borderRadius: "12px",
    padding: "14px",
    background: "#fafbfe",
  },
  editablePanelActive: {
    borderColor: "#c9d6ff",
    boxShadow: "0 0 0 2px rgba(17,34,77,0.08)",
  },
  detailCard: {
    background: "white",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    minHeight: "200px",
  },
  detailHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },
  detailTitle: {
    margin: 0,
    color: "#11224d",
    fontSize: "18px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  tabButton: {
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid #dfe5f0",
    background: "#f7f9fb",
    color: "#11224d",
    cursor: "pointer",
    fontWeight: 600,
  },
  tabButtonActive: {
    background: "#11224d",
    color: "white",
    borderColor: "#11224d",
  },
  detailBody: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  detailField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  detailLabel: {
    fontSize: "12px",
    color: "#6d7b98",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  detailValue: {
    fontSize: "15px",
    color: "#11224d",
    fontWeight: 600,
  },
  input: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #dfe5f0",
    fontSize: "14px",
    color: "#11224d",
    background: "white",
  },
  toggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#11224d",
  },
  checkbox: {
    width: "16px",
    height: "16px",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #dfe5f0",
    fontSize: "14px",
    color: "#11224d",
    background: "white",
  },
  relationsBody: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  relationsTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  successText: {
    color: "#1f7a39",
    fontWeight: 600,
    marginTop: "6px",
  },
  importResult: {
    background: "#f5fbf6",
    border: "1px solid #cde9d4",
    color: "#1f7a39",
    padding: "12px 14px",
    borderRadius: "10px",
    marginBottom: "12px",
    fontSize: "14px",
  },
  importResultError: {
    background: "#fdf3f0",
    border: "1px solid #f2c8bc",
    color: "#a12d2d",
    padding: "12px 14px",
    borderRadius: "10px",
    marginBottom: "12px",
    fontSize: "14px",
  },
  errorList: {
    margin: "8px 0 0",
    paddingLeft: "18px",
    color: "#a12d2d",
  },
  error: {
    color: "crimson",
  },
};

export default App;
