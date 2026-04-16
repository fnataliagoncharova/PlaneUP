import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ProductsSection from "./sections/ProductsSection";
import SemiFinishedSection from "./sections/SemiFinishedSection";
import ProcessesSection from "./sections/ProcessesSection";
import RoutesSection from "./sections/RoutesSection";
import { styles } from "./styles";

function App() {
  const [activeSection, setActiveSection] = useState("products");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.title =
      activeSection === "semi"
        ? "Полуфабрикаты"
        : activeSection === "processes"
        ? "Переделы"
        : activeSection === "routes"
        ? "Маршруты"
        : "Номенклатура готовой продукции";
  }, [activeSection]);

  return (
    <div style={styles.app}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main style={styles.main}>
        {activeSection === "products" && <ProductsSection />}
        {activeSection === "semi" && <SemiFinishedSection />}
        {activeSection === "processes" && <ProcessesSection />}
        {activeSection === "routes" && <RoutesSection />}
      </main>
    </div>
  );
}

export default App;
