import { useEffect, useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/products")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Ошибка загрузки продукции");
        }
        return response.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredProducts = products.filter((product) => {
    const query = search.toLowerCase();
    return (
      product.product_code.toLowerCase().includes(query) ||
      product.product_name.toLowerCase().includes(query)
    );
  });

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
        <h1 style={styles.title}>Продукция</h1>
        <p style={styles.subtitle}>
          Справочник готовой продукции, выпускаемой на предприятии
        </p>

        {/* Поиск */}
        <div style={styles.searchBar}>
          <input
            type="text"
            placeholder="Поиск по коду или названию продукции"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.card}>
          {loading && <p>Загрузка продукции...</p>}
          {error && <p style={styles.error}>{error}</p>}

          {!loading && !error && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Код продукта</th>
                  <th style={styles.th}>Наименование</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.product_id}>
                    <td style={styles.td}>{product.product_code}</td>
                    <td style={styles.td}>{product.product_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
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
  title: {
    marginBottom: "8px",
    color: "#11224d",
  },
  subtitle: {
    marginTop: 0,
    marginBottom: "24px",
    color: "#6d7b98",
  },
  searchBar: {
    marginBottom: "16px",
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
  error: {
    color: "crimson",
  },
};

export default App;