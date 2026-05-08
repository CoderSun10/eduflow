/**
 * 应用根：
 *   - 注入 TanStack Query Provider（全局缓存）
 *   - 注入 React Router
 *
 * 不再放业务渲染逻辑；任何全局 Provider（如未来的主题、I18n）都集中在这里挂载。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router/index.jsx";
import { ThemeProvider } from "./hooks/useTheme.jsx";
import AppRuntime from "./components/layout/AppRuntime.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AppRuntime />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
