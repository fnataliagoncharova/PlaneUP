import { styles } from "../styles";

const DetailField = ({ label, value }) => (
  <div style={styles.detailField}>
    <div style={styles.detailLabel}>{label}</div>
    <div style={styles.detailValue}>{value}</div>
  </div>
);

export default DetailField;
