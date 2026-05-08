/**
 * 404 页面
 */
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import { RoutePaths } from '../../constants/routes.js';
import styles from './NotFoundPage.module.css';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>页面未找到</h1>
        <p className={styles.desc}>
          你访问的页面不存在或已被移除。
        </p>
        <Button onClick={() => navigate(RoutePaths.HOME)}>
          返回主页
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
