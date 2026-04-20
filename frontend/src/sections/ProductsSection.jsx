import { useCallback, useEffect, useRef, useState } from "react";
import DetailField from "../components/DetailField";
import { styles } from "../styles";
import { apiUrl } from "../config/api";

const UNIT_OPTIONS = ["м²", "м.п."];
const PRODUCT_TABS = [
  { value: "Main", label: "Основное" },
  { value: "Relations", label: "Технология" },
];

const createEmptyRelationForm = () => ({
  semi_finished_id: "",
  route_id: "",
  component_qty: "1",
  product_qty: "1",
  priority: "1",
  valid_from: "",
  valid_to: "",
  active: true,
});

const relationToForm = (relation) => ({
  semi_finished_id: relation?.semi_finished_id
    ? String(relation.semi_finished_id)
    : "",
  route_id: relation?.route_id ? String(relation.route_id) : "",
  component_qty:
    relation?.component_qty !== undefined && relation?.component_qty !== null
      ? String(relation.component_qty)
      : "1",
  product_qty:
    relation?.product_qty !== undefined && relation?.product_qty !== null
      ? String(relation.product_qty)
      : "1",
  priority:
    relation?.priority !== undefined && relation?.priority !== null
      ? String(relation.priority)
      : "1",
  valid_from: relation?.valid_from || "",
  valid_to: relation?.valid_to || "",
  active: relation?.active ?? true,
});

async function getErrorMessage(response, fallbackMessage) {
  try {
    const data = await response.clone().json();
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // no-op
  }

  try {
    const text = await response.text();
    if (text?.trim()) {
      return text;
    }
  } catch {
    // no-op
  }

  return fallbackMessage;
}

