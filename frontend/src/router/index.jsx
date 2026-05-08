/**
 * 路由总配置
 *
 * 所有页面路径在此集中声明。
 * 受保护页面统一通过 ProtectedRoute + AppShell 包裹。
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePaths } from "../constants/routes.js";
import AppShell from "../components/layout/AppShell.jsx";
import LoginPage from "../pages/Login/LoginPage.jsx";
import RegisterPage from "../pages/Register/RegisterPage.jsx";
import ForgotPasswordPage from "../pages/ForgotPassword/ForgotPasswordPage.jsx";
import ResetPasswordPage from "../pages/ResetPassword/ResetPasswordPage.jsx";
import HomePage from "../pages/Home/HomePage.jsx";
import StudyStatsPage from "../pages/StudyStats/StudyStatsPage.jsx";
import PracticePage from "../pages/Practice/PracticePage.jsx";
import FocusedPractice from "../pages/Practice/FocusedPractice.jsx";
import ComprehensivePractice from "../pages/Practice/ComprehensivePractice.jsx";
import ProjectChallenge from "../pages/Practice/ProjectChallenge.jsx";
import PracticeHistoryDetailPage from "../pages/Practice/PracticeHistoryDetailPage.jsx";
import PracticeWrongNotesPage from "../pages/Practice/PracticeWrongNotesPage.jsx";
import LearningMapIndexPage from "../pages/LearningMap/LearningMapIndexPage.jsx";
import LearningMapDetailPage from "../pages/LearningMap/LearningMapDetailPage.jsx";
import SettingsPage from "../pages/Settings/SettingsPage.jsx";
import WorkbenchPage from "../pages/Workbench/WorkbenchPage.jsx";
import NotFoundPage from "../pages/NotFound/NotFoundPage.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";

export const router = createBrowserRouter([
  {
    path: RoutePaths.ROOT,
    element: <Navigate to={RoutePaths.HOME} replace />,
  },
  {
    path: RoutePaths.LOGIN,
    element: <LoginPage />,
  },
  {
    path: RoutePaths.REGISTER,
    element: <RegisterPage />,
  },
  {
    path: RoutePaths.FORGOT_PASSWORD,
    element: <ForgotPasswordPage />,
  },
  {
    path: RoutePaths.RESET_PASSWORD,
    element: <ResetPasswordPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: RoutePaths.HOME, element: <HomePage /> },
      { path: RoutePaths.STATS, element: <StudyStatsPage /> },
      { path: RoutePaths.PRACTICE, element: <PracticePage /> },
      { path: RoutePaths.LEARNING_MAP, element: <LearningMapIndexPage /> },
      {
        path: RoutePaths.LEARNING_MAP_DETAIL,
        element: <LearningMapDetailPage />,
      },
      {
        path: RoutePaths.PRACTICE_HISTORY_DETAIL,
        element: <PracticeHistoryDetailPage />,
      },
      {
        path: RoutePaths.PRACTICE_WRONG_NOTES,
        element: <PracticeWrongNotesPage />,
      },
      { path: "/practice/focused", element: <FocusedPractice /> },
      { path: "/practice/comprehensive", element: <ComprehensivePractice /> },
      { path: "/practice/project", element: <ProjectChallenge /> },
      { path: RoutePaths.SETTINGS, element: <SettingsPage /> },
      { path: RoutePaths.WORKBENCH, element: <WorkbenchPage /> },
      // 旧路径兼容重定向
      {
        path: RoutePaths.SESSIONS,
        element: <Navigate to={RoutePaths.STATS} replace />,
      },
      {
        path: RoutePaths.HISTORY,
        element: <Navigate to={RoutePaths.STATS} replace />,
      },
      {
        path: RoutePaths.REPORTS,
        element: <Navigate to={RoutePaths.STATS} replace />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
