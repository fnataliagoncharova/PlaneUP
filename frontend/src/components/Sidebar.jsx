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
import { styles } from "../styles";

function MenuItem({ icon, label, collapsed, active, onClick }) {
  return (
    <div
      title={collapsed ? label : ""}
      onClick={onClick}
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

const Sidebar = ({ collapsed, onToggleCollapsed, activeSection, onSectionChange }) => {
  return (
    <aside
      style={{
        ...styles.sidebar,
        width: collapsed ? "80px" : "260px",
      }}
    >
      <div style={styles.collapseBtn}>
        <button onClick={onToggleCollapsed} style={styles.btn}>
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {!collapsed && <div style={styles.logo}>ПланПро</div>}

      <div style={styles.menu}>
        <MenuItem
          icon={<Box />}
          label="Продукция"
          collapsed={collapsed}
          active={activeSection === "products"}
          onClick={() => onSectionChange("products")}
        />
        <MenuItem
          icon={<Layers />}
          label="Полуфабрикаты"
          collapsed={collapsed}
          active={activeSection === "semi"}
          onClick={() => onSectionChange("semi")}
        />
        <MenuItem icon={<Route />} label="Маршруты" collapsed={collapsed} />
        <MenuItem icon={<BarChart3 />} label="План продаж" collapsed={collapsed} />
        <MenuItem icon={<ClipboardList />} label="Задания" collapsed={collapsed} />
        <MenuItem icon={<CheckCircle />} label="Факт" collapsed={collapsed} />
      </div>
    </aside>
  );
};

export default Sidebar;