const ProductsSection = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [activeTab, setActiveTab] = useState("Main");
  const [relations, setRelations] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationsError, setRelationsError] = useState("");
  const [relationLookups, setRelationLookups] = useState({
    semiFinished: [],
    routes: [],
  });
  const [relationLookupsLoading, setRelationLookupsLoading] = useState(false);
  const [relationLookupsError, setRelationLookupsError] = useState("");
  const [selectedRelationId, setSelectedRelationId] = useState(null);
  const [relationMode, setRelationMode] = useState("new");
  const [relationFormValues, setRelationFormValues] = useState(
    createEmptyRelationForm()
  );
  const [relationActionState, setRelationActionState] = useState({
    saving: false,
    deleting: false,
    success: "",
    error: "",
  });
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

  const normalizeUnit = useCallback(
    (unit) => (UNIT_OPTIONS.includes(unit) ? unit : UNIT_OPTIONS[0]),
    []
  );

  const loadProducts = useCallback(
    async (preferCode = null) => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(apiUrl("/products"));
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
    },
    []
  );

  const loadRelationLookups = useCallback(async () => {
    setRelationLookupsLoading(true);
    setRelationLookupsError("");
    try {
      const [semiResponse, routesResponse] = await Promise.all([
        fetch(apiUrl("/semi-finished")),
        fetch(apiUrl("/routes")),
      ]);

      if (!semiResponse.ok) {
        throw new Error("Ошибка загрузки справочника полуфабрикатов");
      }
      if (!routesResponse.ok) {
        throw new Error("Ошибка загрузки справочника маршрутов");
      }

      const [semiFinished, routes] = await Promise.all([
        semiResponse.json(),
        routesResponse.json(),
      ]);

      setRelationLookups({ semiFinished, routes });
    } catch (err) {
      setRelationLookupsError(
        err.message || "Ошибка загрузки справочников технологии"
      );
    } finally {
      setRelationLookupsLoading(false);
    }
  }, []);

  const loadRelations = useCallback(async (productCode, preferredRelationId) => {
    setRelationsLoading(true);
    setRelationsError("");
    try {
      const response = await fetch(apiUrl(`/products/${productCode}/components`));
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Ошибка загрузки связей продукта")
        );
      }

      const data = await response.json();
      const nextRelations = data.components || [];
      setRelations(nextRelations);

      if (nextRelations.length === 0) {
        setSelectedRelationId(null);
        setRelationMode("new");
        setRelationFormValues(createEmptyRelationForm());
        return;
      }

      const targetRelation =
        nextRelations.find((item) => item.component_id === preferredRelationId) ||
        nextRelations[0];

      setSelectedRelationId(targetRelation.component_id);
      setRelationMode("existing");
      setRelationFormValues(relationToForm(targetRelation));
    } catch (err) {
      setRelationsError(err.message || "Ошибка загрузки связей продукта");
      setRelations([]);
      setSelectedRelationId(null);
      setRelationMode("new");
      setRelationFormValues(createEmptyRelationForm());
    } finally {
      setRelationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = products.filter((product) => {
    const query = search.toLowerCase();
    return (
      product.product_code.toLowerCase().includes(query) ||
      product.product_name.toLowerCase().includes(query)
    );
  });

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

  const selectedRelation =
    relations.find((item) => item.component_id === selectedRelationId) || null;

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
  }, [selectedProduct, normalizeUnit]);

  useEffect(() => {
    setRelations([]);
    setRelationsLoading(false);
    setRelationsError("");
    setRelationLookupsError("");
    setSelectedRelationId(null);
    setRelationMode("new");
    setRelationFormValues(createEmptyRelationForm());
    setRelationActionState({
      saving: false,
      deleting: false,
      success: "",
      error: "",
    });
  }, [selectedProductId]);

  useEffect(() => {
    if (activeTab !== "Relations" || !selectedProduct) {
      return;
    }

    loadRelationLookups();
    loadRelations(selectedProduct.product_code);
  }, [activeTab, selectedProduct, loadRelationLookups, loadRelations]);

  const handleSelectRelation = (relation) => {
    setSelectedRelationId(relation.component_id);
    setRelationMode("existing");
    setRelationFormValues(relationToForm(relation));
    setRelationActionState({
      saving: false,
      deleting: false,
      success: "",
      error: "",
    });
  };

  const handleAddRelation = () => {
    setSelectedRelationId(null);
    setRelationMode("new");
    setRelationFormValues(createEmptyRelationForm());
    setRelationActionState({
      saving: false,
      deleting: false,
      success: "",
      error: "",
    });
  };

  const resetRelationEditor = () => {
    if (relationMode === "existing" && selectedRelation) {
      setRelationFormValues(relationToForm(selectedRelation));
    } else {
      setRelationFormValues(createEmptyRelationForm());
    }
    setRelationActionState({
      saving: false,
      deleting: false,
      success: "",
      error: "",
    });
  };

  const buildRelationPayload = () => {
    if (!relationFormValues.semi_finished_id) {
      throw new Error("Выберите полуфабрикат");
    }
    if (!relationFormValues.route_id) {
      throw new Error("Выберите маршрут");
    }

    const componentQty = Number(relationFormValues.component_qty);
    const productQty = Number(relationFormValues.product_qty);
    const priority = Number(relationFormValues.priority);

    if (!Number.isFinite(componentQty) || componentQty <= 0) {
      throw new Error("component_qty должен быть больше 0");
    }
    if (!Number.isFinite(productQty) || productQty <= 0) {
      throw new Error("product_qty должен быть больше 0");
    }
    if (!Number.isInteger(priority) || priority < 1) {
      throw new Error("priority должен быть целым числом не меньше 1");
    }
    if (
      relationFormValues.valid_from &&
      relationFormValues.valid_to &&
      relationFormValues.valid_to < relationFormValues.valid_from
    ) {
      throw new Error("Дата valid_to не может быть раньше valid_from");
    }

    return {
      semi_finished_id: Number(relationFormValues.semi_finished_id),
      route_id: Number(relationFormValues.route_id),
      component_qty: componentQty,
      product_qty: productQty,
      priority,
      valid_from: relationFormValues.valid_from || null,
      valid_to: relationFormValues.valid_to || null,
      active: relationFormValues.active,
    };
  };

  const handleSaveRelation = async () => {
    if (!selectedProduct) return;

    let payload;
    try {
      payload = buildRelationPayload();
    } catch (err) {
      setRelationActionState({
        saving: false,
        deleting: false,
        success: "",
        error: err.message || "Ошибка проверки данных",
      });
      return;
    }

    const isNew = relationMode === "new";
    const path = isNew
      ? `/products/${selectedProduct.product_code}/components`
      : `/products/${selectedProduct.product_code}/components/${selectedRelationId}`;
    const method = isNew ? "POST" : "PUT";

    setRelationActionState({
      saving: true,
      deleting: false,
      success: "",
      error: "",
    });

    try {
      const response = await fetch(apiUrl(path), {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Ошибка сохранения строки технологии")
        );
      }

      const savedRelation = await response.json();
      await loadRelations(selectedProduct.product_code, savedRelation.component_id);

      setRelationActionState({
        saving: false,
        deleting: false,
        success: isNew ? "Строка добавлена" : "Строка сохранена",
        error: "",
      });
    } catch (err) {
      setRelationActionState({
        saving: false,
        deleting: false,
        success: "",
        error: err.message || "Ошибка сохранения строки технологии",
      });
    }
  };

  const handleDeleteRelation = async () => {
    if (!selectedProduct || !selectedRelationId || relationMode !== "existing") {
      return;
    }

    if (!window.confirm("Удалить выбранную строку технологии?")) {
      return;
    }

    setRelationActionState({
      saving: false,
      deleting: true,
      success: "",
      error: "",
    });

    try {
      const response = await fetch(
        apiUrl(
          `/products/${selectedProduct.product_code}/components/${selectedRelationId}`
        ),
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Ошибка удаления строки технологии")
        );
      }

      await loadRelations(selectedProduct.product_code);
      setRelationActionState({
        saving: false,
        deleting: false,
        success: "Строка удалена",
        error: "",
      });
    } catch (err) {
      setRelationActionState({
        saving: false,
        deleting: false,
        success: "",
        error: err.message || "Ошибка удаления строки технологии",
      });
    }
  };

  return (
    <>
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
                  const resp = await fetch(apiUrl("/products/import-template"));
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
              onClick={() =>
                fileInputRef.current && fileInputRef.current.click()
              }
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
                  const resp = await fetch(apiUrl("/products/import"), {
                    method: "POST",
                    body: formData,
                  });
                  if (!resp.ok) {
                    throw new Error(
                      await getErrorMessage(resp, "Ошибка импорта")
                    );
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
            Импорт завершён: создано {importState.summary.created_count},
            обновлено {importState.summary.updated_count}, ошибок{" "}
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
                {PRODUCT_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === tab.value ? styles.tabButtonActive : {}),
                    }}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    {tab.label}
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
                          setSaveState({
                            saving: false,
                            success: "",
                            error: "",
                          });
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
                              payload.unit_of_measure =
                                formValues.unit_of_measure;
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

                            setSaveState({
                              saving: true,
                              success: "",
                              error: "",
                            });
                            try {
                              const resp = await fetch(
                                apiUrl(
                                  `/products/${selectedProduct.product_code}`
                                ),
                                {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify(payload),
                                }
                              );
                              if (!resp.ok) {
                                throw new Error(
                                  await getErrorMessage(
                                    resp,
                                    "Ошибка сохранения"
                                  )
                                );
                              }
                              const data = await resp.json();

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
                            setSaveState({
                              saving: false,
                              success: "",
                              error: "",
                            });
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
                          value={
                            selectedProduct.is_active
                              ? "Активен"
                              : "Неактивен"
                          }
                        />
                      </>
                    )}

                    {isEditing && (
                      <>
                        <EditableField
                          label="Наименование"
                          value={formValues.product_name}
                          onChange={(val) =>
                            setFormValues((v) => ({
                              ...v,
                              product_name: val,
                            }))
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
                            setFormValues((v) => ({
                              ...v,
                              is_active: checked,
                            }))
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
                  <div style={styles.relationsToolbar}>
                    <div style={styles.relationsToolbarText}>
                      Управление строками технологии готовой продукции
                    </div>
                    <button
                      style={styles.primaryGhostButton}
                      onClick={handleAddRelation}
                      disabled={relationsLoading || relationLookupsLoading}
                    >
                      Добавить строку
                    </button>
                  </div>

                  {relationLookupsLoading && (
                    <p style={styles.mutedText}>Загрузка справочников...</p>
                  )}
                  {relationsLoading && (
                    <p style={styles.mutedText}>Загрузка связей...</p>
                  )}
                  {relationLookupsError && (
                    <p style={styles.error}>{relationLookupsError}</p>
                  )}
                  {relationsError && (
                    <p style={styles.error}>{relationsError}</p>
                  )}
                  {relationActionState.success && (
                    <p style={styles.successText}>
                      {relationActionState.success}
                    </p>
                  )}
                  {relationActionState.error && (
                    <p style={styles.error}>{relationActionState.error}</p>
                  )}

                  {!relationsLoading && !relationsError && relations.length === 0 && (
                    <p style={styles.mutedText}>
                      Для этого продукта пока нет строк технологии. Можно
                      добавить первую строку ниже.
                    </p>
                  )}

                  {!relationsLoading && !relationsError && relations.length > 0 && (
                    <div style={styles.relationsTableWrap}>
                      <table style={styles.relationsTable}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Полуфабрикат</th>
                            <th style={styles.th}>Название</th>
                            <th style={styles.th}>Маршрут получения ПФ</th>
                            <th style={styles.th}>Название маршрута</th>
                            <th style={styles.th}>Кол-во ПФ</th>
                            <th style={styles.th}>Кол-во продукта</th>
                            <th style={styles.th}>Приоритет</th>
                            <th style={styles.th}>Valid from</th>
                            <th style={styles.th}>Valid to</th>
                            <th style={styles.th}>Активна</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relations.map((item) => (
                            <tr
                              key={item.component_id}
                              style={{
                                ...styles.row,
                                ...(item.component_id === selectedRelationId &&
                                relationMode === "existing"
                                  ? styles.rowSelected
                                  : {}),
                              }}
                              onClick={() => handleSelectRelation(item)}
                            >
                              <td style={styles.td}>{item.semi_finished_code}</td>
                              <td style={styles.td}>{item.semi_finished_name}</td>
                              <td style={styles.td}>{item.route_code}</td>
                              <td style={styles.td}>{item.route_name}</td>
                              <td style={styles.td}>{item.component_qty}</td>
                              <td style={styles.td}>{item.product_qty}</td>
                              <td style={styles.td}>{item.priority}</td>
                              <td style={styles.td}>{item.valid_from || "—"}</td>
                              <td style={styles.td}>{item.valid_to || "—"}</td>
                              <td style={styles.td}>
                                <span
                                  style={{
                                    ...styles.badge,
                                    ...(item.active
                                      ? styles.badgeActive
                                      : styles.badgeInactive),
                                  }}
                                >
                                  {item.active ? "Да" : "Нет"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div
                    style={{
                      ...styles.editablePanel,
                      ...styles.relationFormPanel,
                      ...((relationMode === "new" ||
                      selectedRelationId !== null
                        ? styles.editablePanelActive
                        : {})),
                    }}
                  >
                    <div style={styles.relationFormHeader}>
                      <h3 style={styles.relationFormTitle}>
                        {relationMode === "new"
                          ? "Новая строка технологии"
                          : "Редактирование строки технологии"}
                      </h3>
                      {relationMode === "existing" && selectedRelation && (
                        <span style={styles.relationFormMeta}>
                          #{selectedRelation.component_id}
                        </span>
                      )}
                    </div>

                    <div style={styles.relationFormGrid}>
                      <LookupSelectField
                        label="Полуфабрикат"
                        value={relationFormValues.semi_finished_id}
                        options={relationLookups.semiFinished.map((item) => ({
                          value: String(item.semi_finished_id),
                          label: `${item.semi_finished_code} - ${item.semi_finished_name}`,
                        }))}
                        placeholder="Выберите полуфабрикат"
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            semi_finished_id: val,
                          }))
                        }
                      />
                      <LookupSelectField
                        label="Маршрут получения ПФ"
                        value={relationFormValues.route_id}
                        options={relationLookups.routes.map((item) => ({
                          value: String(item.route_id),
                          label: `${item.route_code} - ${item.route_name}`,
                        }))}
                        placeholder="Выберите маршрут получения ПФ"
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            route_id: val,
                          }))
                        }
                      />
                      <EditableNumber
                        label="component_qty"
                        value={relationFormValues.component_qty}
                        min={0}
                        step="0.001"
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            component_qty: val,
                          }))
                        }
                      />
                      <EditableNumber
                        label="product_qty"
                        value={relationFormValues.product_qty}
                        min={0}
                        step="0.001"
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            product_qty: val,
                          }))
                        }
                      />
                      <EditableNumber
                        label="priority"
                        value={relationFormValues.priority}
                        min={1}
                        step="1"
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            priority: val,
                          }))
                        }
                      />
                      <EditableDateField
                        label="valid_from"
                        value={relationFormValues.valid_from}
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            valid_from: val,
                          }))
                        }
                      />
                      <EditableDateField
                        label="valid_to"
                        value={relationFormValues.valid_to}
                        onChange={(val) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            valid_to: val,
                          }))
                        }
                      />
                      <EditableToggle
                        label="active"
                        checked={relationFormValues.active}
                        onChange={(checked) =>
                          setRelationFormValues((prev) => ({
                            ...prev,
                            active: checked,
                          }))
                        }
                      />
                    </div>

                    <div style={styles.relationFormActions}>
                      <button
                        style={{
                          ...styles.primaryButton,
                          opacity: relationActionState.saving ? 0.7 : 1,
                          cursor: relationActionState.saving
                            ? "wait"
                            : "pointer",
                        }}
                        onClick={handleSaveRelation}
                        disabled={
                          relationActionState.saving ||
                          relationActionState.deleting ||
                          relationLookupsLoading
                        }
                      >
                        {relationActionState.saving
                          ? "Сохранение..."
                          : relationMode === "new"
                          ? "Создать"
                          : "Сохранить"}
                      </button>
                      <button
                        style={styles.secondaryButton}
                        onClick={resetRelationEditor}
                        disabled={
                          relationActionState.saving ||
                          relationActionState.deleting
                        }
                      >
                        Отменить
                      </button>
                      {relationMode === "existing" && (
                        <button
                          style={styles.dangerButton}
                          onClick={handleDeleteRelation}
                          disabled={
                            relationActionState.saving ||
                            relationActionState.deleting
                          }
                        >
                          {relationActionState.deleting
                            ? "Удаление..."
                            : "Удалить"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
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

function EditableNumber({ label, value, onChange, min = 0, step = "1" }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </div>
  );
}

function EditableDateField({ label, value, onChange }) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <input
        type="date"
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

function LookupSelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
}) {
  return (
    <div style={styles.detailField}>
      <div style={styles.detailLabel}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ProductsSection;
